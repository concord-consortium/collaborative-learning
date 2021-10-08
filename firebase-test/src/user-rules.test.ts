import firebase from "firebase";
import {
  expectReadToFail, expectReadToSucceed, expectWriteToFail, genericAuth,
  initFirestore, network1, prepareEachTest, studentAuth, teacherAuth, teacherId, tearDownTests
} from "./setup-rules-tests";

describe("Firestore security rules for user documents", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  function specUser() {
    return { uid: teacherId, name: "Jane Teacher", type: "teacher", networks: [network1] };
  }

  describe("user documents", () => {
    const kUserDocPath = `authed/myPortal/users/${teacherId}`;

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
