import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {serverTimestamp} from "firebase/firestore";
import {assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment}
  from "@firebase/rules-unit-testing";
import {ownedConversationId} from "../../shared/chat-ownership";

describe("authenticated chat ownership before and after the first parent", () => {
  let env: RulesTestEnvironment;
  const owner = {uid: "202", context_id: "class", problemPath: "vibe/1/2"};
  const id = ownedConversationId("202", "class", "network_doc_vibe_1_2");
  const parent = (key = id) => `authed/test/chatTutor/${key}`;
  const message = (uid = "202") => ({...owner, uid, kind: "user", text: "Help", createdAt: Date.now()});
  const db = (uid = "202", classHash = "class", role = "learner") => env.authenticatedContext(uid, {
    platform_user_id: uid, class_hash: classHash, user_type: role,
  }).firestore();
  const seed = async (path: string, data: object) => env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(path).set(data);
  });
  beforeAll(async () => {
    env = await initializeTestEnvironment({projectId: "demo-clue-ownership-rules", firestore: {
      host: "127.0.0.1", port: 8088, rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
    }});
  }, 30000);
  beforeEach(async () => {
    await env.clearFirestore();
  });
  afterAll(async () => {
    await env?.cleanup();
  });

  it("rejects direct parent pre-claim even at the caller's own path", async () => {
    await assertFails(db("101").doc(parent()).set({...owner, uid: "101"}));
    await assertFails(db().doc(parent()).set(owner));
    await assertSucceeds(db().doc(`${parent()}/messages/first`).set(message()));
  });
  it("rejects a foreign first message under another learner's owner prefix", async () => {
    const results = await Promise.allSettled([
      db("101").doc(`${parent()}/messages/attack`).set(message("101")),
      db().doc(`${parent()}/messages/first`).set(message()),
    ]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "fulfilled"]);
    await assertFails(db("101").doc(`${parent()}/messages/attack2`).set(message("101")));
  });
  it.each(["202", "202_more", "a.b+", "é", "😀"])("compares owner ids literally: %s", async (uid) => {
    const key = ownedConversationId(uid, "class", "network_doc");
    await assertSucceeds(db(uid).doc(`${parent(key)}/messages/first`).set(message(uid)));
    await assertFails(db("202x").doc(`${parent(key)}/messages/foreign`).set(message("202x")));
  });
  it("does not treat a shorter uid or a forged length as the owner", async () => {
    await assertFails(db("20").doc(`${parent()}/messages/short`).set(message("20")));
    await assertFails(db().doc(`${parent("owner:2:202_class_doc")}/messages/wrong`).set(message()));
    await assertFails(db().doc(`${parent("uid:202_more_doc")}/messages/ambiguous`).set(message()));
  });
  it("requires owner-bound ids for new conversations, including legacy uid/network forms", async () => {
    await assertFails(db().doc(`${parent("uid:202_doc_vibe_1_2")}/messages/first`).set(message()));
    await assertFails(db("101").doc(`${parent("uid:202_doc_vibe_1_2")}/messages/foreign`).set(message("101")));
    await assertFails(db().doc(`${parent("network_doc_vibe_1_2")}/messages/first`).set(message()));
  });
  it.each(["uid:202_doc_vibe_1_2", "network_doc_vibe_1_2", id])("preserves established owner history: %s", async (key) => {
    await seed(parent(key), owner);
    await seed(`${parent(key)}/messages/reply`, {...owner, kind: "assistant", userText: "Private reply", createdAt: 1});
    await assertSucceeds(db().doc(parent(key)).get());
    await assertSucceeds(db().collection(`${parent(key)}/messages`).where("uid", "==", "202").orderBy("createdAt").get());
    await assertSucceeds(db().doc(`${parent(key)}/messages/next`).set(message()));
    await assertFails(db("101").doc(parent(key)).get());
    await assertFails(db("101").doc(`${parent(key)}/messages/reply`).get());
    await assertFails(db("101").doc(`${parent(key)}/messages/foreign`).set(message("101")));
    await assertFails(db().doc(parent(key)).update({uid: "101"}));
    await assertFails(db().doc(parent(key)).delete());
  });
  it("allows the owner to check a missing canonical parent and listen before first send", async () => {
    expect((await assertSucceeds(db().doc(parent()).get())).exists).toBe(false);
    await assertSucceeds(db().collection(`${parent()}/messages`).where("uid", "==", "202").orderBy("createdAt").get());
    await assertFails(db("101").doc(parent()).get());
  });
  it("rejects class/problem changes and foreign recovery, including before parent creation", async () => {
    const recovery = {...owner, kind: "recovery", provider: "foreverlearning", action: "retry",
      recoveryId: "server-receipt", createdAt: serverTimestamp()};
    await assertFails(db().doc(`${parent()}/messages/early`).set(recovery));
    await seed(parent(), owner);
    await assertSucceeds(db().doc(`${parent()}/messages/recover`).set(recovery));
    await assertFails(db("101").doc(`${parent()}/messages/foreign`).set({...recovery, uid: "101"}));
    await assertFails(db("202", "other-class").doc(`${parent()}/messages/class`).set({...message(), context_id: "other-class"}));
    await assertFails(db().doc(`${parent()}/messages/problem`).set({...message(), problemPath: "other/1/1"}));
    await assertFails(db("202", "class", "teacher").doc(`${parent()}/messages/teacher`).set(message()));
  });
  it("denies a historical foreign message read once another owner is established", async () => {
    await seed(parent(), owner);
    await seed(`${parent()}/messages/mixed`, message("101"));
    await assertFails(db("101").doc(`${parent()}/messages/mixed`).get());
    await assertFails(db("101").collection(`${parent()}/messages`).where("uid", "==", "101").get());
  });
});
