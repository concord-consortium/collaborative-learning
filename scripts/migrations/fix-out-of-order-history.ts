// Repairs stored document histories in which an entry that changes a tile comes before the entry
// that creates the tile. Playback can't move back past such a tile's creation, and a plain
// JSON-patch replay from the start can't apply the change. The known source is the DataFlow tile's
// Live Output mirror on mount, whose entry could complete while the entry adding the tile was still
// recording. See docs/history-framework/start-editing-entry.md.
//
// For each such entry, the script moves it to just after the entry that creates its tile. The
// entries keep their ids and content. Within the span from the first moved entry to the last entry
// that creates one of their tiles, the entries swap their `index` values to match the new order and
// get `previousEntryId`s that follow it, as does the entry after the span. A document's
// `lastHistoryEntry`, when it has one, is updated when the span ends the history. The writes run in
// one transaction per document, which gives up if a new entry has been stored since the history was
// loaded.
//
// The script skips the whole document, and says why, when it can't make the change safely:
// - an entry that changes a tile before its creation also changes a tile no later entry creates, or
//   something outside the tiles it waits on, so an entry between its old and new places could
//   depend on it;
// - an entry changes tiles that different entries create;
// - a change replaces the whole tile map while an entry waits on a tile;
// - entries in the span share an index, or the stored `previousEntryId` chain doesn't follow the
//   index order there;
// - the history changed recently enough that someone may still be editing it, or changed while the
//   script was checking it.
//
// An editor left open on a document across a repair keeps its own copy of the history. When the
// reordered span ends the history, the next entry it stores names the old last entry as its
// `previousEntryId`. Its `index` is still right, and playback orders entries by `index`.
//
// Usage (from the repository root; dry run unless --apply is given):
//
//   npx --prefix scripts tsx scripts/migrations/fix-out-of-order-history.ts --root authed/learn_concord_org
//   npx --prefix scripts tsx scripts/migrations/fix-out-of-order-history.ts --root authed/learn_concord_org --apply
//
// Options:
//   --root <path>         Firestore root that holds the `documents` collection, e.g. authed/learn_concord_org,
//                         demo/<name> or qa/<uid>. Required.
//   --doc <id>            Check only this document (repeatable).
//   --tile-type <type>    Check only documents whose `tools` include this tile type. Default: Dataflow.
//                         `tools` lists the tile types in the current content, so this misses a
//                         document whose DataFlow tile was deleted after the entries were stored.
//   --any-tile-type       Check every document under the root. This reads every document's
//                         history; try it on a subset first, with --limit or --doc.
//   --limit <n>           Stop after checking this many documents.
//   --min-idle-minutes <n> Skip a document whose newest entry is younger than this. Default: 60.
//   --apply               Write the changes. Without it, the script only reports them.
//
// It writes a JSON report to scripts/output/. It needs scripts/serviceAccountKey.json (see
// scripts/README.md), and authenticates as a service account, so the Firestore rules don't apply.
// Run it against staging first, by swapping in the staging key as "Local Setup" in
// scripts/README.md describes.

import type { DocumentReference, DocumentSnapshot, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";

interface IPatch {
  op: string;
  path: string;
  value?: any;
}

interface IRecord {
  patches?: IPatch[];
  inversePatches?: IPatch[];
}

/** A history entry as stored in a Firestore history document. */
export interface IStoredEntry {
  /** The Firestore document id, which is the entry's id. */
  docId: string;
  index: number;
  previousEntryId?: string;
  /** Milliseconds since the epoch, from the server timestamp, when there is one. */
  created?: number;
  /** The entry's action, for the report. */
  action?: string;
  records: IRecord[];
}

/** One entry moved to just after the entry that creates its tile. */
export interface IEntryMove {
  entryId: string;
  action?: string;
  /** The entry that creates the tile, which the moved entry now follows. */
  afterEntryId: string;
  afterAction?: string;
  tileIds: string[];
  /** How many places the entry moved. */
  distance: number;
}

/** A change to one history document. */
export interface IEntryWrite {
  docId: string;
  index?: number;
  /** The new previous entry. Null when the entry is now the first, so it has none. */
  previousEntryId?: string | null;
}

export interface IRepairPlan {
  moves: IEntryMove[];
  writes: IEntryWrite[];
  /** The new last entry, when the change reaches the end of the history. */
  lastEntry?: { id: string; index: number };
  /** Why the document can't be repaired safely, when it can't. */
  skipped?: string;
}

const kTileMapPath = "/content/tileMap";

function unescapeSegment(segment: string) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * The tile a patch path points into: `{ tileId, inside: false }` for the tile itself and
 * `inside: true` for anything below it. Undefined for paths outside the tile map.
 */
export function tilePathInfo(path: string) {
  if (!path.startsWith(`${kTileMapPath}/`)) return undefined;
  const [segment, ...rest] = path.slice(kTileMapPath.length + 1).split("/");
  return { tileId: unescapeSegment(segment), inside: rest.length > 0 };
}

/** The tile ids in a patch that sets the whole content or the whole tile map, if it is one. */
function tileMapKeys(patch: IPatch): string[] | undefined {
  if (patch.op !== "add" && patch.op !== "replace") return undefined;
  if (patch.path === kTileMapPath) return Object.keys(patch.value ?? {});
  if (patch.path === "/content" || patch.path === "") {
    const content = patch.path === "" ? patch.value?.content : patch.value;
    return Object.keys(content?.tileMap ?? {});
  }
  return undefined;
}

const allPatches = (entry: IStoredEntry) =>
  entry.records.flatMap(record => [...(record.patches ?? []), ...(record.inversePatches ?? [])]);
const forwardPatches = (entry: IStoredEntry) => entry.records.flatMap(record => record.patches ?? []);
const skip = (skipped: string): IRepairPlan => ({ moves: [], writes: [], skipped });

/**
 * Finds the entries that change a tile before the entry that creates it, and plans the writes that
 * move each one to just after that entry. `entries` must be in stored order (by `index`, then id).
 */
export function planHistoryRepair(entries: IStoredEntry[]): IRepairPlan {
  // Whether each tile exists at the current position. A tile that is absent from the map has not
  // been seen, so it may be in the content the history starts from.
  const exists = new Map<string, boolean>();
  // For each tile changed before it exists, the entries that changed it, in order.
  const waiting = new Map<string, number[]>();
  // For each entry that waits on a creation, the tiles it waits on and the entries that create them.
  const waits = new Map<number, { tiles: Set<string>; creators: Map<string, number> }>();

  for (const [i, entry] of entries.entries()) {
    for (const patch of forwardPatches(entry)) {
      const keys = tileMapKeys(patch);
      if (keys) {
        // A whole tile map can create, keep or remove a waiting tile, and a tile it leaves out can
        // come back later with the same id, so the script can't tell which tile a waiting entry
        // changed.
        if (waiting.size > 0) {
          const [tileId, [waitingEntry]] = [...waiting.entries()][0];
          return skip(`entry ${entry.docId} replaces the whole tile map while entry ` +
            `${entries[waitingEntry].docId} waits on tile ${tileId}, so it can't tell which tile that entry changed`);
        }
        const present = new Set(keys);
        for (const tileId of [...exists.keys(), ...keys]) exists.set(tileId, present.has(tileId));
        continue;
      }
      const info = tilePathInfo(patch.path);
      if (!info) continue;
      if (!info.inside) {
        // MST records adding a new key to a map as `add` and setting an existing key as `replace`,
        // so only an `add` creates the tile. A `replace` or `remove` of a waiting tile means it
        // existed all along, in the content the history starts from, and its earlier changes are
        // where they belong.
        if (patch.op === "add") {
          for (const w of waiting.get(info.tileId) ?? []) waits.get(w)?.creators.set(info.tileId, i);
        }
        waiting.delete(info.tileId);
        exists.set(info.tileId, patch.op !== "remove");
      } else if (exists.get(info.tileId) !== true) {
        // A tile that hasn't been seen may exist in the starting content; it only counts as missing
        // if a later entry creates it, which is checked when the waits are resolved.
        const list = waiting.get(info.tileId) ?? [];
        list.push(i);
        waiting.set(info.tileId, list);
        const wait = waits.get(i) ?? { tiles: new Set<string>(), creators: new Map<string, number>() };
        wait.tiles.add(info.tileId);
        waits.set(i, wait);
      }
    }
  }

  // Entries whose tiles are all created later. A tile that is never created was in the starting
  // content, so an entry that waits only on such tiles is fine where it is.
  const moves: { from: number; to: number; tiles: string[] }[] = [];
  for (const [i, wait] of waits) {
    const created = [...wait.tiles].filter(tileId => wait.creators.has(tileId));
    if (created.length === 0) continue;
    const { docId } = entries[i];
    // Moving the entry would pass the later changes to the tiles it changes that already exist.
    if (created.length !== wait.tiles.size) {
      return skip(`entry ${docId} changes a tile before it is created, and also a tile that no ` +
        `later entry creates, so it can't be moved safely`);
    }
    // Every patch, forward and inverse, must lie inside the tiles it waits on, so no entry between
    // its old and new positions can depend on it.
    const outside = allPatches(entries[i]).some(patch => {
      const info = tilePathInfo(patch.path);
      return !info || !info.inside || !wait.tiles.has(info.tileId);
    });
    if (outside) {
      return skip(`entry ${docId} changes a tile before it is created, and also changes something ` +
        `outside that tile, so it can't be moved safely`);
    }
    // Moving it after the last of several creations would pass the changes made to the tiles
    // created earlier, which can depend on it.
    const creators = new Set(wait.creators.values());
    if (creators.size > 1) {
      return skip(`entry ${docId} changes tiles that different entries create, so it can't be ` +
        `moved after all of them safely`);
    }
    moves.push({ from: i, to: [...creators][0], tiles: created });
  }
  if (moves.length === 0) return { moves: [], writes: [] };

  // The new order: each moved entry goes just after its creating entry, after any entry that moved
  // there before it.
  const movedFrom = new Set(moves.map(move => move.from));
  const after = new Map<number, number[]>();
  for (const move of [...moves].sort((a, b) => a.from - b.from)) {
    after.set(move.to, [...(after.get(move.to) ?? []), move.from]);
  }
  const order: number[] = [];
  entries.forEach((_, i) => {
    if (!movedFrom.has(i)) order.push(i);
    order.push(...(after.get(i) ?? []));
  });

  const start = Math.min(...moves.map(move => move.from));
  const end = Math.max(...moves.map(move => move.to));

  // Positions start..end hold the same entries in a new order. The entry after the span, if any,
  // gets a new previousEntryId, so the chain checks include it.
  const spanIndexes = entries.slice(start, end + 1).map(entry => entry.index);
  if (new Set(spanIndexes).size !== spanIndexes.length) {
    return skip("entries in the span to reorder share an index");
  }
  for (let i = start; i <= Math.min(end + 1, entries.length - 1); i++) {
    const expected = i > 0 ? entries[i - 1].docId : undefined;
    if (i > 0 && entries[i].previousEntryId !== expected) {
      return skip(`entry ${entries[i].docId} has previousEntryId ${entries[i].previousEntryId}, ` +
        `not ${expected}, so the chain doesn't follow the index order`);
    }
  }

  const writes: IEntryWrite[] = [];
  for (let pos = start; pos <= Math.min(end + 1, entries.length - 1); pos++) {
    const entry = entries[order[pos]];
    const write: IEntryWrite = { docId: entry.docId };
    if (pos <= end && entry.index !== entries[pos].index) write.index = entries[pos].index;
    // The first entry keeps whatever its slot had: nothing in a new document's history, or the last
    // entry of the history it continues.
    const previousEntryId = pos > 0 ? entries[order[pos - 1]].docId : (entries[0].previousEntryId ?? null);
    if ((entry.previousEntryId ?? null) !== previousEntryId) write.previousEntryId = previousEntryId;
    if (write.index !== undefined || write.previousEntryId !== undefined) writes.push(write);
  }

  const lastPos = entries.length - 1;
  const lastEntry = end === lastPos
    ? { id: entries[order[lastPos]].docId, index: entries[lastPos].index }
    : undefined;

  return {
    moves: moves.map(move => ({
      entryId: entries[move.from].docId,
      action: entries[move.from].action,
      afterEntryId: entries[move.to].docId,
      afterAction: entries[move.to].action,
      tileIds: move.tiles,
      distance: move.to - move.from
    })),
    writes,
    lastEntry
  };
}

/**
 * Reduces a stored history document to what the plan needs. Patch values are dropped, except the
 * tile ids of a patch that sets the whole content or tile map, so a long history fits in memory.
 */
export function toStoredEntry(snapshot: Pick<DocumentSnapshot, "id" | "get">): IStoredEntry {
  const entryJson = snapshot.get("entry");
  const entry = typeof entryJson === "string" ? JSON.parse(entryJson) : (entryJson ?? {});
  const compact = (patch: IPatch): IPatch => {
    const keys = tileMapKeys(patch);
    if (!keys) return { op: patch.op, path: patch.path };
    const tileMap = Object.fromEntries(keys.map(key => [key, true]));
    return { op: patch.op, path: kTileMapPath, value: tileMap };
  };
  const created = snapshot.get("created");
  return {
    docId: snapshot.id,
    index: snapshot.get("index"),
    previousEntryId: snapshot.get("previousEntryId") ?? undefined,
    created: typeof created?.toMillis === "function" ? created.toMillis() : undefined,
    action: entry.action,
    records: (entry.records ?? []).map((record: IRecord) => ({
      patches: (record.patches ?? []).map(compact),
      inversePatches: (record.inversePatches ?? []).map(compact)
    }))
  };
}

export interface IDocumentResult {
  path: string;
  entries: number;
  moves: IEntryMove[];
  writes: number;
  skipped?: string;
}

interface IRepairOptions {
  root: string;
  docIds?: string[];
  tileType?: string;
  limit?: number;
  minIdleMinutes?: number;
  apply?: boolean;
  now?: number;
  log?: (message: string) => void;
  // The number of history entries loaded per query. Tests set it to check paging on short histories.
  pageSize?: number;
}

const kPageSize = 2000;

async function loadHistory(docRef: DocumentReference, pageSize: number) {
  const entries: IStoredEntry[] = [];
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = docRef.collection("history").orderBy("index").limit(pageSize);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    page.docs.forEach(doc => entries.push(toStoredEntry(doc)));
    if (page.size < pageSize) return entries;
    last = page.docs[page.docs.length - 1];
  }
}

/** Checks, and with `apply` repairs, the history of one document. */
export async function repairDocumentHistory(db: Firestore, docRef: DocumentReference,
    { apply = false, minIdleMinutes = 60, now = Date.now(), pageSize = kPageSize }: Partial<IRepairOptions> = {}
): Promise<IDocumentResult> {
  const entries = await loadHistory(docRef, pageSize);
  const plan = planHistoryRepair(entries);
  const result: IDocumentResult = {
    path: docRef.path, entries: entries.length, moves: plan.moves, writes: plan.writes.length,
    skipped: plan.skipped
  };
  if (plan.skipped || plan.writes.length === 0) return result;

  // Not Math.max(...): a long history has more entries than a call can take as arguments.
  const newest = entries.reduce((max, entry) => Math.max(max, entry.created ?? 0), 0);
  if (now - newest < minIdleMinutes * 60 * 1000) {
    return { ...result, skipped: `the history changed less than ${minIdleMinutes} minutes ago` };
  }
  if (!apply) return result;

  // One transaction per document, so its history is never left half reordered. It reads the newest
  // entry and the metadata again first: an entry stored since the history was loaded would follow
  // the old order, and for a group document it moves `lastHistoryEntry` on.
  const { FieldValue } = await import("firebase-admin/firestore");
  const loadedNewest = entries[entries.length - 1].docId;
  const changed = await db.runTransaction(async transaction => {
    const [newestEntry, metadata] = await Promise.all([
      transaction.get(docRef.collection("history").orderBy("index", "desc").limit(1)),
      transaction.get(docRef)
    ]);
    if (newestEntry.docs[0]?.id !== loadedNewest) return true;
    for (const { docId, index, previousEntryId } of plan.writes) {
      const fields: Record<string, unknown> = {};
      if (index !== undefined) fields.index = index;
      if (previousEntryId !== undefined) fields.previousEntryId = previousEntryId ?? FieldValue.delete();
      transaction.update(docRef.collection("history").doc(docId), fields);
    }
    if (plan.lastEntry && metadata.get("lastHistoryEntry")) {
      transaction.update(docRef, { lastHistoryEntry: plan.lastEntry });
    }
    return false;
  });
  return changed ? { ...result, skipped: "the history changed while the script was checking it" } : result;
}

/** Checks, and with `apply` repairs, the histories of the documents under a root. */
export async function repairHistories(db: Firestore, options: IRepairOptions) {
  const { root, docIds, tileType, limit, log = console.log } = options;
  const documents = db.collection(`${root}/documents`);
  let refs: DocumentReference[];
  if (docIds?.length) {
    refs = docIds.map(id => documents.doc(id));
  } else {
    const query = tileType ? documents.where("tools", "array-contains", tileType) : documents;
    refs = (await query.select().get()).docs.map(doc => doc.ref);
  }
  if (limit !== undefined) refs = refs.slice(0, limit);
  log(`checking ${refs.length} documents under ${root}${options.apply ? "" : " (dry run)"}`);

  const results: IDocumentResult[] = [];
  for (const ref of refs) {
    let result: IDocumentResult;
    try {
      result = await repairDocumentHistory(db, ref, options);
    } catch (error) {
      // One document that fails is skipped, so the run still checks the rest and writes its report.
      const message = error instanceof Error ? error.message : String(error);
      result = { path: ref.path, entries: 0, moves: [], writes: 0, skipped: `failed: ${message}` };
    }
    results.push(result);
    if (result.moves.length || result.skipped) {
      const moved = result.moves.map(move => `${move.action} -> after ${move.afterAction}`).join("; ");
      log(`${ref.path}: ${result.skipped ? `skipped: ${result.skipped}` : `${result.moves.length} moved: ${moved}`}`);
    }
  }
  const repaired = results.filter(result => result.moves.length && !result.skipped);
  log(`${repaired.length} documents ${options.apply ? "repaired" : "to repair"}, ` +
    `${results.filter(result => result.skipped).length} skipped, ${results.length} checked`);
  return results;
}

export function parseArgs(argv: string[]): IRepairOptions {
  // An option that takes a value must have one. Otherwise `--limit` at the end of the command would
  // mean no limit at all.
  const operand = (i: number) => {
    const text = argv[i + 1];
    if (text === undefined || text.startsWith("--")) throw new Error(`${argv[i]} needs a value`);
    return text;
  };
  const value = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? operand(i) : undefined;
  };
  // A value that isn't a number would quietly turn a check off (`x < NaN` is false), so refuse it.
  const count = (name: string) => {
    const text = value(name);
    if (text === undefined) return undefined;
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} needs a number of 0 or more, not "${text}"`);
    return n;
  };
  const root = value("--root");
  if (!root) throw new Error("--root is required, e.g. --root authed/learn_concord_org");
  const docIds = argv.flatMap((arg, i) => arg === "--doc" ? [operand(i)] : []);
  return {
    root,
    docIds,
    tileType: argv.includes("--any-tile-type") ? undefined : (value("--tile-type") ?? "Dataflow"),
    limit: count("--limit"),
    minIdleMinutes: count("--min-idle-minutes") ?? 60,
    apply: argv.includes("--apply")
  };
}

async function main() {
  // Imported lazily so the Jest test can import this module without loading firebase-admin or the
  // import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const fs = await import("fs");
  const { getScriptRootFilePath } = await import("../lib/script-utils.js");
  const options = parseArgs(process.argv.slice(2));
  admin.initializeApp({ credential: admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json")) });
  const results = await repairHistories(admin.firestore(), options);
  const outputDir = getScriptRootFilePath("output");
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `${outputDir}/fix-out-of-order-history-${stamp}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ options, results }, null, 2));
  console.log(`report: ${reportPath}`);
  process.exit(0);
}

// Run only when invoked directly (via tsx), never when imported by the Jest test.
if (!process.env.JEST_WORKER_ID) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
