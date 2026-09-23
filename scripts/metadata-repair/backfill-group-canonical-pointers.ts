#!/usr/bin/node

// Gives every group document's slot a canonical pointer, and deletes the duplicate group documents
// that a slot's pointer does not name.
//
// A group document created before 7.5.0 has no pointer at the path the app reads until a group member
// opens it: `findLegacy` in src/lib/db.ts finds the document by query and claims the pointer then.
// Documents from before 7.3.0 never had a pointer. Documents from 7.3.0 and 7.4.0 have one at a path
// those releases used and the app no longer reads (`classes/<class>/offerings/<offering>/groups/<group>/
// canonical/default` in 7.3.0, `canonical/v1/classes/<class>/offerings/<offering>/groups/<group>/slots/
// default` in 7.4.0); the owner segment replaced the group segment in 7.5.0. This script makes the same
// claim for every slot at once, so that `findLegacy` can be removed without handing an unopened group a
// new, empty document. Pointers at the superseded paths are left where they are; nothing reads them.
//
// For each slot — one class, offering and group — the winner is the document the pointer already names,
// or, when there is no pointer yet, the one `findLegacy` would pick: the lowest document id, which is the
// order Firestore returns an unordered query in. Every other group document in the slot is a leftover of
// the creation race pointers were introduced to close. Nothing in the app opens one, so they are
// deleted — each backed up first to scripts/output — from both the realtime database and Firestore.
//
// Anything this cannot confidently address is reported and left alone rather than guessed at: a slot
// containing a document with the wrong owner uid, a pointer naming a document outside its slot, or a
// losing document that is already marked canonical.
//
// Covers `authed` and `demo` spaces. `qa` and `dev` have had their realtime-database side purged and
// hold only test data, so they are not listed at all.
//
// Dry run (default, writes nothing):  npx tsx scripts/metadata-repair/backfill-group-canonical-pointers.ts
// Apply (claims and deletes):         APPLY=1 npx tsx scripts/metadata-repair/backfill-group-canonical-pointers.ts
// Limit to some spaces:               SPACES=demo/CLUE,authed/learn_concord_org npx tsx ...
//
// Requires a Firebase service account key at scripts/serviceAccountKey.json (see scripts/README.md).

import { isRtdbAddressable } from "./lib/rtdb-document-index";
import type { ISelectedSpace } from "./lib/repair-cli";

/**
 * The label of a group's one canonical slot. Repeated from `kDefaultCanonicalDocumentLabel` in
 * src/lib/scoped-document-pointers.ts, because scripts/ does not resolve modules from src; the unit
 * test keeps the two in step.
 */
export const kGroupPointerLabel = "default";

/** Recorded on each pointer this script writes, where the app records the user who claimed it. */
export const kPointerCreatedBy = "backfill-group-canonical-pointers";

/** The synthetic uid owning a group's documents. Repeated from `getGroupOwnerId` in document-axes.ts. */
export function groupOwnerId(offeringId: string, groupId: string): string {
  return `group_${offeringId}_${groupId}`;
}

/**
 * A group slot's pointer path, relative to its space root. Repeated from `getCanonicalPointerPath` in
 * src/lib/scoped-document-pointers.ts for an offering-contained, label "default" slot.
 */
export function groupPointerRelativePath(
  { contextId, offeringId, uid }: { contextId: string; offeringId: string; uid: string }
): string {
  return `canonical/v1/classes/${contextId}/offerings/${offeringId}/owners/${uid}/slots/${kGroupPointerLabel}`;
}

/** The fields of a group document's Firestore metadata this script reads. */
export interface IGroupDocRecord {
  key: string;
  contextId?: string;
  offeringId?: string;
  groupId?: string;
  uid?: string;
  canonical?: string;
}

/**
 * Both values the generic document type has stored: `"group"` before the 7.5.0 rename and `"axes"`
 * since. A document still storing `"group"` is one `backfill-group-document-axes.ts` has not reached,
 * and it needs a pointer as much as any other, so this script does not depend on that one having run.
 */
export const kGroupDocumentTypes = ["group", "axes"];

/** Every group-scoped document in one space's `documents` collection. */
export async function listGroupDocs(firestore: any, spacePath: string): Promise<IGroupDocRecord[]> {
  const snap = await firestore.collection(spacePath).where("type", "in", kGroupDocumentTypes).get();
  return snap.docs
    .filter((d: any) => !!d.get("groupId"))
    .map((d: any) => ({
      key: d.id, contextId: d.get("context_id"), offeringId: d.get("offeringId"),
      groupId: d.get("groupId"), uid: d.get("uid"), canonical: d.get("canonical")
    }));
}

export interface ISlot {
  contextId: string;
  offeringId: string;
  groupId: string;
  uid: string;
  /** Sorted by key, in the order findLegacy's query returns them. */
  docs: IGroupDocRecord[];
}

export interface ISkippedDoc {
  key: string;
  reason: string;
}

/**
 * Sort the way Firestore orders document ids. Firestore compares ids by their UTF-8 bytes; JavaScript's
 * `<` compares UTF-16 code units. The two agree for the ASCII push ids CLUE mints, which is all that can
 * be in these slots. `localeCompare` would not agree, and would pick a different winner than findLegacy.
 */
const byKey = (a: IGroupDocRecord, b: IGroupDocRecord) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * Group documents into the slots findLegacy would search.
 *
 * A document that cannot be placed in a slot is skipped on its own: findLegacy's query, which matches on
 * class, offering and group, cannot find it either. A document that can be placed but is wrong in some
 * other way skips its whole slot, because dropping it alone could change which document wins.
 */
export function groupIntoSlots(docs: IGroupDocRecord[]): { slots: ISlot[]; skipped: ISkippedDoc[] } {
  const skipped: ISkippedDoc[] = [];
  const bySlot = new Map<string, ISlot>();

  for (const doc of docs) {
    const { contextId, offeringId, groupId } = doc;
    if (!contextId || !offeringId || !groupId) {
      skipped.push({ key: doc.key, reason: "missing context_id, offeringId or groupId" });
      continue;
    }
    const slotKey = JSON.stringify([contextId, offeringId, groupId]);
    let slot = bySlot.get(slotKey);
    if (!slot) {
      slot = { contextId, offeringId, groupId, uid: groupOwnerId(offeringId, groupId), docs: [] };
      bySlot.set(slotKey, slot);
    }
    slot.docs.push(doc);
  }

  const slots: ISlot[] = [];
  for (const slot of bySlot.values()) {
    slot.docs.sort(byKey);
    const problems = new Map<string, string>();
    for (const doc of slot.docs) {
      if (doc.uid !== slot.uid) {
        problems.set(doc.key, `uid "${doc.uid}" is not the group owner "${slot.uid}"`);
      } else if (!isRtdbAddressable(slot.contextId, slot.uid, doc.key)) {
        problems.set(doc.key, "cannot be addressed in the realtime database");
      }
    }
    if (!problems.size) {
      slots.push(slot);
      continue;
    }
    for (const doc of slot.docs) {
      skipped.push({ key: doc.key, reason: problems.get(doc.key) ?? "another document in its slot was skipped" });
    }
  }

  return { slots, skipped };
}

export type SlotDecision =
  | { action: "claim" | "pointed"; winner: string; losers: IGroupDocRecord[]; kept: ISkippedDoc[] }
  | { action: "dangling"; pointerKey: string };

/** What to do with one slot, given the key its pointer names, if it has one. */
export function decideSlot(slot: ISlot, pointerKey: string | undefined): SlotDecision {
  if (pointerKey !== undefined && !slot.docs.some(d => d.key === pointerKey)) {
    return { action: "dangling", pointerKey };
  }
  const winner = pointerKey ?? slot.docs[0].key;
  const losers: IGroupDocRecord[] = [];
  const kept: ISkippedDoc[] = [];
  for (const doc of slot.docs) {
    if (doc.key === winner) continue;
    // Only a claim sets `canonical`, in the same commit as the pointer, so a loser carrying it means
    // something happened this script does not understand.
    if (doc.canonical) {
      kept.push({ key: doc.key, reason: `marked canonical ("${doc.canonical}") but not named by its pointer` });
    } else {
      losers.push(doc);
    }
  }
  return { action: pointerKey === undefined ? "claim" : "pointed", winner, losers, kept };
}

/** One losing document: everywhere it is stored. */
export interface IDeletionTarget {
  key: string;
  firestorePath: string;
  /** Content first, then metadata, so an interrupted run leaves metadata pointing at nothing. */
  rtdbPaths: string[];
}

export interface ISpaceDeps {
  /** Every group-scoped document in the space. */
  listGroupDocs: () => Promise<IGroupDocRecord[]>;
  /** The document key a pointer names, or undefined when there is no pointer. */
  readPointer: (path: string) => Promise<string | undefined>;
  /** Claims the slot for `key` unless it is already claimed; returns the key the slot holds after. */
  claim: (pointerPath: string, key: string) => Promise<string>;
  /** Saves the document's current contents. Must throw rather than return if it cannot. */
  backup: (target: IDeletionTarget) => Promise<void>;
  remove: (target: IDeletionTarget) => Promise<void>;
  log?: (message: string) => void;
}

export interface ISpaceResult {
  label: string;
  slots: number;
  alreadyPointed: number;
  claimed: number;
  deleted: number;
  skipped: ISkippedDoc[];
}

/** Claim and clean up every group slot in one space, or on a dry run count what would be done. */
export async function backfillSpace(
  space: ISelectedSpace, { dryRun }: { dryRun: boolean }, deps: ISpaceDeps
): Promise<ISpaceResult> {
  const { readPointer, claim, backup, remove, log = console.log } = deps;
  const spaceRoot = space.spacePath.replace(/\/documents$/, "");
  const { slots, skipped } = groupIntoSlots(await deps.listGroupDocs());
  const result: ISpaceResult = {
    label: space.label, slots: slots.length, alreadyPointed: 0, claimed: 0, deleted: 0, skipped
  };

  for (const slot of slots) {
    const pointerPath = `${spaceRoot}/${groupPointerRelativePath(slot)}`;
    const slotLabel = `class ${slot.contextId} offering ${slot.offeringId} group ${slot.groupId}`;
    let decision = decideSlot(slot, await readPointer(pointerPath));

    if (decision.action === "claim" && !dryRun) {
      const holder = await claim(pointerPath, decision.winner);
      // A group member opened the document between the read and the claim, and findLegacy got there
      // first. Their choice stands; decide again around it.
      if (holder !== decision.winner) decision = decideSlot(slot, holder);
    }
    if (decision.action === "dangling") {
      skipped.push({
        key: decision.pointerKey, reason: `the pointer for ${slotLabel} names a document not in the slot`
      });
      continue;
    }

    if (decision.action === "claim") {
      result.claimed++;
      log(`  ${dryRun ? "would claim" : "claimed"} ${decision.winner} for ${slotLabel}`);
    } else {
      result.alreadyPointed++;
    }
    skipped.push(...decision.kept);

    for (const loser of decision.losers) {
      const userPath = `${space.rtdbRoot}/classes/${slot.contextId}/users/${slot.uid}`;
      const target: IDeletionTarget = {
        key: loser.key,
        firestorePath: `${space.spacePath}/${loser.key}`,
        rtdbPaths: [`${userPath}/documents/${loser.key}`, `${userPath}/documentMetadata/${loser.key}`]
      };
      if (!dryRun) {
        await backup(target);
        await remove(target);
      }
      result.deleted++;
      log(`  ${dryRun ? "would delete" : "deleted"} ${loser.key} (${slotLabel} keeps ${decision.winner})`);
    }
  }

  return result;
}

async function main() {
  // Imported lazily so the Jest test can import this module without loading firebase-admin or the
  // import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const fs = (await import("fs")).default;
  const path = (await import("path")).default;
  const { getScriptRootFilePath } = await import("../lib/script-utils.js");
  const {
    createRtdbReader, kOutputDir, listSpacePaths, parseSpacesFilter, resolveDatabaseUrl, selectSpaces
  } = await import("./lib/repair-cli");

  const dryRun = process.env.APPLY !== "1";
  const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountFile, "utf8"));
  const databaseURL = resolveDatabaseUrl(serviceAccount.project_id, process.env.DATABASE_URL);
  const backupDir = getScriptRootFilePath(
    `${kOutputDir}/group-pointer-backfill/${new Date().toISOString().replace(/[:.]/g, "-")}`);

  console.log(`- Firebase project: ${serviceAccount.project_id}`);
  console.log(`- Realtime Database URL: ${databaseURL}`);
  console.log(`- Mode: ${dryRun ? "DRY RUN" : "APPLY — will claim pointers and delete duplicates"}`);
  if (!dryRun) console.log(`- Backups: ${backupDir}`);

  const credential = admin.credential.cert(serviceAccountFile);
  admin.initializeApp({ credential, databaseURL });
  const firestore = admin.firestore();
  const database = admin.database();
  const reader = createRtdbReader(databaseURL, () => (credential as any).getAccessToken());

  const selection = selectSpaces(await listSpacePaths(firestore), parseSpacesFilter(process.env.SPACES));
  console.log(`- Spaces: ${selection.selected.length}` +
    (selection.filteredOut ? `, ${selection.filteredOut} excluded by SPACES` : ""));
  for (const miss of selection.filterMisses) console.log(`  SPACES names no space: ${miss}`);
  for (const r of selection.refused) console.log(`  refused ${r.label}: ${r.reason}`);
  for (const u of selection.unrecognized) console.log(`  unrecognized space path: ${u}`);
  console.log("");

  const totals = { slots: 0, alreadyPointed: 0, claimed: 0, deleted: 0, skipped: 0 };
  for (const space of selection.selected) {
    const deps: ISpaceDeps = {
      listGroupDocs: () => listGroupDocs(firestore, space.spacePath),
      readPointer: async (pointerPath) => {
        const snap = await firestore.doc(pointerPath).get();
        return snap.exists ? snap.get("documentKey") : undefined;
      },
      // The same transaction the app's legacy backfill runs (resolveCanonicalDocumentUncached in
      // src/lib/db.ts), with this script recorded as the claimant.
      claim: (pointerPath, key) => firestore.runTransaction(async (txn) => {
        const pointerRef = firestore.doc(pointerPath);
        const existing = await txn.get(pointerRef);
        if (existing.exists) return existing.get("documentKey") as string;
        txn.create(pointerRef, {
          documentKey: key, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: kPointerCreatedBy
        });
        txn.update(firestore.doc(`${space.spacePath}/${key}`), { canonical: kGroupPointerLabel });
        return key;
      }),
      // The Firestore metadata document has `comments` and `history` subcollections, which the removal
      // deletes with it, so they are saved too.
      backup: async (target) => {
        const docRef = firestore.doc(target.firestorePath);
        const firestoreDoc = await docRef.get();
        const subcollections: Record<string, Record<string, unknown>> = {};
        for (const collection of await docRef.listCollections()) {
          const entries: Record<string, unknown> = {};
          for (const entry of (await collection.get()).docs) entries[entry.id] = entry.data();
          subcollections[collection.id] = entries;
        }
        const rtdb: Record<string, unknown> = {};
        for (const p of target.rtdbPaths) rtdb[p] = await reader.readNode(p);
        const file = path.join(backupDir, space.label.replace(/\//g, "_"), `${target.key}.json`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({
          target, firestore: firestoreDoc.exists ? firestoreDoc.data() : null, subcollections, rtdb
        }, null, 2));
      },
      // Realtime database first and Firestore last: an interrupted run leaves the Firestore row, so the
      // next run still finds the document and finishes removing it.
      remove: async (target) => {
        for (const p of target.rtdbPaths) await database.ref(p).remove();
        await firestore.recursiveDelete(firestore.doc(target.firestorePath));
      }
    };

    // Held back so each space's details print under its own summary line.
    const details: string[] = [];
    const result = await backfillSpace(space, { dryRun }, { ...deps, log: (message) => details.push(message) });
    if (result.slots || result.skipped.length) {
      console.log(`${result.label}: ${result.slots} slots, ${result.alreadyPointed} already pointed, ` +
        `${result.claimed} ${dryRun ? "to claim" : "claimed"}, ` +
        `${result.deleted} duplicates ${dryRun ? "to delete" : "deleted"}, ${result.skipped.length} skipped`);
      for (const line of details) console.log(line);
      for (const s of result.skipped) console.log(`  skipped ${s.key}: ${s.reason}`);
    }
    totals.slots += result.slots;
    totals.alreadyPointed += result.alreadyPointed;
    totals.claimed += result.claimed;
    totals.deleted += result.deleted;
    totals.skipped += result.skipped.length;
  }

  console.log(`\ntotal: ${totals.slots} slots, ${totals.alreadyPointed} already pointed, ` +
    `${totals.claimed} ${dryRun ? "to claim" : "claimed"}, ` +
    `${totals.deleted} duplicates ${dryRun ? "to delete" : "deleted"}, ${totals.skipped} skipped`);
  if (dryRun) console.log("DRY RUN — set APPLY=1 to write");
  process.exit(0);
}

// Run only when invoked directly (via tsx), never when imported by a test.
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
