jest.mock("firebase/app", () => ({__esModule: true,
  default: {firestore: {FieldValue: {serverTimestamp: () => "server-timestamp"}}}}));
import { FirestoreTransport } from "./firestore-transport";
import { ownedConversationId } from "../../../shared/chat-ownership";

const owner = {uid: "202", context_id: "class", problemPath: "vibe/1/2"};
const canonical = ownedConversationId("202", "class", "network_doc");
function setup(records: Record<string, any> = {}, failures: Record<string, string> = {}) {
  const added: {id: string, data: any}[] = [];
  const listens: string[] = [];
  const gets: string[] = [];
  const unsub = jest.fn();
  const ref = (id: string) => ({
    get: jest.fn(async (options: unknown) => {
      expect(options).toEqual({source: "server"}); gets.push(id);
      if (failures[id]) throw Object.assign(new Error("read failed"), {code: failures[id]});
      return {exists: !!records[id], data: () => records[id]};
    }),
    onSnapshot: () => { listens.push(id); return unsub; },
    collection: () => ({add: async (data: any) => { added.push({id, data}); },
      where: () => ({orderBy: () => ({onSnapshot: () => { listens.push(id); return unsub; }})})}),
  });
  const firestore = {collection: () => ({doc: ref})} as any;
  const transport = new FirestoreTransport({firestore, conversationId: canonical, legacyConversationId: "network_doc",
    uid: owner.uid, contextId: owner.context_id, problemPath: owner.problemPath, provider: "foreverlearning",
    getLeftContext: () => undefined, getRightSummary: () => undefined});
  return {transport, added, listens, gets, unsub};
}
it("reuses the owned legacy network conversation for sends and subscriptions", async () => {
  const f = setup({network_doc: {...owner, flSessionId: "existing"}});
  f.transport.subscribe(jest.fn(), jest.fn());
  await f.transport.sendUserMessage("Continue");
  expect(f.added[0].id).toBe("network_doc");
  expect(f.listens).toEqual(["network_doc", "network_doc"]);
  expect(f.gets).toEqual([canonical, "network_doc"]);
  await f.transport.sendUserMessage("Another");
  expect(f.gets).toHaveLength(2);
});
it("prefers an existing canonical conversation without rejoining legacy history", async () => {
  const f = setup({[canonical]: owner, network_doc: owner});
  await f.transport.sendUserMessage("Continue");
  expect(f.added[0].id).toBe(canonical);
  expect(f.gets).toEqual([canonical]);
});
it.each([undefined, {...owner, uid: "101"}, {...owner, context_id: "other"}, {...owner, problemPath: "other/1/1"}])(
  "starts canonical when the legacy parent is absent or not this conversation: %j", async legacy => {
    const f = setup({network_doc: legacy});
    await f.transport.sendUserMessage("First");
    expect(f.added[0].id).toBe(canonical);
  });
it("treats denied legacy reads as inaccessible, but does not fork on network errors", async () => {
  const denied = setup({}, {network_doc: "permission-denied"});
  await denied.transport.sendUserMessage("First");
  expect(denied.added[0].id).toBe(canonical);
  const offline = setup({}, {network_doc: "unavailable"});
  await expect(offline.transport.sendUserMessage("Do not fork")).rejects.toThrow("read failed");
  expect(offline.added).toHaveLength(0);
});
it("does not bypass a canonical ownership mismatch", async () => {
  const f = setup({[canonical]: {...owner, uid: "101"}, network_doc: owner});
  await expect(f.transport.sendUserMessage("No send")).rejects.toThrow("owner does not match");
  expect(f.added).toHaveLength(0);
});
it("restores the legacy recovery fence before a queued send can escape it", async () => {
  const f = setup({network_doc: {...owner, status: "error",
    delivery: {id: "receipt", messageId: "m", state: "unknown", code: "FL_REQUEST_PENDING"}}});
  await expect(f.transport.sendUserMessage("New work")).rejects.toThrow("Resolve the saved message");
  await f.transport.recover("retry");
  expect(f.added).toHaveLength(1);
  expect(f.added[0]).toMatchObject({id: "network_doc", data: {kind: "recovery", recoveryId: "receipt"}});
});
it("does not attach late listeners after disposal during resolution", async () => {
  const f = setup({network_doc: owner});
  const dispose = f.transport.subscribe(jest.fn(), jest.fn());
  dispose();
  await f.transport.sendUserMessage("Await resolution");
  expect(f.listens).toEqual([]);
});
it("retries a lookup that failed on open, then attaches the listeners and sends", async () => {
  const failures: Record<string, string> = {network_doc: "unavailable"};
  const f = setup({network_doc: owner}, failures);
  const onStatus = jest.fn();
  f.transport.subscribe(jest.fn(), onStatus);
  await new Promise(resolve => setTimeout(resolve));
  expect(onStatus).toHaveBeenLastCalledWith("error", undefined);
  expect(f.listens).toEqual([]);
  delete failures.network_doc;
  await f.transport.sendUserMessage("After the blip");
  expect(f.listens).toEqual(["network_doc", "network_doc"]);
  expect(f.added.map(a => a.id)).toEqual(["network_doc"]);
  const lookups = f.gets.length;
  await f.transport.sendUserMessage("Again");
  expect(f.gets).toHaveLength(lookups);
  expect(f.listens).toHaveLength(2);
});
it("attaches the listeners once when a send's lookup finishes before the subscription's", async () => {
  const f = setup({network_doc: owner});
  const sent = f.transport.sendUserMessage("Early");
  f.transport.subscribe(jest.fn(), jest.fn());
  await sent;
  await new Promise(resolve => setTimeout(resolve));
  expect(f.listens).toEqual(["network_doc", "network_doc"]);
});
