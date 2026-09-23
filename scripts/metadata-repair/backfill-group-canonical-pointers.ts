#!/usr/bin/node

// Gives every group document's slot a canonical pointer, and deletes the duplicate group documents
// that a slot's pointer does not name.
//
// A group document created before 7.5.0 has no pointer at the path the app reads until a group member
// opens it: `findLegacy` in src/lib/db.ts finds the document by query and claims the pointer then.
// 7.3.0 and 7.4.0 wrote pointers at paths the app no longer reads (see `legacyGroupPointerRelativePaths`).
// This script makes the same claim for every slot at once, so that `findLegacy` can be removed without
// handing an unopened group a new, empty document.
//
// For each slot — one class, offering and group — the winner is the document the pointer already names,
// or, when there is no pointer yet, the one `findLegacy` would pick: the lowest document id, which is the
// order Firestore returns an unordered query in. Every other group document in the slot is a leftover of
// the creation race pointers were introduced to close, and is deleted from both the realtime database and
// Firestore. Every 7.3.0 and 7.4.0 pointer in the slot is deleted too, whichever document it names, so the
// pointer at the current path is the only one left.
//
// The app can still open a leftover: Sort Work lists every group document in the class. Deleting them
// anyway is acceptable because group documents have not yet been used by real classes, so a leftover
// holds no work anyone needs. That includes one marked `canonical` by 7.3.0 or 7.4.0, which those
// releases opened but 7.5.0 shows only in Sort Work; removing it, and the superseded pointers, keeps that
// legacy state from confusing a later reader of the database. For the same reason each deletion is backed
// up to scripts/output only as a convenience, not as a restore procedure. What does matter is that
// nothing else is deleted: each document is re-read just before its removal, and the run stops unless it
// is still a group document of the slot it was found in (`whyNotDeletable`).
//
// Anything this cannot confidently address is reported and left alone rather than guessed at: a slot
// containing a document with the wrong owner uid, or a slot whose pointer names a document outside it or
// has no document key.
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

/**
 * Where 7.3.0 and 7.4.0 kept a group slot's pointer, relative to its space root. 7.5.0 replaced the group
 * segment with the owner segment, and the app reads neither of these.
 */
export function legacyGroupPointerRelativePaths(
  { contextId, offeringId, groupId }: { contextId: string; offeringId: string; groupId: string }
): string[] {
  return [
    `classes/${contextId}/offerings/${offeringId}/groups/${groupId}/canonical/${kGroupPointerLabel}`,
    `canonical/v1/classes/${contextId}/offerings/${offeringId}/groups/${groupId}/slots/${kGroupPointerLabel}`
  ];
}

/** A pointer document as stored, or undefined when there is none. */
export type StoredPointer = { documentKey: unknown } | undefined;

/** The fields of a group document's Firestore metadata this script reads. */
export interface IGroupDocRecord {
  key: string;
  contextId?: string;
  offeringId?: string;
  groupId?: string;
  uid?: string;
}

/**
 * Both values the generic document type has stored: `"group"` before the 7.5.0 rename and `"axes"`
 * since. A document still storing `"group"` is one `backfill-group-document-axes.ts` has not reached,
 * and it needs a pointer as much as any other, so this script does not depend on that one having run.
 */
export const kGroupDocumentTypes = ["group", "axes"];

/**
 * Every group-scoped document in one space's `documents` collection. `findLegacyGroupDocument` in
 * src/lib/db.ts filters on `groupId` alone; the type filter here adds nothing so long as only group
 * documents are ever given a `groupId`, and keeps anything else out if one ever is.
 */
export async function listGroupDocs(firestore: any, spacePath: string): Promise<IGroupDocRecord[]> {
  const snap = await firestore.collection(spacePath).where("type", "in", kGroupDocumentTypes).get();
  return snap.docs
    .filter((d: any) => !!d.get("groupId"))
    .map((d: any) => ({
      key: d.id, contextId: d.get("context_id"), offeringId: d.get("offeringId"),
      groupId: d.get("groupId"), uid: d.get("uid")
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
  | { action: "claim" | "pointed"; winner: string; losers: IGroupDocRecord[] }
  | { action: "dangling"; pointerKey: string }
  | { action: "invalid" };

/** What to do with one slot, given its pointer, if it has one. */
export function decideSlot(slot: ISlot, pointer: StoredPointer): SlotDecision {
  if (pointer && (typeof pointer.documentKey !== "string" || !pointer.documentKey)) {
    return { action: "invalid" };
  }
  const pointerKey = pointer?.documentKey as string | undefined;
  if (pointerKey !== undefined && !slot.docs.some(d => d.key === pointerKey)) {
    return { action: "dangling", pointerKey };
  }
  const winner = pointerKey ?? slot.docs[0].key;
  const losers = slot.docs.filter(doc => doc.key !== winner);
  return { action: pointerKey === undefined ? "claim" : "pointed", winner, losers };
}

/** One losing document: everywhere it is stored, and the slot it was found in. */
export interface IDeletionTarget {
  key: string;
  firestorePath: string;
  rtdbPaths: string[];
  slot: Pick<ISlot, "contextId" | "offeringId" | "groupId" | "uid">;
}

/**
 * Why the document about to be deleted is not the group document `target` describes, or undefined when
 * it is. `data` is its Firestore metadata, read just before the deletion. This is the last check before
 * anything is removed, so it re-derives every path rather than trusting how the target was built.
 */
export function whyNotDeletable(data: Record<string, any> | undefined, target: IDeletionTarget): string | undefined {
  const { key, slot } = target;
  if (!data) return "it has no Firestore metadata";
  if (!kGroupDocumentTypes.includes(data.type)) return `its type "${data.type}" is not a group document type`;
  if (data.context_id !== slot.contextId || data.offeringId !== slot.offeringId || data.groupId !== slot.groupId) {
    return "its class, offering or group is not the slot's";
  }
  if (slot.uid !== groupOwnerId(slot.offeringId, slot.groupId) || data.uid !== slot.uid) {
    return `its uid "${data.uid}" is not the group owner`;
  }
  if (!target.firestorePath.endsWith(`/documents/${key}`)) return "its Firestore path does not name it";
  const userPath = `/classes/${slot.contextId}/users/${slot.uid}`;
  const expected = [`${userPath}/documents/${key}`, `${userPath}/documentMetadata/${key}`];
  if (target.rtdbPaths.length !== expected.length || target.rtdbPaths.some((p, i) => !p.endsWith(expected[i]))) {
    return "its realtime-database paths are not the group owner's copies of it";
  }
  return undefined;
}

export interface ISpaceDeps {
  /** Every group-scoped document in the space. */
  listGroupDocs: () => Promise<IGroupDocRecord[]>;
  readPointer: (path: string) => Promise<StoredPointer>;
  /** Claims the slot for `key` unless it is already claimed; returns the pointer the slot holds after. */
  claim: (pointerPath: string, key: string) => Promise<StoredPointer>;
  /** Saves the document's current contents. Must throw rather than return if it cannot. */
  backup: (target: IDeletionTarget) => Promise<void>;
  /** Deletes the document everywhere. Must throw, deleting nothing, if it is not what `target` says. */
  remove: (target: IDeletionTarget) => Promise<void>;
  removeLegacyPointer: (path: string) => Promise<void>;
  log?: (message: string) => void;
}

export interface ISpaceResult {
  label: string;
  slots: number;
  alreadyPointed: number;
  claimed: number;
  deleted: number;
  legacyPointersDeleted: number;
  skipped: ISkippedDoc[];
}

/** Claim and clean up every group slot in one space, or on a dry run count what would be done. */
export async function backfillSpace(
  space: ISelectedSpace, { dryRun }: { dryRun: boolean }, deps: ISpaceDeps
): Promise<ISpaceResult> {
  const { readPointer, claim, backup, remove, removeLegacyPointer, log = console.log } = deps;
  const spaceRoot = space.spacePath.replace(/\/documents$/, "");
  const { slots, skipped } = groupIntoSlots(await deps.listGroupDocs());
  const result: ISpaceResult = {
    label: space.label, slots: slots.length, alreadyPointed: 0, claimed: 0, deleted: 0, legacyPointersDeleted: 0,
    skipped
  };

  for (const slot of slots) {
    const pointerPath = `${spaceRoot}/${groupPointerRelativePath(slot)}`;
    const slotLabel = `class ${slot.contextId} offering ${slot.offeringId} group ${slot.groupId}`;
    let decision = decideSlot(slot, await readPointer(pointerPath));

    if (decision.action === "claim" && !dryRun) {
      const holder = await claim(pointerPath, decision.winner);
      // A group member opened the document between the read and the claim, and findLegacy got there
      // first. Their choice stands; decide again around it.
      if (holder?.documentKey !== decision.winner) decision = decideSlot(slot, holder);
    }
    if (decision.action === "invalid") {
      skipped.push(...slot.docs.map(d => ({
        key: d.key, reason: `the pointer for ${slotLabel} exists but has no document key`
      })));
      continue;
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

    for (const loser of decision.losers) {
      const userPath = `${space.rtdbRoot}/classes/${slot.contextId}/users/${slot.uid}`;
      const target: IDeletionTarget = {
        key: loser.key,
        firestorePath: `${space.spacePath}/${loser.key}`,
        rtdbPaths: [`${userPath}/documents/${loser.key}`, `${userPath}/documentMetadata/${loser.key}`],
        slot: { contextId: slot.contextId, offeringId: slot.offeringId, groupId: slot.groupId, uid: slot.uid }
      };
      if (!dryRun) {
        await backup(target);
        await remove(target);
      }
      result.deleted++;
      log(`  ${dryRun ? "would delete" : "deleted"} ${loser.key} (${slotLabel} keeps ${decision.winner})`);
    }

    // The pointer at the current path is now the only one naming the winner. Removed after the losers,
    // so an interrupted run still has something left in this slot to find next time.
    for (const relativePath of legacyGroupPointerRelativePaths(slot)) {
      const legacyPath = `${spaceRoot}/${relativePath}`;
      const legacy = await readPointer(legacyPath);
      if (!legacy) continue;
      if (!dryRun) await removeLegacyPointer(legacyPath);
      result.legacyPointersDeleted++;
      log(`  ${dryRun ? "would delete" : "deleted"} legacy pointer ${legacyPath} ` +
        `(named ${JSON.stringify(legacy.documentKey)})`);
    }
  }

  return result;
}

/** What `createSpaceDeps` needs from Firebase and the file system. */
export interface IFirebaseHandles {
  firestore: any;
  database: any;
  reader: { readNode: (path: string) => Promise<unknown> };
  serverTimestamp: () => unknown;
  saveBackup: (space: ISelectedSpace, key: string, contents: unknown) => void;
}

/** The real reads and writes `backfillSpace` makes in one space. */
export function createSpaceDeps(
  { firestore, database, reader, serverTimestamp, saveBackup }: IFirebaseHandles, space: ISelectedSpace
): ISpaceDeps {
  return {
    listGroupDocs: () => listGroupDocs(firestore, space.spacePath),
    readPointer: async (pointerPath) => {
      const snap = await firestore.doc(pointerPath).get();
      return snap.exists ? { documentKey: snap.get("documentKey") } : undefined;
    },
    // The same transaction the app's legacy backfill runs (resolveCanonicalDocumentUncached in
    // src/lib/db.ts), with this script recorded as the claimant.
    claim: (pointerPath, key) => firestore.runTransaction(async (txn: any) => {
      const pointerRef = firestore.doc(pointerPath);
      const existing = await txn.get(pointerRef);
      if (existing.exists) return { documentKey: existing.get("documentKey") };
      txn.create(pointerRef, { documentKey: key, createdAt: serverTimestamp(), createdBy: kPointerCreatedBy });
      txn.update(firestore.doc(`${space.spacePath}/${key}`), { canonical: kGroupPointerLabel });
      return { documentKey: key };
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
      saveBackup(space, target.key, {
        target, firestore: firestoreDoc.exists ? firestoreDoc.data() : null, subcollections, rtdb
      });
    },
    // Realtime database first and Firestore last: an interrupted run leaves the Firestore row, so the
    // next run still finds the document and finishes removing it.
    remove: async (target) => {
      const docRef = firestore.doc(target.firestorePath);
      const snap = await docRef.get();
      const problem = whyNotDeletable(snap.exists ? snap.data() : undefined, target);
      if (problem) throw new Error(`refusing to delete ${target.firestorePath}: ${problem}`);
      for (const p of target.rtdbPaths) await database.ref(p).remove();
      await firestore.recursiveDelete(docRef);
    },
    removeLegacyPointer: async (pointerPath) => { await firestore.doc(pointerPath).delete(); }
  };
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
  console.log(`- Mode: ${dryRun ? "DRY RUN" : "APPLY — will claim pointers, delete duplicates and legacy pointers"}`);
  if (!dryRun) console.log(`- Backups: ${backupDir}`);

  const credential = admin.credential.cert(serviceAccountFile);
  admin.initializeApp({ credential, databaseURL });
  const firestore = admin.firestore();
  const database = admin.database();
  const reader = createRtdbReader(databaseURL, () => (credential as any).getAccessToken());
  const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
  const saveBackup = (space: ISelectedSpace, key: string, contents: unknown) => {
    const file = path.join(backupDir, space.label.replace(/\//g, "_"), `${key}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(contents, null, 2));
  };

  const selection = selectSpaces(await listSpacePaths(firestore), parseSpacesFilter(process.env.SPACES));
  console.log(`- Spaces: ${selection.selected.length}` +
    (selection.filteredOut ? `, ${selection.filteredOut} excluded by SPACES` : ""));
  for (const miss of selection.filterMisses) console.log(`  SPACES names no space: ${miss}`);
  for (const r of selection.refused) console.log(`  refused ${r.label}: ${r.reason}`);
  for (const u of selection.unrecognized) console.log(`  unrecognized space path: ${u}`);
  console.log("");

  const totals = { slots: 0, alreadyPointed: 0, claimed: 0, deleted: 0, legacyPointersDeleted: 0, skipped: 0 };
  for (const space of selection.selected) {
    const deps = createSpaceDeps({ firestore, database, reader, serverTimestamp, saveBackup }, space);

    // Held back so each space's details print under its own summary line.
    const details: string[] = [];
    const result = await backfillSpace(space, { dryRun }, { ...deps, log: (message) => details.push(message) });
    if (result.slots || result.skipped.length) {
      console.log(`${result.label}: ${result.slots} slots, ${result.alreadyPointed} already pointed, ` +
        `${result.claimed} ${dryRun ? "to claim" : "claimed"}, ` +
        `${result.deleted} duplicates ${dryRun ? "to delete" : "deleted"}, ` +
        `${result.legacyPointersDeleted} legacy pointers ${dryRun ? "to delete" : "deleted"}, ` +
        `${result.skipped.length} skipped`);
      for (const line of details) console.log(line);
      for (const s of result.skipped) console.log(`  skipped ${s.key}: ${s.reason}`);
    }
    totals.slots += result.slots;
    totals.alreadyPointed += result.alreadyPointed;
    totals.claimed += result.claimed;
    totals.deleted += result.deleted;
    totals.legacyPointersDeleted += result.legacyPointersDeleted;
    totals.skipped += result.skipped.length;
  }

  console.log(`\ntotal: ${totals.slots} slots, ${totals.alreadyPointed} already pointed, ` +
    `${totals.claimed} ${dryRun ? "to claim" : "claimed"}, ` +
    `${totals.deleted} duplicates ${dryRun ? "to delete" : "deleted"}, ` +
    `${totals.legacyPointersDeleted} legacy pointers ${dryRun ? "to delete" : "deleted"}, ${totals.skipped} skipped`);
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
