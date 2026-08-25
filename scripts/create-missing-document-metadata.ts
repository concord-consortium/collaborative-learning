#!/usr/bin/node

// Creates the Firestore metadata rows for realtime-database documents that have none.
//
// Until 2025-06-24 the client created these rows with a fire-and-forget cloud-function call, so a
// document whose page navigated away before the call completed never got one. 6,240 such documents
// remain across all real spaces, of which 4,996 are in demo spaces. The cause is fixed (CLUE-647);
// this is a one-time repair.
//
// Dry run (default, writes nothing):  npx tsx scripts/create-missing-document-metadata.ts
// Apply (performs the writes):        APPLY=1 npx tsx scripts/create-missing-document-metadata.ts
// Limit to named spaces:              SPACES=demo/CLUE npx tsx ...

import type { Firestore } from "firebase-admin/firestore";
import { isRtdbAddressable, type IDocumentHome } from "./lib/rtdb-document-index";
import { toolsFromContent } from "./lib/document-tools";

/** Batched writes are capped well below Firestore's 500-operation limit. */
const kBatchSize = 400;

/**
 * The types kept in an offering rather than in the class. Each needs `offeringId` plus a curriculum
 * position; `isInClassUnitContainer` reads the *absence* of `offeringId` as "class-contained", so a
 * row written without one would place the document on the wrong container axis.
 *
 * The stored value for a problem publication is "publication" — `ProblemPublication` in
 * document-types.ts is the constant's name, not its value.
 */
export const kOfferingContainedTypes = ["problem", "planning", "publication", "supportPublication"];

/**
 * Publication types whose `originDoc` is worth recovering, and the class-level list holding it.
 *
 * `originDoc` is established practice for exactly these two — 296 of 296 learning log publications and
 * 238 of 295 personal publications carry it in production — and no practice at all for problem
 * publications, where 0 of 14,325 do. So a problem publication is deliberately absent here.
 *
 * Nothing else is taken from these lists. `pubVersion` and `userId` appear on no Firestore document,
 * and their `groupId` names the group that *published* the document, whereas Firestore's `groupId` is
 * an owner-axis field meaning the document *belongs to* that group. See
 * docs/document-metadata/firestore-migration.md.
 */
const kOriginDocLists: Record<string, (classHash: string) => string> = {
  personalPublication: (classHash) => `classes/${classHash}/personalPublications`,
  learningLogPublication: (classHash) => `classes/${classHash}/publications`
};

export type CreateBucket =
  | "created"            // a row this run would write, or did
  | "written"            // credited only once the commit resolved
  | "alreadyPresent"     // Firestore already has a row for this key
  | "skippedNoContent"   // metadata without content: creating a row would surface a broken document
  | "skippedUnaddressable" // a key the realtime database cannot express in a path
  | "nodeUnreadable"     // the metadata node could not be read; nothing to build a row from
  | "unresolvedCurriculum" // offering-contained, but its unit/investigation/problem are unknown
  | "unreadableContent";  // the row was written, but without `tools`: its content would not parse

export type ICreateCounts = Record<CreateBucket, number>;

const emptyCounts = (): ICreateCounts => ({
  created: 0, written: 0, alreadyPresent: 0, skippedNoContent: 0,
  skippedUnaddressable: 0, nodeUnreadable: 0, unresolvedCurriculum: 0, unreadableContent: 0
});

export interface ICurriculumPosition {
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
}

/**
 * A document the run declined, with enough about it to decide what should happen instead. `createdAt`
 * is the only timestamp these nodes reliably carry — `lastEditedAt` appears on a handful — so it is
 * the practical measure of a skipped document's age.
 */
export interface ISkippedDocument {
  key: string;
  /** The rest of the realtime-database path. A key alone addresses nothing. */
  classHash: string;
  uid: string;
  /** Which halves exist, so a follow-up knows which nodes are actually there. */
  hasContent: boolean;
  hasMetadata: boolean;
  reason: CreateBucket;
  createdAt?: number;
  type?: string;
  offeringId?: string;
}

export interface ICreateMissingResult {
  counts: ICreateCounts;
  /** Documents skipped, with the reason, so a run says what it declined rather than only what it did. */
  skipped: ISkippedDocument[];
}

/** Reads one realtime-database node's value, or null when it is absent. */
export type ReadNode = (path: string) => Promise<any>;

export interface ICreateMissingDeps {
  rtdbRoot: string;
  readNode: ReadNode;
  /** Stored on every row this run creates, matching what the client stamps at creation. */
  network?: string | null;
  /**
   * Last resort for an offering whose curriculum position no existing document reveals. Backed by the
   * portal API in the CLI; omitted, an unresolved offering is reported and skipped.
   */
  resolveCurriculum?: (offeringId: string) => Promise<ICurriculumPosition | undefined>;
}

export interface ICreateMissingOptions {
  dryRun?: boolean;
  log?: (message: string) => void;
  pageSize?: number;
  batchSize?: number;
}

/**
 * Create a Firestore metadata row for every indexed document that lacks one.
 *
 * Only documents whose content still exists get a row. A document with metadata but no content is
 * already unreachable; giving it a Firestore row would promote it into Sort Work, where opening it
 * throws. That skip is the reason the index reads both realtime-database halves.
 */
export async function createMissingDocumentMetadata(
  firestore: Firestore,
  spacePath: string,
  index: Map<string, IDocumentHome>,
  { rtdbRoot, readNode, network = null, resolveCurriculum }: ICreateMissingDeps,
  { dryRun = true, log = console.log, pageSize = 500, batchSize = kBatchSize }: ICreateMissingOptions = {}
): Promise<ICreateMissingResult> {
  const counts = emptyCounts();
  const skipped: ISkippedDocument[] = [];

  // One pass over Firestore serves two purposes: the ids already present, so the run writes only what
  // is genuinely absent, and a curriculum position per offering, so most rows need no portal call.
  const present = new Set<string>();
  const curriculumByOffering = new Map<string, ICurriculumPosition>();
  let lastDoc: any = null;
  for (;;) {
    let query: any = (firestore.collection(spacePath) as any)
      .select("offeringId", "unit", "investigation", "problem").limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const doc of snapshot.docs) {
      present.add(doc.id);
      const d = doc.data() ?? {};
      if (d.offeringId && d.unit && !curriculumByOffering.has(d.offeringId)) {
        curriculumByOffering.set(d.offeringId,
          { unit: d.unit, investigation: d.investigation, problem: d.problem });
      }
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < pageSize) break;
  }

  // Memoizes both sources, so an offering is asked about once however many documents share it.
  // Failures are cached as `undefined` too: demo spaces carry authored offering ids the portal knows
  // nothing about, and without this every document sharing one would re-query.
  const curriculumFor = async (offeringId: string): Promise<ICurriculumPosition | undefined> => {
    if (curriculumByOffering.has(offeringId)) return curriculumByOffering.get(offeringId);
    const resolved = resolveCurriculum ? await resolveCurriculum(offeringId) : undefined;
    const usable = resolved?.unit ? resolved : undefined;
    curriculumByOffering.set(offeringId, usable as ICurriculumPosition);
    return usable;
  };

  // A publication list is shared by every publication in its class, so read each at most once.
  const listCache = new Map<string, any>();
  const originDocFor = async (type: string, classHash: string, key: string) => {
    const buildPath = kOriginDocLists[type];
    if (!buildPath) return undefined;
    const path = `${rtdbRoot}/${buildPath(classHash)}`;
    if (!listCache.has(path)) listCache.set(path, await readNode(path));
    const list = listCache.get(path);
    // Entries are keyed by their own push id; the document key is inside `self`.
    const entry = list && Object.values(list)
      .find((candidate: any) => candidate?.self?.documentKey === key);
    return (entry as any)?.originDoc;
  };

  let batch = firestore.batch();
  let batched = 0;
  const commit = async () => {
    if (!batched) return;
    await batch.commit();
    // Credited only now, so a crash understates rather than overstates what landed.
    counts.written += batched;
    batch = firestore.batch();
    batched = 0;
  };

  const skip = (key: string, indexed: IDocumentHome, reason: CreateBucket, node?: any) => {
    counts[reason]++;
    const entry: ISkippedDocument = {
      key, classHash: indexed.classHash, uid: indexed.uid,
      hasContent: indexed.hasContent, hasMetadata: indexed.hasMetadata, reason
    };
    if (node?.createdAt != null) entry.createdAt = node.createdAt;
    if (reason === "unresolvedCurriculum") {
      entry.type = node?.type;
      entry.offeringId = node?.offeringId;
    }
    skipped.push(entry);
  };

  for (const [key, indexed] of index) {
    if (present.has(key)) { counts.alreadyPresent++; continue; }
    if (!isRtdbAddressable(indexed.classHash, indexed.uid, key)) {
      skip(key, indexed, "skippedUnaddressable");
      continue;
    }

    const nodePath =
      `${rtdbRoot}/classes/${indexed.classHash}/users/${indexed.uid}/documentMetadata/${key}`;
    const node = await readNode(nodePath);
    // Read before the content check so a skipped document can still report its age.
    if (!indexed.hasContent) { skip(key, indexed, "skippedNoContent", node); continue; }
    if (!node) { skip(key, indexed, "nodeUnreadable"); continue; }

    const row: Record<string, any> = {
      key,
      type: node.type,
      uid: indexed.uid,
      context_id: indexed.classHash,
      createdAt: node.createdAt,
      network,
      properties: {}
    };
    // Stamped only when present, so Firestore never stores `title: undefined`.
    if (node.title != null) row.title = node.title;
    // The client keeps this in step from the moment a row exists — useDocumentSyncToFirebase finds
    // rows by query, so every toggle made while the row was missing updated nothing. Taking the node's
    // value makes the row right now rather than at the owner's next toggle, which for a document this
    // old may never come.
    if (node.visibility != null) row.visibility = node.visibility;

    const originDoc = await originDocFor(node.type, indexed.classHash, key);
    if (originDoc != null) row.originDoc = originDoc;

    if (kOfferingContainedTypes.includes(node.type)) {
      const position = node.offeringId ? await curriculumFor(node.offeringId) : undefined;
      if (!position) {
        // Writing the row without these would place the document on the wrong container axis and
        // hand it to the offeringId backfill as new work. Report it and leave it alone.
        skip(key, indexed, "unresolvedCurriculum", node);
        continue;
      }
      row.offeringId = node.offeringId;
      row.unit = position.unit;
      row.investigation = position.investigation;
      row.problem = position.problem;
    } else {
      // Written as an explicit null, not left out. Sort Work finds class-contained documents with
      // `where("unit", "==", null)` (sorted-documents.ts), and Firestore cannot match a field that is
      // absent — a row without it is invisible under every filter but "All". This is what the client's
      // "class" container stamps, and all 19,649 class-contained rows in production carry it.
      row.unit = null;
    }

    // Read last, so the 573 documents skipped above never pull a content node. Content is the largest
    // thing in the database and this is the run's only read of it.
    const contentPath =
      `${rtdbRoot}/classes/${indexed.classHash}/users/${indexed.uid}/documents/${key}`;
    const tools = toolsFromContent((await readNode(contentPath))?.content);
    // Absent rather than `[]` when the content would not parse: an empty array asserts the document
    // has no tiles, which is a different claim from "this run could not tell".
    if (tools) row.tools = tools;
    else counts.unreadableContent++;

    counts.created++;
    if (!dryRun) {
      batch.set(firestore.doc(`${spacePath}/${key}`), row);
      if (++batched >= batchSize) await commit();
    }
  }

  await commit();

  log(`${spacePath}: created ${counts.created}, written ${counts.written}, ` +
      `already present ${counts.alreadyPresent}, no content ${counts.skippedNoContent}, ` +
      `unaddressable ${counts.skippedUnaddressable}, unreadable ${counts.nodeUnreadable}, ` +
      `unresolved curriculum ${counts.unresolvedCurriculum}, ` +
      `no tools ${counts.unreadableContent}`);

  return { counts, skipped };
}

async function main() {
  // Imported lazily so the Jest test can import createMissingDocumentMetadata without loading
  // firebase-admin or the import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const nodeFs = (await import("fs")).default;
  const { getScriptRootFilePath, getProblemDetails } = await import("./lib/script-utils.js");
  const {
    createRtdbReader, kOutputDir, kSkipReportFile, listSpacePaths, parseSpacesFilter, resolveDatabaseUrl, selectSpaces
  } = await import("./lib/repair-cli");
  const { buildRtdbDocumentIndex } = await import("./lib/rtdb-document-index");
  const { createCurriculumValidator, decodeDemoOfferingId } = await import("./lib/curriculum-position");

  const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
  const serviceAccount = JSON.parse(nodeFs.readFileSync(serviceAccountFile, "utf8"));
  const databaseURL = resolveDatabaseUrl(serviceAccount.project_id, process.env.DATABASE_URL);
  const dryRun = process.env.APPLY !== "1";
  const filter = parseSpacesFilter(process.env.SPACES);
  // The portal is only consulted for offerings no existing document describes. Without a token the
  // run still works; those documents are reported as unresolved instead of written half-populated.
  const portal = process.env.PORTAL ?? "https://learn.concord.org";

  console.log(`- Service account: ${serviceAccount.client_email}`);
  console.log(`- Firebase project: ${serviceAccount.project_id}`);
  console.log(`- Realtime Database URL: ${databaseURL}`);
  console.log(`- Portal (curriculum fallback): ${portal}`);
  console.log(`- Spaces: ${filter ? filter.join(", ") : "all"}`);
  console.log(`- Mode: ${dryRun ? "DRY RUN" : "APPLY — will write"}`);

  const credential = admin.credential.cert(serviceAccountFile);
  admin.initializeApp({ credential, databaseURL });
  const firestore = admin.firestore();
  const reader = createRtdbReader(databaseURL, () => (credential as any).getAccessToken());

  const resolveFromPortal = async (offeringId: string) => {
    try {
      const { fetchPortalOffering } = await import("./lib/fetch-portal-entity.js");
      const offering: any = await fetchPortalOffering(portal, offeringId);
      if (!offering?.activity_url) return undefined;
      return getProblemDetails(offering.activity_url);
    } catch (err: any) {
      // An offering the portal cannot answer for is reported by the pass, not fatal to the run.
      console.log(`    portal lookup failed for offering ${offeringId}: ${err.message}`);
      return undefined;
    }
  };

  // Demo documents have no other source: nothing in the realtime database records a curriculum
  // position, so their offering id is it. Decoding splits a string into a name and a number and can
  // split in the wrong place, so every result is checked against a curriculum checkout before use.
  const curriculumRoot = process.env.CURRICULUM_ROOT ?? `${process.env.HOME}/Development/clue-curriculum`;
  // Each unit's content.json read at most once; missing units cache as undefined.
  const unitContent = new Map<string, any>();
  const readUnitContent = (unit: string) => {
    if (!unitContent.has(unit)) {
      const path = `${curriculumRoot}/curriculum/${unit}/content.json`;
      try {
        unitContent.set(unit, JSON.parse(nodeFs.readFileSync(path, "utf8")));
      } catch {
        unitContent.set(unit, undefined);
      }
    }
    return unitContent.get(unit);
  };
  const validate = createCurriculumValidator(curriculumRoot, { readUnitContent });

  // A demo session launched with no `unit` parameter leaves the unit code out of its offering id
  // while the app still loads this unit, so a bare id means this one. Read from the config rather
  // than hardcoded, so it stays true if the default changes.
  const defaultUnit = JSON.parse(
    nodeFs.readFileSync(getScriptRootFilePath("../src/clue/curriculum-config.json"), "utf8")
  ).defaultUnit;
  console.log(`- Curriculum: ${curriculumRoot} (default unit "${defaultUnit}")`);

  const resolveFromOfferingId = (offeringId: string) => {
    const decoded = decodeDemoOfferingId(offeringId, defaultUnit);
    if (!decoded) {
      console.log(`    offering ${offeringId} carries no unit code — skipped`);
      return undefined;
    }
    if (!validate(decoded)) {
      console.log(`    offering ${offeringId} decodes to ${decoded.unit} ` +
        `${decoded.investigation}.${decoded.problem}, which the curriculum does not have — skipped`);
      return undefined;
    }
    console.log(`    offering ${offeringId} -> ${decoded.unit} ${decoded.investigation}.${decoded.problem}`);
    return decoded;
  };

  const selection = selectSpaces(await listSpacePaths(firestore), filter);
  for (const { label, reason } of selection.refused) console.log(`- skipping ${label}: ${reason}`);
  for (const path of selection.unrecognized) console.log(`- unrecognized space path: ${path}`);
  for (const name of selection.filterMisses) console.log(`- SPACES named "${name}", which matches no space`);
  console.log(`- Running over ${selection.selected.length} spaces\n`);

  const totals = emptyCounts();
  const allSkipped: Record<string, number> = {};
  const everySkipped: Array<ISkippedDocument & { space: string }> = [];
  for (const space of selection.selected) {
    const { index, duplicates, classes } = await buildRtdbDocumentIndex(space.rtdbRoot, reader.readChildKeys);
    console.log(`  ${space.label}: ${classes} classes, ${index.size} indexed documents`);
    if (duplicates.length) {
      console.log(`  ${space.label}: ${duplicates.length} keys with more than one home — NOT created`);
    }
    // Which fallback applies depends on where the space's offerings came from. A demo space's
    // realtime root is `demo/<name>/portals/demo` and its offering ids are authored strings like
    // "m2s101", which learn.concord.org knows nothing about; an authed space's are portal ids, which
    // encode nothing. Either way the sibling lookup inside the pass is tried first.
    const portalBacked = space.label.startsWith("authed/");
    const { counts, skipped } = await createMissingDocumentMetadata(
      firestore, space.spacePath, index,
      {
        rtdbRoot: space.rtdbRoot, readNode: reader.readNode,
        resolveCurriculum: portalBacked ? resolveFromPortal : async (id: string) => resolveFromOfferingId(id)
      },
      { dryRun }
    );
    for (const bucket of Object.keys(totals) as CreateBucket[]) totals[bucket] += counts[bucket];
    for (const s of skipped) {
      allSkipped[s.reason] = (allSkipped[s.reason] ?? 0) + 1;
      everySkipped.push({ ...s, space: space.label });
    }
  }

  console.log("\ndone", JSON.stringify(totals, null, 2));
  console.log("skipped by reason", JSON.stringify(allSkipped, null, 2));

  // Age of what was declined, so a decision about the residue rests on numbers rather than a guess.
  const byYear: Record<string, number> = {};
  let newest = 0;
  for (const s of everySkipped) {
    if (!s.createdAt) { byYear["(no createdAt)"] = (byYear["(no createdAt)"] ?? 0) + 1; continue; }
    const year = new Date(s.createdAt).toISOString().slice(0, 4);
    byYear[year] = (byYear[year] ?? 0) + 1;
    newest = Math.max(newest, s.createdAt);
  }
  console.log("skipped by year created", JSON.stringify(Object.fromEntries(
    Object.entries(byYear).sort()
  ), null, 2));
  if (newest) console.log(`newest skipped document: ${new Date(newest).toISOString().slice(0, 10)}`);
  const reportPath = getScriptRootFilePath(kSkipReportFile);
  nodeFs.mkdirSync(getScriptRootFilePath(kOutputDir), { recursive: true });
  nodeFs.writeFileSync(reportPath, JSON.stringify(everySkipped, null, 2));
  console.log(`skipped documents written to ${reportPath}`);
  if (dryRun) console.log("DRY RUN — set APPLY=1 to write");
  process.exit(0);
}

// Run only when invoked directly (via tsx), never when imported by the Jest test.
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
