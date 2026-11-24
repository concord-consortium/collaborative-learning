jest.mock("firebase/app", () => ({__esModule: true,
  default: {firestore: {FieldValue: {serverTimestamp: () => "server-timestamp"}}}}));
import { FirestoreTransport } from "./firestore-transport";

function setup() {
  let parent: (snapshot: any) => void = () => undefined;
  let history: (snapshot: any) => void = () => undefined;
  const added: unknown[] = [];
  const messages = {add: async (data: unknown) => { added.push(data); },
    where: () => ({orderBy: () => ({onSnapshot: (cb: typeof history) => { history = cb; return () => undefined; }})})};
  const parentRef = {collection: () => messages,
    onSnapshot: (cb: typeof parent) => { parent = cb; return () => undefined; }};
  const firestore = {collection: () => ({doc: () => parentRef})} as any;
  const transport = new FirestoreTransport({firestore, conversationId: "c", uid: "u", contextId: "class",
    problemPath: "vibe/1/2", provider: "foreverlearning", getLeftContext: () => undefined,
    getRightSummary: () => undefined});
  const onStatus = jest.fn(); const onTurns = jest.fn(); transport.subscribe(onTurns, onStatus);
  const setParent = (data: unknown) => parent({exists: true, data: () => data});
  const setHistory = (rows: any[]) => history({forEach: (cb: (row: any) => void) =>
    rows.forEach((data, i) => cb({id: String(i), data: () => data, metadata: {hasPendingWrites: false}}))});
  return {transport, added, setParent, setHistory, onStatus, onTurns};
}
it("writes only a recovery intent for the current outcome; it cannot send new work through a fence", async () => {
  const f = setup(); const delivery = {id: "outcome1", messageId: "m1", state: "unknown", code: "TEST"};
  f.setParent({status: "error", delivery});
  await expect(f.transport.sendUserMessage("new question")).rejects.toThrow("Resolve the saved message");
  await expect(f.transport.recover("continue")).rejects.toThrow("no longer available");
  await f.transport.recover("retry");
  expect(f.added).toEqual([{uid: "u", context_id: "class", problemPath: "vibe/1/2", provider: "foreverlearning",
    kind: "recovery", action: "retry", recoveryId: "outcome1", createdAt: "server-timestamp"}]);
});
it("ignores a parent left generating when no reply is awaited and no delivery is recorded", () => {
  const f = setup(); f.setHistory([{kind: "user", text: "q"}, {kind: "assistant", userText: "a"}]);
  f.setParent({status: "generating"});
  expect(f.onStatus.mock.calls.at(-1)).toEqual(["idle", undefined]);
});

it("rehydrates failure and closure without a stuck typing indicator, then clears a continued failure", () => {
  const f = setup(); f.setHistory([{kind: "user", text: "failed"}]);
  f.setParent({status: "error", delivery: {id: "o", messageId: "m", state: "failed", code: "TEST"}});
  expect(f.onStatus.mock.calls.at(-1)[0]).toBe("error");
  f.setParent({status: "idle", delivery: {id: "o", messageId: "m", state: "closed", code: "TEST"}});
  expect(f.onStatus.mock.calls.at(-1)[0]).toBe("idle");
  f.setHistory([{kind: "user", text: "failed"},
    {kind: "delivery", resolved: true, resolution: "continued", text: "Failed"}]);
  f.setParent({status: "idle"});
  expect(f.onStatus.mock.calls.at(-1)).toEqual(["idle", undefined]);
});
