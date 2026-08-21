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
  const curriculumFor = async (offeringId: string): Promise<ICurriculumPosition | undefined> => {
    if (curriculumByOffering.has(offeringId)) return curriculumByOffering.get(offeringId);
    const resolved = resolveCurriculum ? await resolveCurriculum(offeringId) : undefined;
    if (resolved?.unit) curriculumByOffering.set(offeringId, resolved);
    return resolved?.unit ? resolved : undefined;
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
  if (dryRun) log("DRY RUN — set APPLY=1 to write");

  return { counts, skipped };
}
