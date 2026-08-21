#!/usr/bin/node

// Repairs `context_id` on Firestore document metadata whose stored class disagrees with the class the
// document actually lives in.
//
// A networked teacher commenting on another teacher's document used to mint a metadata row stamped
// with the commenter's class. Such a document then appears in the wrong teacher's Sort Work and throws
// when opened, because the realtime-database path built from it never existed.
//
// The repair is driven by an index of the realtime database, never by the legacy `contextId` field:
// of the 35 mismatches in production, 25 carry a legacy value equal to the true home and 10 carry the
// placeholder "ignored". Copying that field would fix 25 and leave 10 looking correct.
//
// Dry run (default, writes nothing):  npx tsx scripts/repair-document-context-id.ts
// Apply (performs the writes):        APPLY=1 npx tsx scripts/repair-document-context-id.ts
// Limit to named spaces:              SPACES=demo/CLUE,authed/learn_concord_org npx tsx ...

import type { Firestore } from "firebase-admin/firestore";
import type { IDocumentHome } from "./lib/rtdb-document-index";

/** Batched writes are capped well below Firestore's 500-operation limit. */
const kBatchSize = 400;

/**
 * `needsRepair` counts documents found to disagree; `written` counts only those whose commit resolved.
 * They differ on a dry run, and after a crash — where a report that overstates what landed is worse
 * than one that understates it.
 */
export type RepairBucket = "needsRepair" | "written" | "alreadyCorrect" | "notInIndex" | "uidMismatch";

export type IRepairCounts = Record<RepairBucket, number>;

export interface IContextIdRepair {
  key: string;
  type?: string;
  from?: string;
  to: string;
}

export interface IUidMismatch {
  key: string;
  stored?: string;
  indexed: string;
}

export interface IRepairContextIdResult {
  counts: IRepairCounts;
  /** Every rewrite, so a repair this small can be read in full rather than trusted. */
  repairs: IContextIdRepair[];
  /** Reported, never repaired — see the note in the uid check below. */
  uidMismatches: IUidMismatch[];
}

const emptyCounts = (): IRepairCounts =>
  ({ needsRepair: 0, written: 0, alreadyCorrect: 0, notInIndex: 0, uidMismatch: 0 });

export interface IRepairOptions {
  dryRun?: boolean;
  log?: (message: string) => void;
  pageSize?: number;
  batchSize?: number;
}

/**
 * Compare every Firestore metadata document in one space against the realtime-database index and
 * rewrite `context_id` where they disagree.
 *
 * Documents whose key is absent from the index are left alone: they are Firestore-native rows such as
 * multi-class teacher supports, which never had a realtime-database node, so there is no home to
 * compare against and nothing to repair.
 */
export async function repairDocumentContextId(
  firestore: Firestore,
  spacePath: string,
  index: Map<string, IDocumentHome>,
  { dryRun = true, log = console.log, pageSize = 500, batchSize = kBatchSize }: IRepairOptions = {}
): Promise<IRepairContextIdResult> {
  const counts = emptyCounts();
  const repairs: IContextIdRepair[] = [];
  const uidMismatches: IUidMismatch[] = [];

  let batch = firestore.batch();
  let batched = 0;

  const commit = async () => {
    if (!batched) return;
    await batch.commit();
    // Credited only now: a commit that throws leaves these uncounted, so the report can understate
    // what landed but never overstate it.
    counts.written += batched;
    batch = firestore.batch();
    batched = 0;
  };

  let lastDoc: any = null;
  for (;;) {
    let query: any = (firestore.collection(spacePath) as any)
      .select("key", "context_id", "uid", "type").limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const indexed = index.get(doc.id);
      if (!indexed) {
        counts.notInIndex++;
        continue;
      }

      // The uid axis was never analysed, and a wrong uid is a different bug with different
      // consequences. Surface it so it can be investigated; do not guess at a correction.
      if (data.uid !== indexed.uid) {
        counts.uidMismatch++;
        uidMismatches.push({ key: doc.id, stored: data.uid, indexed: indexed.uid });
      }

      if (data.context_id === indexed.classHash) {
        counts.alreadyCorrect++;
        continue;
      }

      counts.needsRepair++;
      repairs.push({ key: doc.id, type: data.type, from: data.context_id, to: indexed.classHash });

      if (!dryRun) {
        batch.update(firestore.doc(`${spacePath}/${doc.id}`), { context_id: indexed.classHash });
        if (++batched >= batchSize) await commit();
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < pageSize) break;
  }

  await commit();

  log(`${spacePath}: needs repair ${counts.needsRepair}, written ${counts.written}, ` +
      `already correct ${counts.alreadyCorrect}, not in index ${counts.notInIndex}, ` +
      `uid mismatches ${counts.uidMismatch}`);
  if (dryRun) log("DRY RUN — set APPLY=1 to write");

  return { counts, repairs, uidMismatches };
}
