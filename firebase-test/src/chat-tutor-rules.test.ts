import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectQueryToFail, expectQueryToSucceed, expectReadToFail,
  expectReadToSucceed, expectUpdateToFail, expectWriteToFail, expectWriteToSucceed, initFirestore,
  mockTimestamp, otherClass, prepareEachTest, researcherAuth, studentAuth, teacherAuth,
  tearDownTests, thisClass
} from "./setup-rules-tests";

// The real Firebase token students carry has user_type "learner" (portal-types.ts); the shared
// studentAuth fixture's "student" value is the client-side app-model remap, which the chat rules
// deliberately do NOT accept — so these tests define fresh learner-claim contexts rather than
// reusing (or editing) the shared fixture.
const learnerId = "101";
const learnerAuth = { uid: learnerId, platform_user_id: 101, user_type: "learner", class_hash: thisClass };
const classmateId = "102";
const classmateAuth = { uid: classmateId, platform_user_id: 102, user_type: "learner", class_hash: thisClass };
const otherClassLearnerAuth = { uid: "103", platform_user_id: 103, user_type: "learner", class_hash: otherClass };

describe("Firestore security rules: chat tutor", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  const kParentPath = "authed/myPortal/chatTutor/conv-1";
  const kMessagePath = `${kParentPath}/messages/msg-1`;

  interface ISpecMessage {
    add?: Record<string, unknown>;
    remove?: string[];
  }
  function specMessage(options?: ISpecMessage) {
    const message: Record<string, unknown> = {
      uid: learnerId, kind: "user", createdAt: mockTimestamp(), text: "help me think",
      context_id: thisClass, problemPath: "abc/1/2"
    };
    options?.remove?.forEach(prop => delete message[prop]);
    return { ...message, ...options?.add };
  }

  const specParent = (uid = learnerId) =>
    ({ uid, context_id: thisClass, problemPath: "abc/1/2" });

  describe("message create", () => {
    it("allows a learner's valid user message before the parent exists (first send)", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToSucceed(db, kMessagePath, specMessage());
    });

    it("allows optional leftContext/rightContext payloads", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToSucceed(db, kMessagePath, specMessage({
        add: { leftContext: `{"sections":[]}`, rightContext: "## markdown" }
      }));
    });

    it("rejects a forged kind:'assistant'", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { kind: "assistant" } }));
    });

    it("rejects a uid not matching the caller's token", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { uid: classmateId } }));
    });

    it("rejects a missing or non-orderable createdAt", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({ remove: ["createdAt"] }));
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { createdAt: "now" } }));
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { createdAt: null } }));
    });

    it("rejects extra/server-owned fields", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { status: "idle" } }));
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { conversationId: "conv_x" } }));
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { problemInstalled: true } }));
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { seq: 99 } }));
    });

    it("rejects a context_id that doesn't match the token's class_hash", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { context_id: otherClass } }));
    });

    it("rejects non-learner claims: teacher, researcher, and the remapped 'student' value", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({
        add: { uid: teacherAuth.uid, context_id: teacherAuth.class_hash } }));
      db = initFirestore(researcherAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({
        add: { uid: researcherAuth.uid, context_id: researcherAuth.class_hash } }));
      // the client-side app model remaps "learner" to "student"; the rules must reject the
      // remapped value or a real student's create would be denied in production
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({
        add: { uid: studentAuth.uid, context_id: studentAuth.class_hash } }));
    });

    it("rejects a learner writing into a classmate's existing conversation", async () => {
      await adminWriteDoc(kParentPath, specParent(learnerId));
      db = initFirestore(classmateAuth);
      await expectWriteToFail(db, kMessagePath, specMessage({ add: { uid: classmateId } }));
    });

    it("allows the owner to write into their own existing conversation", async () => {
      await adminWriteDoc(kParentPath, specParent(learnerId));
      db = initFirestore(learnerAuth);
      await expectWriteToSucceed(db, kMessagePath, specMessage());
    });
  });

  describe("message read", () => {
    it("allows only the owning learner to read a message doc", async () => {
      await adminWriteDoc(kMessagePath, specMessage());
      db = initFirestore(learnerAuth);
      await expectReadToSucceed(db, kMessagePath);
      db = initFirestore(classmateAuth);
      await expectReadToFail(db, kMessagePath);
      db = initFirestore(otherClassLearnerAuth);
      await expectReadToFail(db, kMessagePath);
      db = initFirestore(teacherAuth);
      await expectReadToFail(db, kMessagePath);
    });

    it("allows the owner-filtered listen query and rejects an unfiltered one", async () => {
      await adminWriteDoc(kMessagePath, specMessage());
      db = initFirestore(learnerAuth);
      const messages = db.collection(`${kParentPath}/messages`);
      await expectQueryToSucceed(db, messages.where("uid", "==", learnerId).orderBy("createdAt"));
      await expectQueryToFail(db, messages.orderBy("createdAt"));
    });
  });

  describe("message update/delete", () => {
    it("rejects client updates and deletes", async () => {
      await adminWriteDoc(kMessagePath, specMessage());
      db = initFirestore(learnerAuth);
      await expectUpdateToFail(db, kMessagePath, { text: "edited" });
      await expectDeleteToFail(db, kMessagePath);
    });
  });

  describe("parent conversation doc", () => {
    it("allows only the owning learner to read the parent", async () => {
      await adminWriteDoc(kParentPath, { ...specParent(learnerId), status: "idle" });
      db = initFirestore(learnerAuth);
      await expectReadToSucceed(db, kParentPath);
      db = initFirestore(classmateAuth);
      await expectReadToFail(db, kParentPath);
      db = initFirestore(teacherAuth);
      await expectReadToFail(db, kParentPath);
    });

    it("denies a read of a non-existent parent under the learner claim", async () => {
      // the transport treats this permission-denied as the benign "no conversation yet" case
      db = initFirestore(learnerAuth);
      await expectReadToFail(db, kParentPath);
    });

    it("defensive create: owner-pinned whitelist only", async () => {
      db = initFirestore(learnerAuth);
      await expectWriteToSucceed(db, kParentPath, specParent(learnerId));
      await prepareEachTest();
      // forged owner
      await expectWriteToFail(db, kParentPath, specParent(classmateId));
      // server-owned field injection
      await expectWriteToFail(db, kParentPath, { ...specParent(learnerId), problemInstalled: true });
      await expectWriteToFail(db, kParentPath, { ...specParent(learnerId), status: "idle" });
      // context pinned to the token
      await expectWriteToFail(db, kParentPath, { ...specParent(learnerId), context_id: otherClass });
      // non-learner claim
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kParentPath,
        { uid: teacherAuth.uid, context_id: thisClass, problemPath: "abc/1/2" });
    });

    it("rejects client updates and deletes of the parent", async () => {
      await adminWriteDoc(kParentPath, { ...specParent(learnerId), status: "idle" });
      db = initFirestore(learnerAuth);
      await expectUpdateToFail(db, kParentPath, { problemInstalled: true });
      await expectDeleteToFail(db, kParentPath);
    });
  });
});
