import firebase from "firebase";
import {
  adminWriteDoc, cPath, cProblem, cSection, cUnit, expectDeleteToFail, expectDeleteToSucceed,
  expectReadToFail, expectReadToSucceed, expectUpdateToFail, expectUpdateToSucceed,
  expectWriteToFail, expectWriteToSucceed, genericAuth, initFirestore, mockTimestamp, network1, network2, noNetwork,
  prepareEachTest, studentAuth, teacher2Auth, teacher2Id, teacher2Name, teacherAuth, teacherId, teacherName, tearDownTests
} from "./setup-rules-tests";

describe("Firestore security rules", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  const kCurriculumDocPath = "authed/myPortal/curriculum/myCurriculum";
  // const kTeacher1UserDocPath = `authed/myPortal/users/${teacherId}`;
  const kTeacher2UserDocPath = `authed/myPortal/users/${teacher2Id}`;

  interface ISpecCurriculumDoc {
    add?: Record<string, string | string[] | object>;
    remove?: string[];
  }
  function specCurriculumDoc(options?: ISpecCurriculumDoc) {
    // a valid document specification
    const curriculumDoc = { uid: teacherId, unit: cUnit, problem: cProblem, section: cSection, path: cPath, network: noNetwork };
    // remove specified props for validating the tests that require them
    options?.remove?.forEach(prop => delete (curriculumDoc as any)[prop]);
    // add additional props to test behavior of additional props
    options?.add && Object.keys(options.add).forEach(prop => {
      (curriculumDoc as any)[prop] = options.add?.[prop];
    });
    return curriculumDoc;
  }

  describe("non-networked curriculum documents", () => {
    it("unauthenticated users can't read authenticated user curriculum documents", async () => {
      db = initFirestore();
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("unauthenticated users can't write user curriculum documents", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc());
    });

    it("authenticated generic users can't read authenticated user documents", async () => {
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated generic users can't write user documents", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc());
    });

    it("authenticated teachers can read their own user documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc());
      await expectReadToSucceed(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't read other teachers curriculum documents outside a network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { uid: teacher2Id }}));
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't read other teachers curriculum documents outside a network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { uid: teacher2Id }}));
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't write user documents without required unit", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ remove: ["unit"] }));
    });

    it("authenticated teachers can't write user documents without required problem", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ remove: ["problem"] }));
    });

    it("authenticated teachers can't write user documents without required section", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ remove: ["section"] }));
    });

    it("authenticated teachers can't write user documents without required path", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ remove: ["path"] }));
    });

    it("authenticated teachers can't write user documents without required network", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ remove: ["network"] }));
    });

    it("authenticated teachers can write user documents", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kCurriculumDocPath, specCurriculumDoc());
    });

    it("authenticated teachers can't update user documents' read-only fields", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc());
      await expectUpdateToFail(db, kCurriculumDocPath, { unit: "new-unit" });
    });

    it("authenticated teachers can't delete user documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc());
      await expectDeleteToFail(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't delete other teachers' documents", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc());
      await expectDeleteToFail(db, kCurriculumDocPath);
    });

    it("authenticated students can't read user documents", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc());
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated students can't write user documents", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc());
    });

  });

  describe("non-networked teacher curriculum document comments", () => {
    const kCurriculumCommentDocPath = `${kCurriculumDocPath}/comments/myComment`;

    interface ISpecCommentDoc {
      add?: Record<string, string | string[] | object>;
      remove?: string[];
    }
    function specCommentDoc(options?: ISpecCommentDoc) {
      // a valid comment document specification
      const commentDoc = { uid: teacherId, name: teacherName, network: noNetwork,
                            content: "A comment!", createdAt: mockTimestamp() };
      // remove specified props for validating the tests that require them
      options?.remove?.forEach(prop => delete (commentDoc as any)[prop]);
      // add additional props to test behavior of additional props
      options?.add && Object.keys(options.add).forEach(prop => {
        (commentDoc as any)[prop] = options.add?.[prop];
      });
      return commentDoc;
    }

    const initFirestoreWithUserDocument = async (auth?: any) => {
      db = initFirestore(auth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc());
    };

    it("unauthenticated users can't read document comments", async () => {
      await initFirestoreWithUserDocument();
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kCurriculumCommentDocPath);
    });

    it("unauthenticated users can't write document comments", async () => {
      await initFirestoreWithUserDocument();
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc());
    });

    it("authenticated generic users can't read document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kCurriculumCommentDocPath);
    });

    it("authenticated generic users can't write document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc());
    });

    it("authenticated teachers can read their own document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToSucceed(db, kCurriculumCommentDocPath);
    });

    it("authenticated teachers can't write document comments without required uid", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ remove: ["uid"] }));
    });

    it("authenticated teachers can't write document comments without required name", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ remove: ["name"] }));
    });

    it("authenticated teachers can't write document comments without required name", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ remove: ["content"] }));
    });

    it("authenticated teachers can't write document comments with inconsistent network", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ add: { network: "other-network" } }));
    });

    it("authenticated teachers can write document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToSucceed(db, kCurriculumCommentDocPath, specCommentDoc());
    });

    it("authenticated teachers can't update document comments' read-only uid field", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kCurriculumCommentDocPath, { content: "A new comment!", uid: teacher2Id });
    });

    it("authenticated teachers can't update document comments' read-only network field", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kCurriculumCommentDocPath, { content: "A new comment!", network: "other-network" });
    });

    it("authenticated teachers can update document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToSucceed(db, kCurriculumCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can't update other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kCurriculumCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can delete document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectDeleteToSucceed(db, kCurriculumCommentDocPath);
    });

    it("authenticated teachers can't delete other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectDeleteToFail(db, kCurriculumCommentDocPath);
    });

    it("authenticated students can't read document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kCurriculumCommentDocPath);
    });

    it("authenticated students can't write document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc());
    });

  });

  describe("networked curriculum documents", () => {
    it("unauthenticated users can't read authenticated user curriculum documents", async () => {
      db = initFirestore();
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("unauthenticated users can't write user curriculum documents", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
    });

    it("authenticated generic users can't read authenticated user documents", async () => {
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated generic users can't write user documents", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
    });

    it("authenticated teachers can read their own user documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc());
      await expectReadToSucceed(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't read other teachers curriculum documents outside a network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { uid: teacher2Id, network: network1 }}));
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't read other teachers curriculum documents outside a network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { uid: teacher2Id, network: network1 }}));
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't write user documents without required unit", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 }, remove: ["unit"] }));
    });

    it("authenticated teachers can't write user documents without required problem", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 }, remove: ["problem"] }));
    });

    it("authenticated teachers can't write user documents without required section", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 }, remove: ["section"] }));
    });

    it("authenticated teachers can't write user documents without required path", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 }, remove: ["path"] }));
    });

    it("authenticated teachers can't write user documents without required network", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ remove: ["network"] }));
    });

    it("authenticated teachers can write user documents", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
    });

    it("authenticated teachers can't update user documents' read-only fields", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
      await expectUpdateToFail(db, kCurriculumDocPath, { unit: "new-unit" });
    });

    it("authenticated teachers can't delete user documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
      await expectDeleteToFail(db, kCurriculumDocPath);
    });

    it("authenticated teachers can't delete other teachers' documents", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
      await expectDeleteToFail(db, kCurriculumDocPath);
    });

    it("authenticated students can't read user documents", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
      await expectReadToFail(db, kCurriculumDocPath);
    });

    it("authenticated students can't write user documents", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
    });

  });

  describe("networked teacher curriculum document comments", () => {
    const kCurriculumCommentDocPath = `${kCurriculumDocPath}/comments/myComment`;

    interface ISpecCommentDoc {
      add?: Record<string, string | string[] | object>;
      remove?: string[];
    }
    function specCommentDoc(options?: ISpecCommentDoc) {
      // a valid comment document specification
      const commentDoc = { uid: teacherId, name: teacherName, network: network1,
                            content: "A comment!", createdAt: mockTimestamp() };
      // remove specified props for validating the tests that require them
      options?.remove?.forEach(prop => delete (commentDoc as any)[prop]);
      // add additional props to test behavior of additional props
      options?.add && Object.keys(options.add).forEach(prop => {
        (commentDoc as any)[prop] = options.add?.[prop];
      });
      return commentDoc;
    }

    const initFirestoreWithUserDocument = async (auth?: any) => {
      db = initFirestore(auth);
      await adminWriteDoc(kCurriculumDocPath, specCurriculumDoc({ add: { network: network1 } }));
    };

    it("unauthenticated users can't read document comments", async () => {
      await initFirestoreWithUserDocument();
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kCurriculumCommentDocPath);
    });

    it("unauthenticated users can't write document comments", async () => {
      await initFirestoreWithUserDocument();
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc());
    });

    it("authenticated generic users can't read document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kCurriculumCommentDocPath);
    });

    it("authenticated generic users can't write document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc());
    });

    it("authenticated teachers can read their own document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToSucceed(db, kCurriculumCommentDocPath);
    });

    it("authenticated teachers can't write document comments without required uid", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ remove: ["uid"] }));
    });

    it("authenticated teachers can't write document comments without required name", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ remove: ["name"] }));
    });

    it("authenticated teachers can't write document comments without required name", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ remove: ["content"] }));
    });

    it("authenticated teachers can't write document comments with inconsistent network", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ add: { network: "other-network" } }));
    });

    it("authenticated teachers can write document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToSucceed(db, kCurriculumCommentDocPath, specCommentDoc());
    });

    it("authenticated teachers can't write document comments to other teachers' documents outside the network", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      // write user information for teacher 2 that puts them in the same network as teacher 1
      await adminWriteDoc(kTeacher2UserDocPath, { uid: teacher2Id, name: teacher2Name, type: "teacher", networks: [network2] });
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc({ add: { uid: teacher2Id } }));
    });

    it("authenticated teachers can read document comments on other teachers' documents in the network", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      // write user information for teacher 2 that puts them in the same network as teacher 1
      await adminWriteDoc(kTeacher2UserDocPath, { uid: teacher2Id, name: teacher2Name, type: "teacher", networks: [network1] });
      await expectReadToSucceed(db, kCurriculumCommentDocPath);
    });

    it("authenticated teachers can write document comments to other teachers' documents in the network", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      // write user information for teacher 2 that puts them in the same network as teacher 1
      await adminWriteDoc(kTeacher2UserDocPath, { uid: teacher2Id, name: teacher2Name, type: "teacher", networks: [network1] });
      await expectWriteToSucceed(db, kCurriculumCommentDocPath, specCommentDoc({ add: { uid: teacher2Id } }));
    });

    it("authenticated teachers can update their own comments to other teachers' documents in the network", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      // write user information for teacher 2 that puts them in the same network as teacher 1
      await adminWriteDoc(kTeacher2UserDocPath, { uid: teacher2Id, name: teacher2Name, type: "teacher", networks: [network1] });
      await expectWriteToSucceed(db, kCurriculumCommentDocPath, specCommentDoc({ add: { uid: teacher2Id, content: "Updated comment" } }));
    });

    it("authenticated teachers can delete their own comments to other teachers' documents in the network", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      // write user information for teacher 2 that puts them in the same network as teacher 1
      await adminWriteDoc(kTeacher2UserDocPath, { uid: teacher2Id, name: teacher2Name, type: "teacher", networks: [network1] });
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc({ add: { uid: teacher2Id } }));
      await expectDeleteToSucceed(db, kCurriculumCommentDocPath);
    });

    it("authenticated teachers can't update document comments' read-only uid field", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kCurriculumCommentDocPath, { content: "A new comment!", uid: teacher2Id });
    });

    it("authenticated teachers can't update document comments' read-only network field", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kCurriculumCommentDocPath, { content: "A new comment!", network: "other-network" });
    });

    it("authenticated teachers can update document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToSucceed(db, kCurriculumCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can't update other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kCurriculumCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can delete document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectDeleteToSucceed(db, kCurriculumCommentDocPath);
    });

    it("authenticated teachers can't delete other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectDeleteToFail(db, kCurriculumCommentDocPath);
    });

    it("authenticated students can't read document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await adminWriteDoc(kCurriculumCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kCurriculumCommentDocPath);
    });

    it("authenticated students can't write document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await expectWriteToFail(db, kCurriculumCommentDocPath, specCommentDoc());
    });

  });

});
