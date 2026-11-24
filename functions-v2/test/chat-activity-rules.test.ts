// Real rules execution in a disposable emulator-only project. No functions or model calls.
import {serverTimestamp} from "firebase/firestore";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment}
  from "@firebase/rules-unit-testing";

describe("chat activity context rules", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({projectId: "demo-clue-activity",
      firestore: {host: "127.0.0.1", port: 8088,
        rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8")}});
  }, 30000);
  afterAll(async () => {
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
  });

  it("denies all client access to server-owned pending request snapshots", async () => {
    for (const context of [env.unauthenticatedContext(), env.authenticatedContext("qa-user"),
      env.authenticatedContext("101", {platform_user_id: 101, user_type: "learner", class_hash: "class"})]) {
      const ref = context.firestore().doc("chatTutorPendingRequests/pending");
      await assertFails(ref.set({snapshotJson: "spoof"}));
      await assertFails(ref.get());
      await assertFails(ref.delete());
    }
  });

  const message = (activityContext?: unknown) => ({uid: "101", kind: "user", createdAt: Date.now(),
    text: "Help", context_id: "class", problemPath: "vibe/1/2", provider: "foreverlearning",
    ...(activityContext !== undefined ? {activityContext} : {})});
  function db() {
    return env.authenticatedContext("101", {
      platform_user_id: 101, user_type: "learner", class_hash: "class",
    }).firestore();
  }
  const activity = {task_prompt: "First line.\n\nSecond line.",
    source: {system: "CLUE", lesson_id: "1.2", unit: "vibe", section: "lab"}};

  describe.each(["authed/test", "demo/test"])("%s", (root) => {
    const path = `${root}/chatTutor/conv/messages/m`;
    it.each([undefined, {task_prompt: "Task only"}, activity,
      {...activity, learning_goal: "Compare inputs"}])("accepts supported current context %j", async (value) => {
      await assertSucceeds(db().doc(path).set(message(value)));
    });
    it.each([null, "raw text", {}, {task_prompt: " "}, {task_prompt: 42},
      {task_prompt: "x".repeat(8001)}, {task_prompt: "Task", learning_goal: ""},
      {...activity, canonical_pattern_id: "override"}, {...activity, extra: true},
      {...activity, source: {system: "CLUE"}}, {...activity, source: {...activity.source, extra: true}},
      {...activity, source: {...activity.source, system: "unknown"}},
    ])("rejects invalid context case %#", async (value) => {
      await assertFails(db().doc(path).set(message(value)));
    });
    it("rejects activity on OpenAI and preserves message immutability", async () => {
      await assertFails(db().doc(path).set({...message(activity), provider: "openai"}));
      await assertSucceeds(db().doc(path).set(message(activity)));
      await assertFails(db().doc(path).update({activityContext: {task_prompt: "Changed later"}}));
    });
    it("accepts current capabilities and rejects changed shape, provider or schema", async () => {
      const capabilityContext = {schema_version: "clue.capability_context.v1", dataflow: {
        creation_tool_configured: true, node_palette: ["Number"], demo_device_options: ["Servo"],
        outputConfig: {servoInputMode: "proportion", allowedOutputTypes: ["Servo"]},
      }};
      const data = {...message(activity), capabilityContext};
      await assertSucceeds(db().doc(path).set(data));
      await assertFails(db().doc(path + "bad").set({...data, provider: "openai"}));
      await assertFails(db().doc(path + "bad").set({...data,
        capabilityContext: {...capabilityContext, schema_version: "wrong"}}));
      await assertFails(db().doc(path + "bad").set({...data,
        capabilityContext: {...capabilityContext, answer_protection: {}}}));
      await assertFails(db().doc(path).update({capabilityContext: {}}));
    });
    it("allows immutable bounded recovery controls but no forged outcome or prompt", async () => {
      const control = {uid: "101", kind: "recovery", provider: "foreverlearning", context_id: "class",
        problemPath: "vibe/1/2", createdAt: serverTimestamp(), action: "retry", recoveryId: "server-outcome"};
      await assertSucceeds(db().doc(path).set(control));
      await assertFails(db().doc(path).update({action: "continue"}));
      await assertFails(db().doc(path + "bad").set({...control, processedAt: serverTimestamp()}));
      await assertFails(db().doc(path + "bad").set({...control, text: "New prompt"}));
      await assertFails(db().doc(path + "bad").set({...control, action: "skip_anything"}));
      await assertFails(db().doc(path + "bad").set({...control, provider: "openai"}));
    });
    it("rejects unrelated server fields", async () => {
      await assertFails(db().doc(path).set({...message(activity), flTraceId: "spoof"}));
    });
  });
});
