import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import firebase from "firebase";
import { kMaxChatMessageChars } from "../../shared/chat-message";
import { adminWriteDoc, initFirestore, prepareEachTest, tearDownTests } from "./setup-rules-tests";

describe("chat activity context rules", () => {
  const learnerClaims = { uid: "101", platform_user_id: 101, user_type: "learner", class_hash: "class" };

  beforeEach(async () => {
    await prepareEachTest();
  });
  afterAll(async () => {
    await tearDownTests();
  });

  it("denies all client access to server-owned pending request snapshots", async () => {
    for (const clientDb of [initFirestore(), initFirestore({ uid: "qa-user" }), initFirestore(learnerClaims)]) {
      const ref = clientDb.doc("chatTutorPendingRequests/pending");
      await assertFails(ref.set({ snapshotJson: "spoof" }));
      await assertFails(ref.get());
      await assertFails(ref.delete());
    }
  });

  const message = (activityContext?: unknown) => ({ uid: "101", kind: "user", createdAt: Date.now(),
    text: "Help", context_id: "class", problemPath: "vibe/1/2", provider: "foreverlearning",
    ...(activityContext !== undefined ? { activityContext } : {}) });
  const db = () => initFirestore(learnerClaims);
  const activity = { task_prompt: "First line.\n\nSecond line.",
    source: { system: "CLUE", lesson_id: "1.2", unit: "vibe", section: "lab" } };

  describe.each(["authed/test", "demo/test"])("%s", (root) => {
    const path = `${root}/chatTutor/owner:3:101_class_conv/messages/m`;
    it.each([undefined, { task_prompt: "Task only" }, activity,
      { ...activity, learning_goal: "Compare inputs" }])("accepts supported current context %j", async (value) => {
      await assertSucceeds(db().doc(path).set(message(value)));
    });
    it.each([null, "raw text", {}, { task_prompt: " " }, { task_prompt: 42 },
      { task_prompt: "x".repeat(8001) }, { task_prompt: "Task", learning_goal: "" },
      { ...activity, canonical_pattern_id: "override" }, { ...activity, extra: true },
      { ...activity, source: { system: "CLUE" } }, { ...activity, source: { ...activity.source, extra: true } },
      { ...activity, source: { ...activity.source, system: "unknown" } }
    ])("rejects invalid context case %#", async (value) => {
      await assertFails(db().doc(path).set(message(value)));
    });
    it("accepts message text up to kMaxChatMessageChars and rejects longer text", async () => {
      await assertSucceeds(db().doc(path).set({ ...message(), text: "x".repeat(kMaxChatMessageChars) }));
      await assertFails(db().doc(path + "long").set({ ...message(), text: "x".repeat(kMaxChatMessageChars + 1) }));
    });
    it("rejects activity on OpenAI and preserves message immutability", async () => {
      await assertFails(db().doc(path).set({ ...message(activity), provider: "openai" }));
      await assertSucceeds(db().doc(path).set(message(activity)));
      await assertFails(db().doc(path).update({ activityContext: { task_prompt: "Changed later" } }));
    });
    it("accepts current capabilities and rejects changed shape, provider or schema", async () => {
      const capabilityContext = { schema_version: "clue.capability_context.v1", dataflow: {
        creation_tool_configured: true, node_palette: ["Number"], demo_device_options: ["Servo"],
        outputConfig: { servoInputMode: "proportion", allowedOutputTypes: ["Servo"] }
      } };
      const data = { ...message(activity), capabilityContext };
      await assertSucceeds(db().doc(path).set(data));
      await assertFails(db().doc(path + "bad").set({ ...data, provider: "openai" }));
      await assertFails(db().doc(path + "bad").set({ ...data,
        capabilityContext: { ...capabilityContext, schema_version: "wrong" } }));
      await assertFails(db().doc(path + "bad").set({ ...data,
        capabilityContext: { ...capabilityContext, answer_protection: {} } }));
      await assertFails(db().doc(path).update({ capabilityContext: {} }));
    });
    it("allows immutable bounded recovery controls but no forged outcome or prompt", async () => {
      await adminWriteDoc(`${root}/chatTutor/owner:3:101_class_conv`, {
        uid: "101", context_id: "class", problemPath: "vibe/1/2"
      });
      const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
      const control = { uid: "101", kind: "recovery", provider: "foreverlearning", context_id: "class",
        problemPath: "vibe/1/2", createdAt: serverTimestamp(), action: "retry", recoveryId: "server-outcome" };
      await assertSucceeds(db().doc(path).set(control));
      await assertFails(db().doc(path).update({ action: "continue" }));
      await assertFails(db().doc(path + "bad").set({ ...control, processedAt: serverTimestamp() }));
      await assertFails(db().doc(path + "bad").set({ ...control, text: "New prompt" }));
      await assertFails(db().doc(path + "bad").set({ ...control, action: "skip_anything" }));
      await assertFails(db().doc(path + "bad").set({ ...control, provider: "openai" }));
    });
    it("rejects unrelated server fields", async () => {
      await assertFails(db().doc(path).set({ ...message(activity), flTraceId: "spoof" }));
    });
  });
});
