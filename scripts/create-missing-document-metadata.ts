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
  | "unresolvedCurriculum"; // offering-contained, but its unit/investigation/problem are unknown

export type ICreateCounts = Record<CreateBucket, number>;

const emptyCounts = (): ICreateCounts => ({
  created: 0, written: 0, alreadyPresent: 0, skippedNoContent: 0,
  skippedUnaddressable: 0, nodeUnreadable: 0, unresolvedCurriculum: 0
});

export interface ICurriculumPosition {
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
}

export interface ICreateMissingResult {
  counts: ICreateCounts;
  /** Keys skipped, with the reason, so a run says what it declined rather than only what it did. */
  skipped: Array<{ key: string; reason: CreateBucket }>;
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
  const skipped: Array<{ key: string; reason: CreateBucket }> = [];

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

  const skip = (key: string, reason: CreateBucket) => {
    counts[reason]++;
    skipped.push({ key, reason });
  };

  for (const [key, indexed] of index) {
    if (present.has(key)) { counts.alreadyPresent++; continue; }
    if (!indexed.hasContent) { skip(key, "skippedNoContent"); continue; }
    if (!isRtdbAddressable(indexed.classHash, indexed.uid, key)) {
      skip(key, "skippedUnaddressable");
      continue;
    }

    const nodePath =
      `${rtdbRoot}/classes/${indexed.classHash}/users/${indexed.uid}/documentMetadata/${key}`;
    const node = await readNode(nodePath);
    if (!node) { skip(key, "nodeUnreadable"); continue; }

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

    const originDoc = await originDocFor(node.type, indexed.classHash, key);
    if (originDoc != null) row.originDoc = originDoc;

    if (kOfferingContainedTypes.includes(node.type)) {
      const position = node.offeringId ? await curriculumFor(node.offeringId) : undefined;
      if (!position) {
        // Writing the row without these would place the document on the wrong container axis and
        // hand it to the offeringId backfill as new work. Report it and leave it alone.
        skip(key, "unresolvedCurriculum");
        continue;
      }
      row.offeringId = node.offeringId;
      row.unit = position.unit;
      row.investigation = position.investigation;
      row.problem = position.problem;
    }

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
      `unresolved curriculum ${counts.unresolvedCurriculum}`);

  return { counts, skipped };
}

async function main() {
  // Imported lazily so the Jest test can import createMissingDocumentMetadata without loading
  // firebase-admin or the import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const nodeFs = (await import("fs")).default;
  const { getScriptRootFilePath, getProblemDetails } = await import("./lib/script-utils.js");
  const {
    createRtdbReader, listSpacePaths, parseSpacesFilter, resolveDatabaseUrl, selectSpaces
  } = await import("./lib/repair-cli");
  const { buildRtdbDocumentIndex } = await import("./lib/rtdb-document-index");

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

  const resolveCurriculum = async (offeringId: string) => {
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

  const selection = selectSpaces(await listSpacePaths(firestore), filter);
  for (const { label, reason } of selection.refused) console.log(`- skipping ${label}: ${reason}`);
  for (const path of selection.unrecognized) console.log(`- unrecognized space path: ${path}`);
  for (const name of selection.filterMisses) console.log(`- SPACES named "${name}", which matches no space`);
  console.log(`- Running over ${selection.selected.length} spaces\n`);

  const totals = emptyCounts();
  const allSkipped: Record<string, number> = {};
  for (const space of selection.selected) {
    const { index, duplicates, classes } = await buildRtdbDocumentIndex(space.rtdbRoot, reader.readChildKeys);
    console.log(`  ${space.label}: ${classes} classes, ${index.size} indexed documents`);
    if (duplicates.length) {
      console.log(`  ${space.label}: ${duplicates.length} keys with more than one home — NOT created`);
    }
    // The portal fallback is only meaningful for spaces the portal actually backs. A demo space's
    // realtime root is `demo/<name>/portals/demo` and its offering ids are authored strings like
    // "m2s101", which learn.concord.org knows nothing about — asking would be noise, not recovery.
    const portalBacked = space.label.startsWith("authed/");
    const { counts, skipped } = await createMissingDocumentMetadata(
      firestore, space.spacePath, index,
      {
        rtdbRoot: space.rtdbRoot, readNode: reader.readNode,
        resolveCurriculum: portalBacked ? resolveCurriculum : undefined
      },
      { dryRun }
    );
    for (const bucket of Object.keys(totals) as CreateBucket[]) totals[bucket] += counts[bucket];
    for (const s of skipped) allSkipped[s.reason] = (allSkipped[s.reason] ?? 0) + 1;
  }

  console.log("\ndone", JSON.stringify(totals, null, 2));
  console.log("skipped by reason", JSON.stringify(allSkipped, null, 2));
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
