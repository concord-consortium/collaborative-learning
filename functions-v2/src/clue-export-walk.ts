import {FieldPath, Firestore, QueryDocumentSnapshot, Timestamp} from "firebase-admin/firestore";
import {Database} from "firebase-admin/database";
import {escapeKey} from "../../shared/shared";

export type WalkOperation = "documents" | "history" | "content";
export type OwnerType = "user" | "group" | "class";

export interface ExportOwner {
  class_hash: string;
  uid: string;
  owner_type: OwnerType;
  portal_class_id: number;
  offerings: number[];
}

export interface DocumentCursor {
  docId: string;
}

export interface HistoryCursor {
  docId: string;
  index: number;
  entryId: string;
}

export type InnerCursor = DocumentCursor | HistoryCursor;

export interface WalkRequest {
  operation: WalkOperation;
  portal: string;
  owners: ExportOwner[];
  inner_cursor: InnerCursor | null;
  limit: number;
  owner_limit: number;
  read_limit: number;
}

export interface WalkResult {
  success: true;
  items: Record<string, unknown>[];
  stop_owner_offset: number;
  inner_cursor: InnerCursor | null;
  owner_exhausted: boolean;
  served_owner_offsets: number[];
}

export interface OwnersClass {
  class_hash: string;
  offerings: number[];
}

export interface OwnersRequest {
  operation: "owners";
  portal: string;
  classes: OwnersClass[];
}

export interface GroupOwner {
  class_hash: string;
  uid: string;
  offering: number;
}

export interface ExportStores {
  firestore: Firestore;
  database: Database;
}

export const kMaxLimits = {limit: 500, owner_limit: 250, read_limit: 5000};
const kPageBudgetBytes = 8 * 1024 * 1024;

const kSegmentChars = "[^/.#$[\\]]";
export const kSegment = new RegExp(`^${kSegmentChars}+$`);
export const kGroupUid = new RegExp(`^group_\\d+_${kSegmentChars}+$`);

type Metadata = Record<string, unknown>;

interface Candidate {
  docId: string;
  firestore: Metadata | null;
  rtdb: Metadata | null;
  offering: number | null;
}

export const isObject = (value: unknown): value is Metadata =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPresent = (value: unknown) => (typeof value === "string" && value !== "") || typeof value === "number";

// `undefined` means the value names no integer offering, so the document is out of every scope.
const parseOffering = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isInteger(value) ? value : undefined;
  if (typeof value === "string" && /^\d+$/.test(value)) return parseInt(value, 10);
  return undefined;
};

const documentOffering = (firestore: Metadata | null, rtdb: Metadata | null) => {
  const value = [rtdb?.offeringId, firestore?.offeringId].find(isPresent);
  return value === undefined ? null : parseOffering(value);
};

// Years 1 to 9999: outside them toISOString writes a year a SQL TIMESTAMP cannot read.
const kMinIsoMillis = Date.parse("0001-01-01T00:00:00.000Z");
const kMaxIsoMillis = Date.parse("9999-12-31T23:59:59.999Z");

const isoFromMillis = (value: unknown) => {
  if (typeof value !== "number" || !(value >= kMinIsoMillis && value <= kMaxIsoMillis)) return null;
  return new Date(value).toISOString();
};

const fieldOf = (firestore: Metadata | null, rtdb: Metadata | null, field: string) =>
  firestore?.[field] !== undefined ? firestore[field] : (rtdb?.[field] ?? null);

const usersPath = (portal: string, classHash: string) =>
  `/authed/portals/${escapeKey(portal)}/classes/${classHash}/users`;

const ownerPath = (portal: string, owner: ExportOwner) => `${usersPath(portal, owner.class_hash)}/${owner.uid}`;

const documentsCollection = (portal: string) => `authed/${escapeKey(portal)}/documents`;

function toDocumentRow(owner: ExportOwner, candidate: Candidate) {
  const {docId, firestore, rtdb, offering} = candidate;
  const sources = [];
  if (firestore) sources.push("firestore");
  if (rtdb) sources.push("rtdb");
  return {
    doc_id: docId,
    uid: owner.uid,
    context_id: owner.class_hash,
    portal_class_id: owner.portal_class_id,
    owner_type: owner.owner_type,
    type: fieldOf(firestore, rtdb, "type"),
    visibility: fieldOf(firestore, rtdb, "visibility"),
    title: fieldOf(firestore, rtdb, "title"),
    unit: fieldOf(firestore, rtdb, "unit"),
    investigation: fieldOf(firestore, rtdb, "investigation"),
    problem: fieldOf(firestore, rtdb, "problem"),
    group_id: fieldOf(firestore, rtdb, "groupId"),
    network: fieldOf(firestore, rtdb, "network"),
    offering_id: offering,
    tools: Array.isArray(firestore?.tools) ? firestore.tools : null,
    created_at: fieldOf(firestore, rtdb, "createdAt"),
    metadata_sources: sources,
    firestore_metadata: firestore,
    rtdb_metadata: rtdb,
  };
}

function toContentRow(owner: ExportOwner, docId: string, node: unknown) {
  const found = isObject(node);
  const value = found ? node : {};
  return {
    doc_id: docId,
    uid: owner.uid,
    context_id: owner.class_hash,
    found,
    type: value.type ?? null,
    version: value.version ?? null,
    change_count: value.changeCount ?? null,
    last_history_entry_id: value.lastHistoryEntryId ?? null,
    self: value.self ?? null,
    content_json: typeof value.content === "string" ? value.content : null,
  };
}

export function toHistoryRow(docId: string, snap: {id: string, data(): Metadata | undefined}) {
  const stored = snap.data() ?? {};
  const entryJson = typeof stored.entry === "string" ? stored.entry : null;
  let parsed: unknown;
  let parseOk = false;
  if (entryJson !== null) {
    try {
      parsed = JSON.parse(entryJson);
      parseOk = true;
    } catch {
      parseOk = false;
    }
  }
  const entry = parseOk && isObject(parsed) ? parsed : {};
  const extracted = (value: unknown) => (parseOk ? value ?? null : null);
  return {
    doc_id: docId,
    entry_id: snap.id,
    idx: Number.isSafeInteger(stored.index) ? stored.index : null,
    prev_entry_id: stored.previousEntryId ?? null,
    server_created: stored.created instanceof Timestamp ? stored.created.toDate().toISOString() : null,
    created: parseOk ? isoFromMillis(entry.created) : null,
    model: extracted(entry.model),
    action_raw: extracted(entry.action),
    undoable: extracted(entry.undoable),
    state: extracted(entry.state),
    n_records: parseOk && Array.isArray(entry.records) ? entry.records.length : null,
    is_revert: parseOk ? entry.isRevert === true : null,
    entry_uid: parseOk && typeof entry.uid === "string" ? entry.uid : null,
    parse_ok: parseOk,
    entry_json: entryJson,
  };
}

class PageFull extends Error {}

export async function walk(stores: ExportStores, request: WalkRequest, budgetBytes = kPageBudgetBytes)
    : Promise<WalkResult> {
  const {operation, portal, owners, limit, owner_limit: ownerLimit, read_limit: readLimit} = request;
  const items: Record<string, unknown>[] = [];
  const served = new Set<number>();
  let bytes = 0;
  let reads = 0;
  let ownerCursor: InnerCursor | null = null;

  const checkBeforeRead = () => {
    if (items.length > 0 && (items.length >= limit || reads >= readLimit)) throw new PageFull();
  };
  const admit = (offset: number, item: Record<string, unknown>, cursor: InnerCursor) => {
    const size = Buffer.byteLength(JSON.stringify(item));
    if (items.length > 0 && (items.length >= limit || bytes + size > budgetBytes)) throw new PageFull();
    items.push(item);
    bytes += size;
    served.add(offset);
    ownerCursor = cursor;
  };

  const readCandidates = async (owner: ExportOwner) => {
    const [firestoreSnap, rtdbSnap] = await Promise.all([
      stores.firestore.collection(documentsCollection(portal))
        .where("context_id", "==", owner.class_hash)
        .where("uid", "==", owner.uid)
        .get(),
      stores.database.ref(`${ownerPath(portal, owner)}/documentMetadata`).get(),
    ]);
    reads += Math.max(1, firestoreSnap.size) + 1;
    const byId = new Map<string, {firestore: Metadata | null, rtdb: Metadata | null}>();
    firestoreSnap.forEach((doc) => byId.set(doc.id, {firestore: doc.data(), rtdb: null}));
    rtdbSnap.forEach((child) => {
      const metadata = child.val();
      const docId = child.key as string;
      if (isObject(metadata)) byId.set(docId, {firestore: byId.get(docId)?.firestore ?? null, rtdb: metadata});
    });
    const candidates: Candidate[] = [];
    for (const [docId, {firestore, rtdb}] of byId) {
      const offering = documentOffering(firestore, rtdb);
      if (offering === undefined) continue;
      if (offering !== null && !owner.offerings.includes(offering)) continue;
      candidates.push({docId, firestore, rtdb, offering});
    }
    return candidates.sort((a, b) => (a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0));
  };

  const walkHistory = async (offset: number, docId: string, start: HistoryCursor | null) => {
    const collection = stores.firestore.collection(`${documentsCollection(portal)}/${docId}/history`);
    let after = start ? [start.index, start.entryId] : null;
    for (;;) {
      checkBeforeRead();
      const batchSize = Math.max(1, Math.min(limit - items.length, readLimit - reads, kMaxLimits.limit));
      let query = collection.orderBy("index").orderBy(FieldPath.documentId());
      if (after) query = query.startAfter(...after);
      const snap = await query.limit(batchSize).get();
      reads += Math.max(1, snap.size);
      snap.docs.forEach((entry: QueryDocumentSnapshot) => {
        const index = entry.get("index");
        admit(offset, toHistoryRow(docId, entry), {docId, index, entryId: entry.id});
        after = [index, entry.id];
      });
      if (snap.size < batchSize) return;
    }
  };

  const walkOwner = async (offset: number, owner: ExportOwner) => {
    const cursor = offset === 0 ? request.inner_cursor : null;
    let candidates = await readCandidates(owner);
    if (cursor) {
      candidates = candidates.filter(({docId}) =>
        operation === "history" ? docId >= cursor.docId : docId > cursor.docId);
    }
    for (const candidate of candidates) {
      const {docId} = candidate;
      if (operation === "documents") {
        admit(offset, toDocumentRow(owner, candidate), {docId});
      } else if (operation === "content") {
        checkBeforeRead();
        const node = await stores.database.ref(`${ownerPath(portal, owner)}/documents/${docId}`).get();
        reads += 1;
        admit(offset, toContentRow(owner, docId, node.val()), {docId});
      } else {
        const start = cursor && docId === cursor.docId ? cursor as HistoryCursor : null;
        await walkHistory(offset, docId, start);
      }
    }
  };

  const lastOffset = Math.min(owners.length, ownerLimit) - 1;
  for (let offset = 0; offset <= lastOffset; offset++) {
    ownerCursor = null;
    try {
      checkBeforeRead();
      await walkOwner(offset, owners[offset]);
    } catch (e) {
      if (!(e instanceof PageFull)) throw e;
      const ownerServed = served.has(offset);
      return {
        success: true,
        items,
        stop_owner_offset: ownerServed ? offset : offset - 1,
        inner_cursor: ownerServed ? ownerCursor : null,
        owner_exhausted: !ownerServed,
        served_owner_offsets: [...served].sort((a, b) => a - b),
      };
    }
  }
  return {
    success: true,
    items,
    stop_owner_offset: lastOffset,
    inner_cursor: null,
    owner_exhausted: true,
    served_owner_offsets: [...served].sort((a, b) => a - b),
  };
}

export async function readGroupOwners(database: Database, request: OwnersRequest): Promise<GroupOwner[]> {
  const groups: GroupOwner[] = [];
  for (const {class_hash: classHash, offerings} of request.classes) {
    const reads = [...new Set(offerings)].map(async (offering) => {
      const prefix = `group_${offering}_`;
      const snap = await database.ref(usersPath(request.portal, classHash))
        .orderByKey().startAt(prefix).endAt(`${prefix}\uf8ff`).get();
      return Object.keys(snap.val() ?? {}).map((uid) => ({class_hash: classHash, uid, offering}));
    });
    groups.push(...(await Promise.all(reads)).flat());
  }
  return groups;
}
