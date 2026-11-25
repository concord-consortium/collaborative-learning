// chatTutorOnWrite against the Firestore emulator and a loopback ForeverLearning endpoint: which
// writes start a turn or a recovery, which may create a conversation, and how a recorded failure
// leaves the parent. No model calls.
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {DocumentSnapshot, Timestamp} from "firebase-admin/firestore";
import {Change} from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {ownedConversationId} from "../../shared/chat-ownership";
import {initialize, projectConfig} from "./initialize";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

const owner = {uid: "202", context_id: "class", problemPath: "vibe/1/2"};
const conversationId = ownedConversationId("202", "class", "network_doc");
const parentPath = `authed/test/chatTutor/${conversationId}`;
let server: Server;
let calls: string[];
let failStatus: number;
let wrapped: (change: Change<DocumentSnapshot>, context: {params: Record<string, string>}) => Promise<unknown>;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    calls.push(JSON.parse(body).prompt);
    if (failStatus) {
      res.writeHead(failStatus).end(); return;
    }
    res.writeHead(200, {"Content-Type": "text/event-stream"}).end([
      {type: "metadata", sessionId: "session"},
      {type: "content", part: "conversation", text: "Synthetic reply."},
      {type: "done", sessionId: "session", stopReason: "end_turn"},
    ].map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, {
    FL_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    FL_SOLUTION_ID: "concordclue", FL_CATALOG_COMMIT: "a".repeat(40), FL_CONCORDCLUE_API_KEY: "synthetic",
    FL_PROTECTION_CLASSES: "protected_threshold_value", FL_PROTECTION_PATTERN_REFS: "protected:synthetic",
    OPENAI_TUTOR_API_KEY: "unused", OPENAI_MODEL: "unused",
  });
  const {chatTutorOnWrite} = await import("../src/chat-tutor");
  wrapped = fft.wrap(chatTutorOnWrite) as typeof wrapped;
});
beforeEach(async () => {
  calls = []; failStatus = 0;
  await clearFirestoreData(projectConfig);
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanup();
});

const db = () => admin.firestore();
const parent = () => db().doc(parentPath);
const userMessage = (text = "Help", at = 1) => ({...owner, kind: "user", provider: "foreverlearning", text,
  createdAt: Timestamp.fromMillis(at)});
const snapshot = (path: string, data: object) =>
  fft.firestore.makeDocumentSnapshot(data, path, {firebaseApp: admin.app()});

// Writes the doc, then delivers the write event the trigger would see for it.
async function deliver(id: string, after: object, before: object = {}) {
  const path = `${parentPath}/messages/${id}`;
  await db().doc(path).set(after);
  return wrapped(fft.makeChange(snapshot(path, before), snapshot(path, after)),
    {params: {root: "authed", rootId: "test", conversationId, messageId: id}});
}

// A conversation whose message "m1" failed before anything reached FL, so a retry may run.
async function seedRetryableFailure() {
  await parent().set({...owner, provider: "foreverlearning", status: "error",
    delivery: {id: "receipt", messageId: "m1", state: "retryable", code: "FL_NOT_DISPATCHED"}});
  await parent().collection("messages").doc("m1").set(userMessage("Saved question"));
}
const recoveryControl = () => ({...owner, kind: "recovery", provider: "foreverlearning", action: "retry",
  recoveryId: "receipt", createdAt: Timestamp.fromMillis(2)});

it("lets a learner's first message create the conversation and answers it", async () => {
  await deliver("m1", userMessage());
  expect((await parent().get()).get("uid")).toBe("202");
  expect(calls).toEqual(["Help"]);
});

it("does not let a recovery control create a missing conversation", async () => {
  await deliver("control", recoveryControl());
  expect((await parent().get()).exists).toBe(false);
  expect(calls).toHaveLength(0);
});

it("ignores a write of any other kind, even with a message waiting", async () => {
  await parent().set({...owner, provider: "foreverlearning", status: "idle"});
  await parent().collection("messages").doc("m1").set(userMessage("Waiting"));
  await deliver("a1", {...owner, kind: "assistant", userText: "Reply", createdAt: Timestamp.fromMillis(2)});
  expect(calls).toHaveLength(0);
});

it("routes a new recovery control to recovery and retries the saved message", async () => {
  await seedRetryableFailure();
  await deliver("control", recoveryControl());
  expect(calls).toEqual(["Saved question"]);
  expect((await parent().get()).get("delivery")).toBeUndefined();
  expect((await parent().collection("messages").doc("control").get()).get("disposition")).toBe("accepted");
});

it("ignores a later write to a recovery control that already existed", async () => {
  await seedRetryableFailure();
  await deliver("control", recoveryControl(), recoveryControl());
  expect(calls).toHaveLength(0);
  expect((await parent().get()).get("delivery.id")).toBe("receipt");
});

it("rethrows a recorded delivery failure without writing status \"error\" over it", async () => {
  failStatus = 429;
  await expect(deliver("m1", userMessage())).rejects.toThrow("429");
  const data = (await parent().get()).data()!;
  expect(data.delivery).toMatchObject({state: "retryable", code: "HTTP_429"});
  expect(data.error).toBeUndefined();
});
