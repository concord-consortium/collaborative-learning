// Disposable emulator project; fake provider only, no external calls or shared-data clearing.
import {deleteApp, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {acquireLock, processAndDrain} from "../src/chat/drain";
import {createTurnPersistence} from "../src/chat/turn-persistence";
import {ownedConversationId} from "../../shared/chat-ownership";

const app = initializeApp({projectId: "demo-clue-ownership-backend"});
const db = getFirestore();
const owner = {uid: "202", context_id: "class", problemPath: "vibe/1/2"};
const parent = (id = ownedConversationId("202", "class", "network_doc")) => db.doc(`authed/test/chatTutor/${id}`);
const provider = () => ({processTurn: jest.fn(async (p: Record<string, unknown>, message: Record<string, unknown>) => {
  expect(message.uid).toBe(p.uid);
  return {assistantText: "Owner's reply", parentUpdate: {}};
})});
async function clearFixtures() {
  await db.recursiveDelete(db.doc("authed/test"));
  await db.recursiveDelete(db.collection("chatTutorPendingRequests"));
}
beforeEach(clearFixtures);
afterAll(async () => {
  await clearFixtures(); await deleteApp(app);
});

it("rejects foreign first-lock acquisition without creating any parent", async () => {
  expect(await acquireLock(parent(), {...owner, uid: "101"})).toBe(false);
  expect((await parent().get()).exists).toBe(false);
  expect(await acquireLock(parent(), owner)).toBe(true);
  expect((await parent().get()).get("uid")).toBe("202");
});
it("lets exactly one of two racing first triggers create the parent, with the winner's owner fields", async () => {
  const other = {...owner, problemPath: "vibe/1/3"};
  const results = await Promise.all([acquireLock(parent(), owner), acquireLock(parent(), other)]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const winner = results[0] ? owner : other;
  expect((await parent().get()).get("problemPath")).toBe(winner.problemPath);
});
it("cannot establish ownership through a recovery trigger or an unbound legacy path", async () => {
  expect(await acquireLock(parent(), owner, false)).toBe(false);
  expect(await acquireLock(parent("network_doc"), owner)).toBe(false);
  expect(await acquireLock(parent("uid:202_doc"), owner)).toBe(false);
  expect((await parent().get()).exists).toBe(false);
});
it.each([{uid: "101"}, {context_id: "other"}, {problemPath: "other/1/1"}])(
  "rejects existing-parent owner mismatch without changing its state: %j", async (change) => {
    await parent().set({...owner, status: "idle", flSessionId: "private-session"});
    const before = (await parent().get()).data();
    expect(await acquireLock(parent(), {...owner, ...change})).toBe(false);
    expect((await parent().get()).data()).toEqual(before);
  });
it.each(["uid:202_doc_vibe_1_2", "network_doc_vibe_1_2"])("continues established legacy parent %s", async (id) => {
  const ref = parent(id); const fake = provider();
  await ref.set({...owner, status: "idle", conversationId: "existing-vendor-session"});
  await ref.collection("messages").doc("m").set({...owner, kind: "user", text: "Continue", createdAt: Timestamp.fromMillis(1)});
  expect(await acquireLock(ref, owner)).toBe(true);
  await processAndDrain({parentRef: ref, messagesCol: ref.collection("messages"), provider: fake});
  expect(fake.processTurn).toHaveBeenCalledTimes(1);
  expect((await ref.get()).get("conversationId")).toBe("existing-vendor-session");
});
it.each([{uid: "101"}, {context_id: "other"}, {problemPath: "other/1/1"}])(
  "quarantines historical mismatched traffic before provider dispatch and drains the owner: %j", async (change) => {
    const ref = parent(); const fake = provider();
    await ref.set({...owner, status: "idle", flSessionId: "private-session"});
    const foreign = ref.collection("messages").doc("foreign");
    await foreign.set({...owner, ...change, kind: "user", text: "Foreign prompt", provider: "foreverlearning",
      createdAt: Timestamp.fromMillis(1)});
    await ref.collection("messages").doc("good").set({...owner, kind: "user", text: "Owner prompt",
      createdAt: Timestamp.fromMillis(2)});
    expect(await acquireLock(ref, owner)).toBe(true);
    await processAndDrain({parentRef: ref, messagesCol: ref.collection("messages"), provider: fake});
    expect(fake.processTurn).toHaveBeenCalledTimes(1);
    expect(fake.processTurn.mock.calls[0][1]).toMatchObject({text: "Owner prompt", uid: "202"});
    expect((await foreign.get()).get("rejectionCode")).toBe("CHAT_OWNER_MISMATCH");
    const messages = (await ref.collection("messages").get()).docs;
    expect(messages.filter((m) => m.get("kind") === "assistant")).toHaveLength(1);
    expect(messages.filter((m) => m.get("kind") === "assistant")[0].get("uid")).toBe("202");
    expect((await ref.collection("messages").doc("delivery-foreign").get()).get("uid")).toBe("202");
    expect((await createTurnPersistence(foreign, (await foreign.get()).data()!).ref.get()).exists).toBe(false);
    expect((await ref.get()).get("lastProcessedMessageId")).toBe("good");
  });
it("keeps an already-reserved historical mismatch fenced for support", async () => {
  const ref = parent(); const fake = provider();
  await ref.set({...owner, status: "idle"});
  const foreign = ref.collection("messages").doc("foreign");
  const data = {...owner, uid: "101", kind: "user", text: "Uncertain old work", createdAt: Timestamp.fromMillis(1)};
  await foreign.set(data);
  const pending = createTurnPersistence(foreign, data).ref;
  await pending.set({snapshotJson: "external work may exist"});
  expect(await acquireLock(ref, owner)).toBe(true);
  await expect(processAndDrain({parentRef: ref, messagesCol: ref.collection("messages"), provider: fake}))
    .rejects.toThrow("support is required");
  expect(fake.processTurn).not.toHaveBeenCalled();
  expect((await pending.get()).exists).toBe(true);
  expect((await ref.get()).get("lastProcessedMessageId")).toBeUndefined();
  expect((await foreign.get()).get("rejectedAt")).toBeUndefined();
});
