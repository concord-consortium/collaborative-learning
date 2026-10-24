import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {getDatabase} from "firebase-admin/database";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {initialize, projectConfig} from "./initialize";
import {callClueExport} from "./clue-export-call";
import {
  ExportOwner, ExportStores, InnerCursor, readGroupOwners, walk, WalkOperation, WalkRequest, WalkResult,
} from "../src/clue-export-walk";

jest.mock("firebase-functions/logger");

const {cleanup} = initialize();

const kBearer = "emulator-test-bearer";
process.env.CLUE_EXPORT_BEARER = kBearer;
process.env.CLUE_EXPORT_PORTALS = "learn.portal.staging.concord.org";

const kPortal = "learn.portal.staging.concord.org";
const kPortalKey = "learn_portal_staging_concord_org";
const kHash = "c".repeat(48);
const kOtherHash = "d".repeat(48);
const kStudent = "1234";
const kHistoryDoc = "doc701";
const kBigContent = "x".repeat(2 * 1024 * 1024);

// Duplicate and gapped indexes; the ids make (index, entryId) order differ from id order.
const kEntries = [
  {id: "e-g", index: 0}, {id: "e-c", index: 1}, {id: "e-d", index: 1}, {id: "e-a", index: 2},
  {id: "e-f", index: 4}, {id: "e-b", index: 4}, {id: "e-e", index: 5},
];
const kEntriesInOrder = ["e-g", "e-c", "e-d", "e-a", "e-b", "e-f", "e-e"];
const entryJson = (id: string) => JSON.stringify({id, created: 1700000000000, model: "TreeManager", records: [{}]});

const userOwner = (uid: string, offerings: number[], classHash = kHash): ExportOwner =>
  ({class_hash: classHash, uid, owner_type: "user", portal_class_id: 601, offerings});
const kUserOwner = userOwner(kStudent, [701]);
const kGroupOwner: ExportOwner =
  {class_hash: kHash, uid: "group_701_3", owner_type: "group", portal_class_id: 601, offerings: [701]};
const kClassOwner: ExportOwner =
  {class_hash: kHash, uid: `class_${kHash}`, owner_type: "class", portal_class_id: 601, offerings: [701]};

const usersPath = (classHash = kHash) => `/authed/portals/${kPortalKey}/classes/${classHash}/users`;
const documentsPath = `authed/${kPortalKey}/documents`;

interface SeedDocument {
  uid: string;
  docId: string;
  classHash?: string;
  firestore?: Record<string, unknown>;
  rtdb?: Record<string, unknown>;
  content?: Record<string, unknown>;
}

const seedDocument = async ({uid, docId, classHash = kHash, firestore, rtdb, content}: SeedDocument) => {
  if (firestore) {
    await getFirestore().doc(`${documentsPath}/${docId}`)
      .set({key: docId, uid, context_id: classHash, type: "problem", ...firestore});
  }
  if (rtdb) {
    await getDatabase().ref(`${usersPath(classHash)}/${uid}/documentMetadata/${docId}`)
      .set({version: "1.0", type: "problem", ...rtdb});
  }
  if (content) {
    await getDatabase().ref(`${usersPath(classHash)}/${uid}/documents/${docId}`).set(content);
  }
};

const seedHistory = async (docId: string) => {
  let previous: string | null = null;
  for (const {id, index} of kEntries) {
    await getFirestore().doc(`${documentsPath}/${docId}/history/${id}`).set({
      index, previousEntryId: previous, created: Timestamp.fromMillis(1700000000000 + index), entry: entryJson(id),
    });
    previous = id;
  }
};

const seed = async () => {
  await seedDocument({uid: kStudent, docId: kHistoryDoc, firestore: {offeringId: "701", title: "Problem 1.1",
    tools: ["Text"], visibility: "private", unit: "msa", investigation: "1", problem: "1", network: "net1"},
  rtdb: {offeringId: "701", createdAt: 1700000000000},
  content: {version: "1.0", type: "problem", content: kBigContent, changeCount: 3, lastHistoryEntryId: "e-e",
    self: {uid: kStudent, documentKey: kHistoryDoc, classHash: kHash}}});
  await seedDocument({uid: kStudent, docId: "doc702", firestore: {offeringId: "702"}, rtdb: {offeringId: "702"}});
  await seedDocument({uid: kStudent, docId: "docnone", firestore: {offeringId: ""}, rtdb: {offeringId: ""},
    content: {version: "1.0", type: "personal", content: "{}"}});
  await seedDocument({uid: kStudent, docId: "docfall", firestore: {offeringId: "702"}, rtdb: {offeringId: ""}});
  await seedDocument({uid: kStudent, docId: "docbad", rtdb: {offeringId: "seven"}});
  await seedDocument({uid: kStudent, docId: "docdisagree", firestore: {offeringId: "702", title: "fs"},
    rtdb: {offeringId: "701", title: "rtdb"}});
  await seedDocument({uid: kStudent, docId: "docreverse", firestore: {offeringId: "701"}, rtdb: {offeringId: "702"}});
  await seedDocument({uid: kStudent, docId: "rtdbonly",
    rtdb: {offeringId: "701", title: "Only RTDB", groupId: "3", unit: "rtdbunit"}});
  await seedDocument({uid: kStudent, docId: "docotherclass", classHash: kOtherHash, firestore: {offeringId: ""}});
  await seedDocument({uid: kStudent, docId: "fsonly", firestore: {type: "personal", title: "Only Firestore"}});
  await seedHistory(kHistoryDoc);

  await seedDocument({uid: "group_701_3", docId: "gdoc701", firestore: {type: "group", offeringId: "701"},
    rtdb: {type: "group"}});
  await seedDocument({uid: "group_701_3", docId: "gdocbare", firestore: {type: "group"}, rtdb: {type: "group"}});
  await seedDocument({uid: "group_701_3", docId: "gdocstamped", rtdb: {type: "group", offeringId: "702"}});
  await seedDocument({uid: "group_702_4", docId: "gdoc702", firestore: {type: "group", offeringId: "702"},
    rtdb: {type: "group"}});
  await seedDocument({uid: "group_7010_9", docId: "gdoc7010", rtdb: {type: "group"}});
  await seedDocument({uid: `class_${kHash}`, docId: "cdoc", firestore: {type: "class"}});

  await seedDocument({uid: "1", docId: "m", firestore: {offeringId: "701"}});
  await seedDocument({uid: "1", docId: "n", firestore: {offeringId: "701"}});
  await seedDocument({uid: "2", docId: "a", firestore: {offeringId: "701"}});
  await seedDocument({uid: "2", docId: "b", firestore: {offeringId: "701"}});

  await seedDocument({uid: "77", docId: "solo", classHash: kOtherHash, firestore: {offeringId: "701"}});
  await seedHistory("solo");
  await seedDocument({uid: "77", docId: "solo2", classHash: kOtherHash, firestore: {offeringId: "701"}});
  await seedHistory("solo2");

  await seedDocument({uid: "99", docId: "0", rtdb: {offeringId: "701"},
    content: {version: "1.0", type: "learningLog", self: {uid: "99", documentKey: "0", classHash: kHash}}});
  await seedDocument({uid: "99", docId: "1", rtdb: {offeringId: "701"}});
  await seedDocument({uid: "98", docId: "9", rtdb: {offeringId: "701"}});
  await seedDocument({uid: "98", docId: "10", rtdb: {offeringId: "701"}});
  await seedDocument({uid: "88", docId: "num702", firestore: {offeringId: 702}});
  await seedDocument({uid: "88", docId: "num701", rtdb: {offeringId: 701}});
  await seedDocument({uid: "88", docId: "numfraction", firestore: {offeringId: 701.5}});
  await seedDocument({uid: "88", docId: "numsuffix", rtdb: {offeringId: "701x"}});
};

const stores = (): ExportStores => ({firestore: getFirestore(), database: getDatabase()});

const request = (operation: WalkOperation, owners: ExportOwner[], overrides: Partial<WalkRequest> = {}): WalkRequest =>
  ({operation, portal: kPortal, owners, inner_cursor: null, limit: 500, owner_limit: 250, read_limit: 5000,
    ...overrides});

// Drives the walk the way report-server does: resume at the stop owner with its cursor, or after it.
const walkAll = async (first: WalkRequest, budget?: number) => {
  const pages: WalkResult[] = [];
  let owners = first.owners;
  let cursor: InnerCursor | null = first.inner_cursor;
  while (owners.length > 0) {
    const page = await walk(stores(), {...first, owners, inner_cursor: cursor}, budget);
    pages.push(page);
    expect(pages.length).toBeLessThan(50);
    owners = owners.slice(page.owner_exhausted ? page.stop_owner_offset + 1 : page.stop_owner_offset);
    cursor = page.inner_cursor;
  }
  return pages;
};

const snapshotStores = async () => {
  const firestoreDocs: Record<string, unknown> = {};
  const documents = await getFirestore().collection(documentsPath).get();
  for (const doc of documents.docs) {
    firestoreDocs[doc.ref.path] = doc.data();
    const history = await doc.ref.collection("history").get();
    history.forEach((entry) => {
      firestoreDocs[entry.ref.path] = entry.data();
    });
  }
  return {rtdb: (await getDatabase().ref().get()).val(), firestore: firestoreDocs};
};

describe("clueExport walk", () => {
  beforeAll(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref().set(null);
    await seed();
  });

  afterAll(async () => {
    await cleanup();
  });

  it("documents keeps the owner's offering and offering-less documents from either store", async () => {
    const page = await walk(stores(), request("documents", [kUserOwner]));
    expect(page.items.map((item) => item.doc_id))
      .toEqual([kHistoryDoc, "docdisagree", "docnone", "fsonly", "rtdbonly"]);
    const byId = Object.fromEntries(page.items.map((item) => [item.doc_id, item]));
    expect(byId[kHistoryDoc]).toMatchObject({
      uid: kStudent, context_id: kHash, portal_class_id: 601, owner_type: "user", offering_id: 701,
      title: "Problem 1.1", tools: ["Text"], created_at: 1700000000000, metadata_sources: ["firestore", "rtdb"],
      visibility: "private", unit: "msa", investigation: "1", problem: "1", network: "net1", group_id: null,
    });
    expect(byId.docdisagree).toMatchObject({offering_id: 701, title: "fs"});
    expect(byId.docnone).toMatchObject({offering_id: null, tools: null});
    expect(byId.fsonly).toMatchObject({metadata_sources: ["firestore"], rtdb_metadata: null, type: "personal"});
    expect(byId.rtdbonly).toMatchObject({metadata_sources: ["rtdb"], firestore_metadata: null, title: "Only RTDB",
      offering_id: 701, group_id: "3", unit: "rtdbunit"});
    expect(page).toMatchObject({stop_owner_offset: 0, owner_exhausted: true, inner_cursor: null,
      served_owner_offsets: [0]});
  });

  it("documents reads numeric offerings, dropping one outside the owner's set and non-integers", async () => {
    const page = await walk(stores(), request("documents", [userOwner("88", [701])]));
    expect(page.items.map((item) => [item.doc_id, item.offering_id])).toEqual([["num701", 701]]);
  });

  it("documents reads RTDB metadata whose keys are all integers", async () => {
    const page = await walk(stores(), request("documents", [userOwner("99", [701])]));
    expect(page.items.map((item) => [item.doc_id, item.metadata_sources])).toEqual([["0", ["rtdb"]], ["1", ["rtdb"]]]);
  });

  it("documents reads a group's offering from metadata and keeps one with none", async () => {
    const page = await walk(stores(), request("documents", [kGroupOwner, kClassOwner]));
    expect(page.items.map((item) => [item.doc_id, item.owner_type, item.offering_id]))
      .toEqual([["gdoc701", "group", 701], ["gdocbare", "group", null], ["cdoc", "class", null]]);
    const otherGroup = {...kGroupOwner, uid: "group_702_4", offerings: [702]};
    expect((await walk(stores(), request("documents", [otherGroup]))).items.map((item) => item.doc_id))
      .toEqual(["gdoc702"]);
    expect((await walk(stores(), request("documents", [{...otherGroup, offerings: [701]}]))).items).toEqual([]);
    const stamped = await walk(stores(), request("documents", [{...kGroupOwner, offerings: [702]}]));
    expect(stamped.items.map((item) => [item.doc_id, item.offering_id]))
      .toEqual([["gdocbare", null], ["gdocstamped", 702]]);
  });

  it("the handler answers a walk and owners with the wire contract's envelopes", async () => {
    const headers = {Authorization: `Bearer ${kBearer}`};
    const documents = await callClueExport({headers, body: request("documents", [kUserOwner])});
    expect(documents.status).toBe(200);
    expect(documents.body).toEqual(await walk(stores(), request("documents", [kUserOwner])));

    const owners = await callClueExport({headers, body: {operation: "owners", portal: kPortal,
      classes: [{class_hash: kHash, offerings: [701]}]}});
    expect(owners).toEqual({status: 200,
      body: {success: true, groups: [{class_hash: kHash, uid: "group_701_3", offering: 701}]}});
  });

  it("the handler derives each owner's type from its uid", async () => {
    const owners = [kUserOwner, kGroupOwner, kClassOwner].map((owner) => {
      const untyped: Partial<ExportOwner> = {...owner};
      delete untyped.owner_type;
      return untyped;
    });
    const answer = await callClueExport({headers: {Authorization: `Bearer ${kBearer}`},
      body: {...request("documents", []), owners}});
    expect(answer.status).toBe(200);
    expect([...new Set(answer.body.items.map((item: any) => `${item.uid} ${item.owner_type}`))])
      .toEqual([`${kStudent} user`, "group_701_3 group", `class_${kHash} class`]);
  });

  it("history walked three at a time returns every entry once, in order, unsplit", async () => {
    const pages = await walkAll(request("history", [kUserOwner], {limit: 3}));
    const items = pages.flatMap((page) => page.items);
    expect(items.map((item) => item.entry_id)).toEqual(kEntriesInOrder);
    items.forEach((item) => expect(item.entry_json).toBe(entryJson(item.entry_id as string)));
    items.forEach((item) => {
      const seeded = kEntries.findIndex(({id}) => id === item.entry_id);
      const {index} = kEntries[seeded];
      expect(item).toMatchObject({idx: index, prev_entry_id: seeded === 0 ? null : kEntries[seeded - 1].id,
        server_created: new Date(1700000000000 + index).toISOString()});
    });
    expect(pages.length).toBeGreaterThan(2);
    expect(pages[0]).toMatchObject({owner_exhausted: false,
      inner_cursor: {docId: kHistoryDoc, index: 1, entryId: "e-d"}});
  });

  it("history stops inside a document at the read limit and resumes with no gap", async () => {
    const owner = userOwner("77", [701], kOtherHash);
    const first = await walk(stores(), request("history", [owner], {read_limit: 4}));
    expect(first.owner_exhausted).toBe(false);
    expect(first.items.length).toBeLessThan(kEntries.length);
    const pages = await walkAll(request("history", [owner], {read_limit: 4}));
    expect(pages.flatMap((page) => page.items).map((item) => item.entry_id))
      .toEqual([...kEntriesInOrder, ...kEntriesInOrder]);
  });

  it("documents stops at the item limit inside an owner and resumes from its cursor", async () => {
    const page = await walk(stores(), request("documents", [kUserOwner], {limit: 2}));
    expect(page.items.map((item) => item.doc_id)).toEqual([kHistoryDoc, "docdisagree"]);
    expect(page).toMatchObject({stop_owner_offset: 0, owner_exhausted: false, inner_cursor: {docId: "docdisagree"}});
    const rest = await walk(stores(), request("documents", [kUserOwner], {inner_cursor: page.inner_cursor}));
    expect(rest.items.map((item) => item.doc_id)).toEqual(["docnone", "fsonly", "rtdbonly"]);
  });

  it("history resumes across documents inside one owner with no gap", async () => {
    const pages = await walkAll(request("history", [userOwner("77", [701], kOtherHash)], {limit: 3}));
    const items = pages.flatMap((page) => page.items);
    expect(items.map((item) => [item.doc_id, item.entry_id])).toEqual([
      ...kEntriesInOrder.map((id) => ["solo", id]), ...kEntriesInOrder.map((id) => ["solo2", id]),
    ]);
  });

  it("content stops at the read limit", async () => {
    // The candidate read costs 8: seven Firestore documents and one RTDB node.
    const page = await walk(stores(), request("content", [kUserOwner], {read_limit: 9}));
    expect(page.items.map((item) => item.doc_id)).toEqual([kHistoryDoc]);
    expect(page).toMatchObject({owner_exhausted: false, inner_cursor: {docId: kHistoryDoc}});
  });

  it("history still reads one entry when the candidate reads already exceed the read limit", async () => {
    const page = await walk(stores(), request("history", [userOwner("77", [701], kOtherHash)], {read_limit: 1}));
    expect(page.items.map((item) => item.entry_id)).toEqual(["e-g"]);
    expect(page).toMatchObject({owner_exhausted: false, inner_cursor: {docId: "solo", index: 0, entryId: "e-g"}});
  });

  it("a budget stop at an owner boundary hands the next owner a fresh start", async () => {
    const owners = [userOwner("1", [701]), userOwner("2", [701])];
    const full = await walk(stores(), request("documents", owners));
    expect(full.items.map((item) => item.doc_id)).toEqual(["m", "n", "a", "b"]);
    const twoRows = full.items.slice(0, 2).reduce((sum, item) => sum + Buffer.byteLength(JSON.stringify(item)), 0);

    const stopped = await walk(stores(), request("documents", owners), twoRows);
    expect(stopped.items.map((item) => item.doc_id)).toEqual(["m", "n"]);
    expect(stopped).toMatchObject({stop_owner_offset: 0, owner_exhausted: true, inner_cursor: null,
      served_owner_offsets: [0]});

    const next = await walk(stores(), request("documents", owners.slice(1)), twoRows);
    expect(next.items.map((item) => item.doc_id)).toEqual(["a", "b"]);

    const resumed = await walk(stores(), request("documents", owners, {inner_cursor: {docId: "m"}}));
    expect(resumed.items.map((item) => item.doc_id)).toEqual(["n", "a", "b"]);
    expect(resumed.served_owner_offsets).toEqual([0, 1]);
  });

  it("a stop inside a later owner names that owner with its cursor", async () => {
    const owners = [userOwner("1", [701]), userOwner("2", [701])];
    const page = await walk(stores(), request("documents", owners, {limit: 3}));
    expect(page.items.map((item) => item.doc_id)).toEqual(["m", "n", "a"]);
    expect(page).toMatchObject({stop_owner_offset: 1, owner_exhausted: false, inner_cursor: {docId: "a"},
      served_owner_offsets: [0, 1]});
    const rest = await walk(stores(), request("documents", owners.slice(1), {inner_cursor: page.inner_cursor}));
    expect(rest.items.map((item) => item.doc_id)).toEqual(["b"]);
  });

  it("documents stops at the read limit before the next owner", async () => {
    // Owner "1" costs three reads: two Firestore documents and one RTDB node.
    const owners = [userOwner("1", [701]), userOwner("2", [701])];
    const page = await walk(stores(), request("documents", owners, {read_limit: 3}));
    expect(page.items.map((item) => item.doc_id)).toEqual(["m", "n"]);
    expect(page).toMatchObject({stop_owner_offset: 0, owner_exhausted: true, inner_cursor: null});
  });

  it("orders RTDB keys as strings and resumes past each one", async () => {
    const owner = userOwner("98", [701]);
    const page = await walk(stores(), request("documents", [owner]));
    expect(page.items.map((item) => item.doc_id)).toEqual(["10", "9"]);
    const pages = await walkAll(request("documents", [owner], {limit: 1}));
    expect(pages.flatMap((p) => p.items).map((item) => item.doc_id)).toEqual(["10", "9"]);
  });

  it("stops after owner_limit owners", async () => {
    const owners = [userOwner("1", [701]), userOwner("2", [701]), kUserOwner];
    const page = await walk(stores(), request("documents", owners, {owner_limit: 2}));
    expect(page.items.map((item) => item.doc_id)).toEqual(["m", "n", "a", "b"]);
    expect(page).toMatchObject({stop_owner_offset: 1, owner_exhausted: true, inner_cursor: null});
  });

  it("served_owner_offsets leaves out an owner that served nothing", async () => {
    const owners = [userOwner("1", [701]), userOwner("1", [999]), userOwner("2", [701])];
    const page = await walk(stores(), request("documents", owners));
    expect(page.served_owner_offsets).toEqual([0, 2]);
  });

  it("content reports a missing node and admits an oversized one whole and alone", async () => {
    const page = await walk(stores(), request("content", [kUserOwner]), 1000);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({doc_id: kHistoryDoc, found: true, type: "problem", version: "1.0",
      change_count: 3, last_history_entry_id: "e-e",
      self: {uid: kStudent, documentKey: kHistoryDoc, classHash: kHash}});
    expect(page.items[0].content_json).toBe(kBigContent);
    expect(page).toMatchObject({stop_owner_offset: 0, owner_exhausted: false, inner_cursor: {docId: kHistoryDoc}});

    const rest = await walk(stores(), request("content", [kUserOwner], {inner_cursor: {docId: kHistoryDoc}}));
    const byId = Object.fromEntries(rest.items.map((item) => [item.doc_id, item]));
    expect(Object.keys(byId)).toEqual(["docdisagree", "docnone", "fsonly", "rtdbonly"]);
    expect(byId.docnone).toMatchObject({found: true, content_json: "{}"});
    expect(byId.fsonly).toEqual({doc_id: "fsonly", uid: kStudent, context_id: kHash, found: false, type: null,
      version: null, change_count: null, last_history_entry_id: null, self: null, content_json: null});
  });

  it("content reports a node with no content string as found with null content", async () => {
    const page = await walk(stores(), request("content", [userOwner("99", [701])]));
    expect(page.items.map((item) => [item.doc_id, item.found, item.type, item.content_json]))
      .toEqual([["0", true, "learningLog", null], ["1", false, null, null]]);
  });

  it("owners returns exactly the groups of the requested offerings", async () => {
    const groups = await readGroupOwners(getDatabase(), {operation: "owners", portal: kPortal,
      classes: [{class_hash: kHash, offerings: [701]}]});
    expect(groups).toEqual([{class_hash: kHash, uid: "group_701_3", offering: 701}]);
    expect(await readGroupOwners(getDatabase(), {operation: "owners", portal: kPortal,
      classes: [{class_hash: kHash, offerings: [703]}, {class_hash: kOtherHash, offerings: [701]}]})).toEqual([]);
  });

  it("never writes", async () => {
    const before = await snapshotStores();
    const owners = [kUserOwner, kGroupOwner, kClassOwner, userOwner("1", [701]), userOwner("2", [701])];
    for (const operation of ["documents", "history", "content"] as const) {
      await walkAll(request(operation, owners, {limit: 2}));
    }
    await readGroupOwners(getDatabase(), {operation: "owners", portal: kPortal,
      classes: [{class_hash: kHash, offerings: [701, 702]}]});
    expect(await snapshotStores()).toEqual(before);
  });
});
