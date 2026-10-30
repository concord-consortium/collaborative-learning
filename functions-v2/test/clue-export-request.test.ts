import {Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {toHistoryRow} from "../src/clue-export-walk";
import {callClueExport} from "./clue-export-call";

jest.mock("firebase-functions/logger");

jest.mock("firebase-admin/database", () => ({
  getDatabase: () => ({
    ref: () => ({get: () => Promise.reject(Object.assign(new Error("denied"), {code: "PERMISSION_DENIED"}))}),
  }),
}));
jest.mock("firebase-admin/firestore", () => {
  const actual = jest.requireActual("firebase-admin/firestore");
  const query: any = {where: () => query, get: () => Promise.resolve({size: 0, forEach: () => undefined})};
  return {...actual, getFirestore: () => ({collection: () => query})};
});

const kBearer = "test-bearer-value";
const kPortal = "learn.portal.staging.concord.org";
const kHash = "a".repeat(48);

process.env.CLUE_EXPORT_BEARER = kBearer;
process.env.CLUE_EXPORT_PORTALS = `${kPortal},learn.concord.org`;

const call = callClueExport;

const authorized = {Authorization: `Bearer ${kBearer}`};

const owner = (overrides: Record<string, unknown> = {}) => ({
  class_hash: kHash, uid: "1234", portal_class_id: 601, offerings: [701], ...overrides,
});

const walkBody = (overrides: Record<string, unknown> = {}) => ({
  operation: "documents", portal: kPortal, owners: [owner()], inner_cursor: null,
  limit: 500, owner_limit: 250, read_limit: 5000, ...overrides,
});

const expectInvalid = async (body: unknown, field: string) => {
  const answer = await call({headers: authorized, body});
  expect(answer).toEqual({status: 400, body: {success: false, error: `${field} is invalid`}});
};

describe("clueExport request handling", () => {
  it("refuses a method other than POST", async () => {
    expect(await call({method: "GET", headers: authorized}))
      .toEqual({status: 405, body: {success: false, error: "method must be POST"}});
  });

  it.each([
    ["no header", {}],
    ["a wrong token", {Authorization: "Bearer wrong"}],
    ["a Basic header", {Authorization: "Basic x"}],
    ["a right token with a trailing space", {Authorization: `Bearer ${kBearer} `}],
    ["an empty token", {Authorization: "Bearer "}],
  ])("refuses %s with 401", async (_name, headers) => {
    const answer = await call({headers, body: walkBody()});
    expect(answer).toEqual({status: 401, body: {success: false, error: "unauthorized"}});
  });

  it("refuses an empty token when the secret is unset", async () => {
    process.env.CLUE_EXPORT_BEARER = "";
    try {
      expect((await call({headers: {Authorization: "Bearer "}, body: walkBody()})).status).toBe(401);
    } finally {
      process.env.CLUE_EXPORT_BEARER = kBearer;
    }
  });

  it("refuses a bearer sent as a query value, even with the right header", async () => {
    const answer = await call({headers: authorized, query: {bearer: kBearer}, body: walkBody()});
    expect(answer.status).toBe(400);
    expect(answer.body.error).toMatch(/Authorization header/);
  });

  it("refuses a bearer sent in the body, even with the right header", async () => {
    const answer = await call({headers: authorized, body: walkBody({bearer: kBearer})});
    expect(answer.status).toBe(400);
    expect(answer.body.error).toMatch(/Authorization header/);
  });

  it.each([
    ["body", "not an object"],
    ["operation", walkBody({operation: "delete"})],
    ["portal", walkBody({portal: "learn.example.com"})],
    ["owners", walkBody({owners: []})],
    ["owners", walkBody({owners: Array.from({length: 251}, () => owner())})],
    ["owners[0]", walkBody({owners: ["1234"]})],
    ["owners[0].class_hash", walkBody({owners: [owner({class_hash: "A".repeat(48)})]})],
    ["owners[0].class_hash", walkBody({owners: [owner({class_hash: "a".repeat(47)})]})],
    ["owners[0].uid", walkBody({owners: [owner({uid: "12a"})]})],
    ["owners[0].uid", walkBody({owners: [owner({uid: 1234})]})],
    ["owners[0].uid", walkBody({owners: [owner({uid: "group_x_3"})]})],
    ["owners[0].uid", walkBody({owners: [owner({uid: "group_701_a.b"})]})],
    ["owners[0].uid", walkBody({owners: [owner({uid: `class_${"b".repeat(48)}`})]})],
    ["owners[0].uid", walkBody({owners: [owner({uid: "group_701_"})]})],
    ["owners[0].uid", walkBody({owners: [owner({uid: "teacher"})]})],
    ["owners[0].portal_class_id", walkBody({owners: [owner({portal_class_id: 0})]})],
    ["owners[0].portal_class_id", walkBody({owners: [owner({portal_class_id: "601"})]})],
    ["owners[0].offerings", walkBody({owners: [owner({offerings: "701"})]})],
    ["owners[0].offerings", walkBody({owners: [owner({offerings: Array.from({length: 1001}, (_, i) => i)})]})],
    ["owners[0].offerings[1]", walkBody({owners: [owner({offerings: [701, -1]})]})],
    ["owners[0].offerings[0]", walkBody({owners: [owner({offerings: [1.5]})]})],
    ["inner_cursor", walkBody({inner_cursor: "abc"})],
    ["inner_cursor", walkBody({inner_cursor: undefined})],
    ["inner_cursor.docId", walkBody({inner_cursor: {docId: "a/b"}})],
    ["inner_cursor.docId", walkBody({inner_cursor: {docId: "a#b"}})],
    ["inner_cursor.docId", walkBody({inner_cursor: {docId: ""}})],
    ["inner_cursor.index", walkBody({operation: "history", inner_cursor: {docId: "d", entryId: "e"}})],
    ["inner_cursor.index", walkBody({operation: "history", inner_cursor: {docId: "d", index: -1, entryId: "e"}})],
    ["inner_cursor.entryId", walkBody({operation: "history", inner_cursor: {docId: "d", index: 3}})],
    ["inner_cursor.entryId", walkBody({operation: "history", inner_cursor: {docId: "d", index: 3, entryId: "e.f"}})],
    ["limit", walkBody({limit: 0})],
    ["limit", walkBody({limit: 501})],
    ["limit", walkBody({limit: undefined})],
    ["owner_limit", walkBody({owner_limit: 251})],
    ["read_limit", walkBody({read_limit: 5001})],
    ["read_limit", walkBody({read_limit: 2.5})],
    ["classes", {operation: "owners", portal: kPortal, classes: []}],
    ["classes", {operation: "owners", portal: kPortal,
      classes: Array.from({length: 1001}, () => ({class_hash: kHash, offerings: [701]}))}],
    ["classes[0]", {operation: "owners", portal: kPortal, classes: [null]}],
    ["classes[0].offerings", {operation: "owners", portal: kPortal, classes: [{class_hash: kHash, offerings: "701"}]}],
    ["classes[0].class_hash", {operation: "owners", portal: kPortal, classes: [{class_hash: "x", offerings: []}]}],
    ["classes[0].offerings[0]",
      {operation: "owners", portal: kPortal, classes: [{class_hash: kHash, offerings: ["7"]}]}],
  ])("refuses a malformed %s with 400 naming it", async (field, body) => {
    await expectInvalid(body, field);
  });

  it("accepts each owner type's uid shape and the second portal on the list", async () => {
    // A valid request reaches the store reads, which the mocks above refuse.
    const answer = await call({headers: authorized, body: walkBody({
      portal: "learn.concord.org",
      owners: [owner(), owner({uid: "group_701_3"}), owner({uid: `class_${kHash}`})],
    })});
    expect(answer).toEqual({status: 500, body: {success: false, error: "read failed"}});
    const calls = (logger.error as jest.Mock).mock.calls;
    expect(calls).toEqual([["clueExport read failed", {operation: "documents", count: 3, error: "PERMISSION_DENIED"}]]);
  });
});

describe("toHistoryRow", () => {
  const snap = (id: string, data: Record<string, unknown>) => ({id, data: () => data});

  it.each([
    ["a fraction", 1.5],
    ["a numeric string", "3"],
    ["an integer past 2^53", 2 ** 60],
    ["missing", undefined],
  ])("gives a null idx when the stored index is %s", (_name, index) => {
    expect(toHistoryRow("doc1", snap("e6", {index, entry: "{}"})).idx).toBeNull();
  });

  const created = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 12, 0, 0));

  it("extracts the fields of a parseable entry", () => {
    const entry = JSON.stringify({
      created: Date.UTC(2026, 9, 1, 11, 59, 0), model: "TreeManager", action: {name: "applyPatch"},
      undoable: true, state: "complete", records: [{}, {}, {}], isRevert: true, uid: "1234",
    });
    expect(toHistoryRow("doc1", snap("e1", {index: 4, previousEntryId: "e0", created, entry}))).toEqual({
      doc_id: "doc1",
      entry_id: "e1",
      idx: 4,
      prev_entry_id: "e0",
      server_created: "2026-10-01T12:00:00.000Z",
      created: "2026-10-01T11:59:00.000Z",
      model: "TreeManager",
      action_raw: {name: "applyPatch"},
      undoable: true,
      state: "complete",
      n_records: 3,
      is_revert: true,
      entry_uid: "1234",
      parse_ok: true,
      entry_json: entry,
    });
  });

  it("defaults isRevert to false and uid to null when the entry has neither", () => {
    const entry = JSON.stringify({created: 0, model: "m", records: []});
    const row = toHistoryRow("doc1", snap("e2", {index: 0, created, entry}));
    expect(row).toMatchObject({is_revert: false, entry_uid: null, n_records: 0, prev_entry_id: null,
      created: "1970-01-01T00:00:00.000Z", parse_ok: true});
  });

  it("nulls every extracted field of an entry that does not parse, keeping the stored ones", () => {
    const entry = "{not json";
    expect(toHistoryRow("doc1", snap("e3", {index: 7, previousEntryId: "e2", created: "later", entry}))).toEqual({
      doc_id: "doc1",
      entry_id: "e3",
      idx: 7,
      prev_entry_id: "e2",
      server_created: null,
      created: null,
      model: null,
      action_raw: null,
      undoable: null,
      state: null,
      n_records: null,
      is_revert: null,
      entry_uid: null,
      parse_ok: false,
      entry_json: entry,
    });
  });

  it.each([
    ["the first millisecond of year 1", Date.parse("0001-01-01T00:00:00.000Z"), "0001-01-01T00:00:00.000Z"],
    ["the last millisecond of year 9999", Date.parse("9999-12-31T23:59:59.999Z"), "9999-12-31T23:59:59.999Z"],
  ])("keeps a created at %s", (_name, created, iso) => {
    const row = toHistoryRow("doc1", snap("e5", {index: 1, entry: JSON.stringify({created})}));
    expect(row.created).toBe(iso);
  });

  it.each([
    ["a string", "yesterday"],
    ["out of the Date range", 1e20],
    ["in year 0", Date.parse("0001-01-01T00:00:00.000Z") - 1],
    ["in year 10000", Date.parse("9999-12-31T23:59:59.999Z") + 1],
  ])(
    "gives a null created when the entry's created is %s", (_name, created) => {
      const row = toHistoryRow("doc1", snap("e4", {index: 1, entry: JSON.stringify({created})}));
      expect(row).toMatchObject({created: null, parse_ok: true});
    });
});
