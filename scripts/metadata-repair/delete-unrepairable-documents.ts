#!/usr/bin/node

// Deletes the realtime-database documents that create-missing-document-metadata.ts could not repair.
//
// The repair leaves a residue it will not write metadata for: documents whose curriculum position
// cannot be recovered, metadata nodes whose content is gone, and content with no metadata node. As of
// 2026-08-24 that residue is 665 documents, none created in the past year, and all but three of them
// outside production.
//
// This script reads the skip report a dry run produces and removes those documents from the realtime
// database. It NEVER touches `authed/learn_concord_org` — see kProtectedSpaces — and never touches
// Firestore, because by definition these documents have no Firestore metadata document.
//
// Every document is re-checked against the live database before anything is removed. That check
// catches a document that has since been repaired or already removed; it CANNOT tell that a document
// has become repairable — say because an offering the run could not resolve is resolvable now. The
// report is a claim about repairability at the moment it was written, so generate it from the same
// code, against the same data, immediately before deleting. See "Order" in the design doc.
//
// Dry run (default, deletes nothing):  npx tsx scripts/metadata-repair/delete-unrepairable-documents.ts
// Apply (performs the deletions):      APPLY=1 npx tsx scripts/metadata-repair/delete-unrepairable-documents.ts
// Use a different report:              REPORT=path/to/skipped.json npx tsx ...
// Change the retention window:         RETENTION_DAYS=730 npx tsx ...
//
// Read ./README.md before running any of these: the order matters, and two of the three write.

import {
  kDefaultRetentionMs, type IDeletionPlan, type IPlannedDeletion, type ISkipReport, type ISkippedRecord
} from "./lib/deletion-plan";

export interface IDeletionSettings {
  dryRun: boolean;
  retentionMs: number;
  maxReportAgeHours: number;
}

/**
 * A setting that must be a non-negative number, or its default when unset.
 *
 * Both settings this script reads guard a deletion, and `Number("48h")` is NaN, against which every
 * comparison is false. An unreadable value would disable its guard rather than tighten it — the one
 * direction a guard must never fail in — so it is refused.
 */
function nonNegativeSetting(name: string, raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number, got "${raw}". ` +
      `An unreadable value would disable the guard it controls rather than tighten it.`);
  }
  return value;
}

/** The run's settings, from the environment. */
export function parseDeletionSettings(env: Record<string, string | undefined>): IDeletionSettings {
  const kDayMs = 24 * 60 * 60 * 1000;
  return {
    dryRun: env.APPLY !== "1",
    retentionMs: nonNegativeSetting("RETENTION_DAYS", env.RETENTION_DAYS, kDefaultRetentionMs / kDayMs) * kDayMs,
    maxReportAgeHours: nonNegativeSetting("MAX_REPORT_AGE_HOURS", env.MAX_REPORT_AGE_HOURS, 24)
  };
}

/**
 * Refuse a report this run must not act on. Returns the report's records.
 *
 * Refuse rather than warn: this is the irreversible script. Each check stands for a way the wrong
 * report reaches this script without anything looking wrong:
 *
 * - **Another project or database.** Every record would read as "already gone", and the run would
 *   report a clean no-op instead of an error.
 * - **Written by an apply run.** The residue is meant to be confirmed by a dry run *after* the repair.
 *   An apply run's report is still at the default path when that dry run was filtered with SPACES, and
 *   is recent enough to pass the age check.
 * - **Too old.** A stale report is the one input that can cause a wrong deletion: a document that has
 *   become repairable since looks exactly like one that has not. A dry run may read an old report,
 *   since it removes nothing.
 */
export function checkSkipReport(
  report: ISkipReport,
  current: { projectId: string; databaseURL: string; now: number },
  { dryRun, maxReportAgeHours }: IDeletionSettings
): ISkippedRecord[] {
  if (!report || Array.isArray(report) || !Array.isArray(report.skipped)) {
    throw new Error("The skip report does not say which run wrote it. " +
      "Regenerate it with a dry run of create-missing-document-metadata.ts.");
  }
  if (report.projectId !== current.projectId || report.databaseURL !== current.databaseURL) {
    throw new Error(`The skip report was written against ${report.projectId} (${report.databaseURL}), ` +
      `but this run is pointed at ${current.projectId} (${current.databaseURL}).`);
  }
  if (!report.dryRun) {
    throw new Error("The skip report was written by an apply run. Delete only from the dry run that " +
      "follows the repair: re-run create-missing-document-metadata.ts without APPLY.");
  }
  const reportAgeHours = (current.now - report.generatedAt) / 3600000;
  if (!dryRun && !(reportAgeHours <= maxReportAgeHours)) {
    throw new Error(`The skip report is ${reportAgeHours.toFixed(1)}h old, over the ${maxReportAgeHours}h ` +
      `limit. Re-run create-missing-document-metadata.ts so the residue reflects the current data, ` +
      `or raise MAX_REPORT_AGE_HOURS if you are certain nothing has changed.`);
  }
  return report.skipped;
}

export interface IDeletionDeps {
  /** Why a planned document must now be left alone, or undefined when it is still deletable. */
  stillDeletable: (d: IPlannedDeletion) => Promise<string | undefined>;
  removeNode: (path: string) => Promise<void>;
  log?: (message: string) => void;
}

export interface IDeletionResult {
  deletedDocuments: number;
  deletedNodes: number;
  changed: Array<{ key: string; space: string; why: string }>;
}

/** Remove every planned document still deletable, or on a dry run count what would be removed. */
export async function runDeletions(
  plan: IDeletionPlan, { dryRun }: { dryRun: boolean },
  { stillDeletable, removeNode, log = console.log }: IDeletionDeps
): Promise<IDeletionResult> {
  const result: IDeletionResult = { deletedDocuments: 0, deletedNodes: 0, changed: [] };

  try {
    for (const d of plan.deletions) {
      const why = await stillDeletable(d);
      if (why) {
        result.changed.push({ key: d.key, space: d.space, why });
        continue;
      }
      if (dryRun) {
        result.deletedDocuments++;
        result.deletedNodes += d.paths.length;
        continue;
      }
      for (const path of d.paths) {
        await removeNode(path);
        // Counted only once the removal resolved, so a crash understates what was deleted.
        result.deletedNodes++;
      }
      result.deletedDocuments++;
      if (result.deletedDocuments % 50 === 0) log(`  deleted ${result.deletedDocuments} documents`);
    }
  } catch (err: any) {
    // What was removed before the failure is gone for good, so carry the counts out with it.
    err.result = result;
    throw err;
  }

  return result;
}

async function main() {
  // Imported lazily so the Jest test can import this module without loading firebase-admin or the
  // import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const fs = (await import("fs")).default;
  const { getScriptRootFilePath } = await import("../lib/script-utils.js");
  const { createRtdbReader, kSkipReportFile, resolveDatabaseUrl } = await import("./lib/repair-cli");
  const { kProtectedSpaces, planDeletions } = await import("./lib/deletion-plan");

  const settings = parseDeletionSettings(process.env);
  const { dryRun, retentionMs } = settings;
  const reportPath = process.env.REPORT ?? getScriptRootFilePath(kSkipReportFile);
  const report: ISkipReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFile, "utf8"));
  const databaseURL = resolveDatabaseUrl(serviceAccount.project_id, process.env.DATABASE_URL);

  console.log(`- Report: ${reportPath}`);
  console.log(`- Firebase project: ${serviceAccount.project_id}`);
  console.log(`- Realtime Database URL: ${databaseURL}`);
  console.log(`- Protected spaces: ${kProtectedSpaces.join(", ")}`);
  console.log(`- Retention: ${Math.round(retentionMs / 86400000)} days`);
  console.log(`- Mode: ${dryRun ? "DRY RUN" : "APPLY — will delete"}\n`);

  const now = Date.now();
  const records = checkSkipReport(report, { projectId: serviceAccount.project_id, databaseURL, now }, settings);
  console.log(`- Report written ${new Date(report.generatedAt).toISOString()} ` +
    `(${((now - report.generatedAt) / 3600000).toFixed(1)}h ago), ${records.length} skipped documents`);
  // A filtered report can only under-delete, so it is allowed, but the run should say it is partial.
  if (report.spaces) console.log(`- Report covers only: ${report.spaces.join(", ")}`);

  const plan = planDeletions(records, { now, retentionMs });
  console.log("plan", JSON.stringify(plan.summary, null, 2));
  for (const r of plan.refused) console.log(`  refused ${r.space} ${r.key}: ${r.reason}`);

  const credential = admin.credential.cert(serviceAccountFile);
  admin.initializeApp({ credential, databaseURL });
  const firestore = admin.firestore();
  const database = admin.database();
  const reader = createRtdbReader(databaseURL, () => (credential as any).getAccessToken());

  // Re-check against the live database rather than trusting the report. Between the dry run that
  // produced it and this run, a document may have been repaired or already removed.
  //
  // This is a check on the document still being *unreachable*, not on it still being *unrepairable*.
  // Nothing here re-runs the curriculum resolution, so a document that became resolvable since the
  // report would still be deleted. Only a fresh report rules that out, which is why the deletion runs
  // last and against a report generated after the repair.
  const stillDeletable = async (d: IPlannedDeletion): Promise<string | undefined> => {
    const firestoreDoc = await firestore.doc(`${d.space}/documents/${d.key}`).get();
    if (firestoreDoc.exists) return "it now has Firestore metadata";
    for (const path of d.paths) {
      if (!(await reader.readNode(path))) return `${path} is already gone`;
    }
    return undefined;
  };

  const { deletedDocuments, deletedNodes, changed } = await runDeletions(plan, { dryRun }, {
    stillDeletable,
    removeNode: async (path) => { await database.ref(path).remove(); }
  });

  console.log(`\n${dryRun ? "would delete" : "deleted"} ${deletedDocuments} documents ` +
    `(${deletedNodes} realtime-database nodes)`);
  if (changed.length) {
    console.log(`${changed.length} documents changed since the report and were left alone:`);
    for (const c of changed.slice(0, 20)) console.log(`  ${c.space} ${c.key}: ${c.why}`);
  }
  if (dryRun) console.log("DRY RUN — set APPLY=1 to delete");
  process.exit(0);
}

// Run only when invoked directly (via tsx), never when imported by a test.
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
