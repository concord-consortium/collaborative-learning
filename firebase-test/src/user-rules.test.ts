import firebase from "firebase";
import {
  adminWriteDoc,
  expectReadToFail, expectReadToSucceed, expectWriteToFail, genericAuth, initFirestore, network1, network2,
  prepareEachTest, studentAuth, teacher2Id, teacher2Name, teacherAuth, teacherId, teacherName, tearDownTests
} from "./setup-rules-tests";

describe("Firestore security rules for user documents", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  const kUserDocPath = `authed/myPortal/users/${teacherId}`;
  const kOtherUserDocPath = `authed/myPortal/users/${teacher2Id}`;

  function specUser() {
    return { uid: teacherId, name: teacherName, type: "teacher", network: network1, networks: [network1] };
  }

  function specOtherUser(network = network1) {
    return { uid: teacher2Id, name: teacher2Name, type: "teacher", network, networks: [network] };
  }

  const initFirestoreWithOtherUser = async (auth?: any, network = network1) => {
    db = initFirestore(auth);
    await adminWriteDoc(kUserDocPath, specUser());
    await adminWriteDoc(kOtherUserDocPath, specOtherUser(network));
  };

  describe("user documents", () => {
    it("unauthenticated users can't read user documents", async () => {
      db = initFirestore();
      await expectReadToFail(db, kUserDocPath);
    });

    it("unauthenticated users can't write user documents", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kUserDocPath, specUser());
    });

    it("authenticated generic users can't read user documents", async () => {
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kUserDocPath);
    });

    it("authenticated generic users can't write user documents", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kUserDocPath, specUser());
    });

    it("authenticated teachers can read their own user documents", async () => {
      db = initFirestore(teacherAuth);
      await expectReadToSucceed(db, kUserDocPath);
    });

    it("authenticated teachers can't write their own user documents (only admins)", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kUserDocPath, specUser());
    });

    it("authenticated users can read user documents of other teachers in their network", async () => {
      initFirestoreWithOtherUser(teacherAuth, network1);
      // not clear why reading the first teacher twice makes a difference,
      // but I couldn't get it to work reliably without it ¯\_(ツ)_/¯
      await expectReadToSucceed(db, kUserDocPath);
      await expectReadToSucceed(db, kUserDocPath);
      await expectReadToSucceed(db, kOtherUserDocPath);
    });

    it("authenticated users can't read user documents of teachers in other networks", async () => {
      initFirestoreWithOtherUser(teacherAuth, network2);
      // read first teacher twice for consistency with previous case
      await expectReadToSucceed(db, kUserDocPath);
      await expectReadToSucceed(db, kUserDocPath);
      await expectReadToFail(db, kOtherUserDocPath);
    });

    it("authenticated students can't read user documents", async () => {
      db = initFirestore(studentAuth);
      await expectReadToFail(db, kUserDocPath);
    });

    it("authenticated students can't write user documents", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kUserDocPath, specUser());
    });
  });

});
