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
// Firestore, because by definition these documents have no Firestore row.
//
// Every document is re-checked against the live database before anything is removed, so a stale skip
// report cannot cause a wrong deletion.
//
// Dry run (default, deletes nothing):  npx tsx scripts/delete-unrepairable-documents.ts
// Apply (performs the deletions):      APPLY=1 npx tsx scripts/delete-unrepairable-documents.ts
// Use a different report:              REPORT=path/to/skipped.json npx tsx ...
// Change the retention window:         RETENTION_DAYS=730 npx tsx ...

import fs from "fs";
import admin from "firebase-admin";
import { getScriptRootFilePath } from "./lib/script-utils.js";
import { createRtdbReader, resolveDatabaseUrl } from "./lib/repair-cli";
import {
  kDefaultRetentionMs, kProtectedSpaces, planDeletions,
  type IPlannedDeletion, type ISkippedRecord
} from "./lib/deletion-plan";

async function main() {
  const reportPath = process.env.REPORT ?? getScriptRootFilePath("create-missing-skipped.json");
  const records: ISkippedRecord[] = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const retentionMs = process.env.RETENTION_DAYS
    ? Number(process.env.RETENTION_DAYS) * 24 * 60 * 60 * 1000
    : kDefaultRetentionMs;
  const dryRun = process.env.APPLY !== "1";

  const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFile, "utf8"));
  const databaseURL = resolveDatabaseUrl(serviceAccount.project_id, process.env.DATABASE_URL);

  console.log(`- Report: ${reportPath} (${records.length} skipped documents)`);
  console.log(`- Firebase project: ${serviceAccount.project_id}`);
  console.log(`- Realtime Database URL: ${databaseURL}`);
  console.log(`- Protected spaces: ${kProtectedSpaces.join(", ")}`);
  console.log(`- Retention: ${Math.round(retentionMs / 86400000)} days`);
  console.log(`- Mode: ${dryRun ? "DRY RUN" : "APPLY — will delete"}\n`);

  const plan = planDeletions(records, { now: Date.now(), retentionMs });
  console.log("plan", JSON.stringify(plan.summary, null, 2));
  for (const r of plan.refused) console.log(`  refused ${r.space} ${r.key}: ${r.reason}`);

  const credential = admin.credential.cert(serviceAccountFile);
  admin.initializeApp({ credential, databaseURL });
  const firestore = admin.firestore();
  const database = admin.database();
  const reader = createRtdbReader(databaseURL, () => (credential as any).getAccessToken());

  // Re-check against the live database rather than trusting the report. Between the dry run that
  // produced it and this run, a document may have been repaired, edited, or already removed.
  const stillDeletable = async (d: IPlannedDeletion): Promise<string | undefined> => {
    const firestoreDoc = await firestore.doc(`${d.space}/documents/${d.key}`).get();
    if (firestoreDoc.exists) return "it now has Firestore metadata";
    for (const path of d.paths) {
      if (!(await reader.readNode(path))) return `${path} is already gone`;
    }
    return undefined;
  };

  let deletedDocuments = 0;
  let deletedNodes = 0;
  const changed: Array<{ key: string; space: string; why: string }> = [];

  for (const d of plan.deletions) {
    const why = await stillDeletable(d);
    if (why) {
      changed.push({ key: d.key, space: d.space, why });
      continue;
    }
    if (dryRun) {
      deletedDocuments++;
      deletedNodes += d.paths.length;
      continue;
    }
    for (const path of d.paths) {
      await database.ref(path).remove();
      // Counted only once the removal resolved, so a crash understates what was deleted.
      deletedNodes++;
    }
    deletedDocuments++;
    if (deletedDocuments % 50 === 0) console.log(`  deleted ${deletedDocuments} documents`);
  }

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
