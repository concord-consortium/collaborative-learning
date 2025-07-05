import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectDeleteToSucceed, expectReadToFail, expectReadToSucceed,
  expectUpdateToFail, expectUpdateToSucceed, expectWriteToFail, expectWriteToSucceed, genericAuth,
  initFirestore, mockTimestamp, network1, network2, noNetwork, otherClass, prepareEachTest,
  researcherAuth,
  researcherId,
  student2Id,
  studentAuth, studentId,
  studentName,
  teacher2Auth, teacher2Id, teacher2Name,
  teacher4Auth, teacher4Id, teacher4Name,
  teacherAuth, teacherId, teacherName,
  tearDownTests,
  thisClass
} from "./setup-rules-tests";

describe("Firestore security rules", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  const kDocumentDocPath = "authed/myPortal/documents/myDocument";

  interface ISpecDocumentDoc {
    add?: Record<string, string | string[] | object>;
    remove?: string[];
  }
  function specDocumentDoc(options?: ISpecDocumentDoc) {
    // a valid document specification
    const documentDoc = { context_id: thisClass, network: noNetwork, uid: teacherId,
                          type: "problemDocument", key: "my-document", createdAt: mockTimestamp() };
    // remove specified props for validating the tests that require them
    options?.remove?.forEach(prop => delete (documentDoc as any)[prop]);
    // add additional props to test behavior of additional props
    options?.add && Object.keys(options.add).forEach(prop => {
      (documentDoc as any)[prop] = options.add?.[prop];
    });
    return documentDoc;
  }

  const kUsersDocPath = `authed/myPortal/users`;

  async function specTeacher2(network: string) {
    await adminWriteDoc(`${kUsersDocPath}/${teacher2Id}`,
      { uid: teacher2Id, name: teacher2Name, type: "teacher", network, networks: [network] });
  }

  async function specTeacher4(network: string) {
    await adminWriteDoc(`${kUsersDocPath}/${teacher4Id}`,
      { uid: teacher4Id, name: teacher4Name, type: "teacher", network, networks: [network] });
  }

  const kClassDocPath = `authed/myPortal/classes`;

  async function specClassDoc(classId: string, tId: string) {
    await adminWriteDoc(`${kClassDocPath}/${classId}`,
        { id: classId,
          name: 'MyClass',
          context_id: classId,
          teacher: "Some Teacher",
          teachers: [tId]
        }
      );
  }

  describe("user documents", () => {
    it("unauthenticated users can't read authenticated user documents", async () => {
      db = initFirestore();
      await expectReadToFail(db, kDocumentDocPath);
    });

    it("unauthenticated users can't write user documents", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc());
    });

    it("authenticated generic users can't read authenticated user documents", async () => {
      db = initFirestore(genericAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToFail(db, kDocumentDocPath);
    });

    it("authenticated generic users can't write user documents", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc());
    });

    it("authenticated teachers can read their own user documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it("teacher can tell if document exists", async () => {
      db = initFirestore(teacherAuth);
      await expectReadToSucceed(db, kDocumentDocPath);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it("generic auth can tell if document exists, but not read it", async () => {
      db = initFirestore(genericAuth);
      await expectReadToSucceed(db, kDocumentDocPath);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToFail(db, kDocumentDocPath);
    });

    it("un auth'd can't tell if document exists", async () => {
      db = initFirestore();
      await expectReadToFail(db, kDocumentDocPath);
    });

    it("authenticated teachers can't write user documents without required uid", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ remove: ["uid"] }));
    });

    it("authenticated teachers can't write user documents without required type", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ remove: ["type"] }));
    });

    it("authenticated teachers can't write user documents without required key", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ remove: ["key"] }));
    });

    it("authenticated teachers can write user documents", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await expectWriteToSucceed(db, kDocumentDocPath, specDocumentDoc());
    });

    it("authenticated teachers can update user documents", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToSucceed(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated teachers can update legacy user documents", async () => {
      // Before 8/2024, teachers were listed in documents directly, rather than looked up in the class docs.
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { teachers: [teacherId] }}));
      await expectUpdateToSucceed(db, kDocumentDocPath, { title: "new-title" });
    });

    // Should teachers be able to create documents in other classes that they belong to
    // (that is, a class other than the one they logged in with)?
    // If so, these tests should be unskipped.
    it("authenticated teachers can write user documents in secondary class", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await specClassDoc(otherClass, teacherId);
      await expectWriteToSucceed(db, kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
    });

    it("authenticated teachers can update user documents in secondary class", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await specClassDoc(otherClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectUpdateToSucceed(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated teachers can't write user documents in unrelated class", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
    });

    it("authenticated teachers can't update user documents in unrelated class", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, ({ add: { context_id: otherClass }}));
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated teachers can't update user documents' read-only uid field", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title", uid: teacher2Id });
    });

    it("authenticated teachers can't update user documents' read-only type field", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title", type: "LearningLog" });
    });

    it("authenticated teachers can't update user documents' read-only key field", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title", key: "my-new-document" });
    });

    it("authenticated teachers can't update user documents' read-only createdAt field", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title", createdAt: mockTimestamp() });
    });

    it("authenticated teachers can't update user documents' read-only context-id field", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title", context_id: otherClass });
    });

    it("authenticated teachers can't update other teachers' documents", async () => {
      db = initFirestore(teacher2Auth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated teachers can delete user documents", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectDeleteToSucceed(db, kDocumentDocPath);
    });

    it("authenticated teachers can't delete other teachers' documents", async () => {
      db = initFirestore(teacher2Auth);
      await specClassDoc(thisClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectDeleteToFail(db, kDocumentDocPath);
    });

    it("authenticated teachers can read documents from their network", async () => {
      db = initFirestore(teacher2Auth);

      // any teacher can look for non-existent documents
      await expectReadToSucceed(db, kDocumentDocPath);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({add:{network:network1}}));
      await specTeacher2(network1);
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it("authenticated teachers can read documents from their class", async () => {
      db = initFirestore(teacher4Auth);

      // any teacher can look for non-existent documents
      await expectReadToSucceed(db, kDocumentDocPath);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({add:{network:network1}}));
      await specTeacher4(network2);
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it("authenticated researchers can tell if a document exists", async () => {
      db = initFirestore(researcherAuth);
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it("authenticated researchers can read documents from their class", async () => {
      db = initFirestore(researcherAuth);
      // own doc
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { uid: researcherId } }));
      await expectReadToSucceed(db, kDocumentDocPath);

      // other user's doc
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it("authenticated researchers can't read documents from other classes", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectReadToFail(db, kDocumentDocPath);
    });

    it("authenticated researchers can write user documents", async () => {
      db = initFirestore(researcherAuth);
      await expectWriteToSucceed(db, kDocumentDocPath, specDocumentDoc({ add: { uid: researcherId } }));
    });

    it("authenticated researchers can't write user documents in other classes", async () => {
      db = initFirestore(researcherAuth);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass, uid: researcherId } }));
    });

    it("authenticated researchers can update user documents", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { uid: researcherId } }));
      await expectUpdateToSucceed(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated researchers can't update other users' documents", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToSucceed(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated researchers can't update user documents in other classes", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass, uid: researcherId } }));
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated researchers can delete user documents", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { uid: researcherId}}));
      await expectDeleteToSucceed(db, kDocumentDocPath);
    });

    it("authenticated researchers can't delete other users' documents", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectDeleteToFail(db, kDocumentDocPath);
    });

    it("authenticated students can read documents in their class", async () => {
      db = initFirestore(studentAuth);
      await expectReadToSucceed(db, kDocumentDocPath);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it("authenticated students can't read documents in a different class", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectReadToFail(db, kDocumentDocPath);
    });

    it("authenticated students can create documents in their class", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToSucceed(db, kDocumentDocPath, specDocumentDoc());
    });

    it("authenticated students can't create documents in a different class", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
    });

    it("authenticated students can update documents in their class", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToSucceed(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated students can't update documents in a different class", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated students can't delete documents in their class", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectDeleteToFail(db, kDocumentDocPath);
    });

    it("authenticated students can't delete documents in a different class", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectDeleteToFail(db, kDocumentDocPath);
    });

  });

  describe("history entries", () => {
    const kDocumentHistoryDocPath = `${kDocumentDocPath}/history/myHistoryEntry`;
    interface ISpecHisoryDoc {
      add?: Record<string, string | string[] | object>;
      remove?: string[];
    }
    function specHistoryEntryDoc(options?: ISpecHisoryDoc) {
      // a valid history document specification
      const historyDoc = {id: "an-id", tree: "my-document", action: "/content/stuff",
                           undoable: true, createdAt: mockTimestamp(),
                           records: [], state: "complete"
                         };
      const doc = {index: 1, entry: JSON.stringify(historyDoc), created: mockTimestamp(), previousEntryId: "prev-id"};

      // remove specified props for validating the tests that require them
      options?.remove?.forEach(prop => delete (doc as any)[prop]);
      // add additional props to test behavior of additional props
      options?.add && Object.keys(options.add).forEach(prop => {
        (doc as any)[prop] = options.add?.[prop];
      });
      return doc;
    }
    function specHistoryEntryParentDoc(options?: ISpecHisoryDoc) {
      const historyDoc = {context_id: thisClass, network: noNetwork, teachers: [teacherId], uid: teacherId,
        type: "problemDocument", key: "my-document", createdAt: mockTimestamp()};
      // remove specified props for validating the tests that require them
      options?.remove?.forEach(prop => delete (historyDoc as any)[prop]);
      // add additional props to test behavior of additional props
      options?.add && Object.keys(options.add).forEach(prop => {
        (historyDoc as any)[prop] = options.add?.[prop];
      });
      return historyDoc;
    }

    it("unauthed reads fail", async () => {
      db = initFirestore();
      await expectReadToFail(db, kDocumentHistoryDocPath);
    });

    it("unauthed user cannot read. Parent doc exists", async () => {
      db = initFirestore();
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc());
      await expectReadToFail(db, kDocumentHistoryDocPath);
    });

    it ("student can read their own history entries", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(db, kDocumentHistoryDocPath);
    });
    it ("student can read parent if it already exists", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await expectReadToSucceed(db, kDocumentDocPath);
    });

    it ("student cannot read their own history entries if no parent", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToFail(db, kDocumentHistoryDocPath);
    });

    it ("teacher can read student history in teacher list", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(db, kDocumentHistoryDocPath);
    });

    it("teacher cannot read student history if not in the list and not in class", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath,
        specHistoryEntryParentDoc({add:{uid: studentId, teachers: [99, 100], context_id: otherClass }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToFail(db, kDocumentHistoryDocPath);
    });

    it ("teacher in network can read student history", async () => {
      db = initFirestore(teacher2Auth);
      await specTeacher2(network1);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId, network: network1 }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(db, kDocumentHistoryDocPath);
    });

    it ("co-teacher in class can read student history", async () => {
      db = initFirestore(teacher4Auth);
      await specTeacher4(network2);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(db, kDocumentHistoryDocPath);
    });

    it ("researcher can read student history for student in class", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(db, kDocumentHistoryDocPath);
    });

    it("researcher can't read student history for student not in class", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId, context_id: otherClass }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToFail(db, kDocumentHistoryDocPath);
    });

    it("researcher can read own history entries", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: researcherId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(db, kDocumentHistoryDocPath);
    });

    it("researcher can write own history entries", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: researcherId }}));
      await expectWriteToSucceed(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    // FIX-ME: https://www.pivotaltracker.com/n/projects/2441242/stories/183545430
    it.skip("users authed from different portals cannot read each other's history entries", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc("authed/otherPortal/documents/myDocument", specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToFail(db, "authed/otherPortal/documents/myDocument/history/myHistoryEntry");
    });

    it ("user cannot read someone else's history entries", async () => {
      db = initFirestore(genericAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToFail(db, kDocumentHistoryDocPath);
    });

    it("unauthed user cannot write. Parent doc does not exist", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    it("unauthed user cannot write. Parent doc exists", async () => {
      db = initFirestore();
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc());
      await expectWriteToFail(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    it ("student can write their own history entries", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add: {uid: studentId }}));
      await expectWriteToSucceed(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    // FIX-ME: https://www.pivotaltracker.com/n/projects/2441242/stories/183545430
    it.skip("users authed from different portals cannot write each other's history entries", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc("authed/otherPortal/documents/myDocument", specHistoryEntryParentDoc({add: {uid: studentId }}));
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({ add: {uid: studentId }}));
      await expectWriteToFail(db, "authed/otherPortal/documents/myDocument/history/myHistoryEntry", specHistoryEntryDoc());
    });

    it ("user cannot write someone else's history entries", async () => {
      db = initFirestore(genericAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add: {uid: studentId}}));
      await expectWriteToFail(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    it ("user cannot write their history entries if no parent document", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    it ("teacher can write their own history entries", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: teacherId }}));
      await expectWriteToSucceed(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    it ("all updates fail", async () => {
      db = initFirestore();
      await expectUpdateToFail(db, kDocumentHistoryDocPath, {});
    });

    it ("all deletes fail", async () => {
      db = initFirestore();
      await expectUpdateToFail(db, kDocumentHistoryDocPath, {});
    });
  });

  describe("document comments", () => {
    const kDocumentCommentDocPath = `${kDocumentDocPath}/comments/myComment`;

    interface ISpecCommentDoc {
      add?: Record<string, string | string[] | object>;
      remove?: string[];
    }
    function specTeacherCommentDoc(options?: ISpecCommentDoc) {
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

    function specStudentCommentDoc(options?: ISpecCommentDoc) {
      // a valid comment document specification
      const commentDoc = { uid: studentId, name: studentName, network: noNetwork,
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
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
    };

    it("unauthenticated users can't read document comments", async () => {
      await initFirestoreWithUserDocument();
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToFail(db, kDocumentCommentDocPath);
    });

    it("unauthenticated users can't write document comments", async () => {
      await initFirestoreWithUserDocument();
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc());
    });

    it("authenticated generic users can't read document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated generic users can't write document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc());
    });

    it("authenticated teachers can read their own document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it ("teacher in network can read document comments from other classes", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({add: {network: network1}}));
      await specTeacher2(network1);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it ("co-teacher not in network can read document comments from the class", async () => {
      db = initFirestore(teacher4Auth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({add: {network: network1}}));
      await specTeacher4(network2);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it ("teacher can look for comments on a metadata document that doesn't exist", async () => {
      db = initFirestore(teacherAuth);

      // In practice this is not going to be a direct comment read. Instead it will be a query
      // for the list of comments under the document. However the access check should be the
      // same.
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated teachers can't write document comments without required uid", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc({ remove: ["uid"] }));
    });

    it("authenticated teachers can't write document comments without required name", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc({ remove: ["name"] }));
    });

    it("authenticated teachers can't write document comments without required content", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc({ remove: ["content"] }));
    });

    it("authenticated teachers can't write document comments with inconsistent network", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc({ add: { network: "other-network" } }));
    });

    it("authenticated teachers can write document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToSucceed(db, kDocumentCommentDocPath, specTeacherCommentDoc());
    });

    it("authenticated teachers can write comment in secondary class", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await specClassDoc(otherClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectWriteToSucceed(db, kDocumentCommentDocPath, specTeacherCommentDoc());
    });

    it("authenticated teachers can't update document comments' read-only uid field", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!", uid: teacher2Id });
    });

    it("authenticated teachers can update document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectUpdateToSucceed(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can update comments in secondary class", async () => {
      db = initFirestore(teacherAuth);
      await specClassDoc(thisClass, teacherId);
      await specClassDoc(otherClass, teacherId);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectUpdateToSucceed(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can't update other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can delete document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectDeleteToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated teachers can't delete other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectDeleteToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated researcher can read own document comments", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc({ add: { uid: researcherId } }));
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated researcher can read document comments from their class", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated researcher can't read document comments from other classes", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated researcher can write document comments", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectWriteToSucceed(db, kDocumentCommentDocPath, specTeacherCommentDoc({ add: { uid: researcherId } }));
    });

    it("authenticated researcher can't write other users' comments", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc());
    });

    it("authenticated researcher can't write comments in other classes", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc({ add: { uid: researcherId } }));
    });

    it("authenticated researcher can update document comments", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc({ add: { uid: researcherId } }));
      await expectUpdateToSucceed(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated researcher can't update other users' comments", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated researcher can't update comments in other classes", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc({ add: { uid: researcherId } }));
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated researcher can delete document comments", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc({ add: { uid: researcherId } }));
      await expectDeleteToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated researcher can't delete other users' comments", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectDeleteToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated students can read their own document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specStudentCommentDoc());
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated students can read document comments from their class", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc());
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated students can't read document comments from other classes", async () => {
      await initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await adminWriteDoc(kDocumentCommentDocPath, specTeacherCommentDoc({ add: { context_id: otherClass }}));
      await expectReadToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated students can write document comments on their own document", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await expectWriteToSucceed(db, kDocumentCommentDocPath, specStudentCommentDoc());
    });

    it("authenticated students can write document comments on other users' documents", async () => {
      await initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { uid: student2Id }}));
      await expectWriteToSucceed(db, kDocumentCommentDocPath, specStudentCommentDoc());
    });

    it("authenticated students can't write other users' comments", async () => {
      await initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { uid: student2Id }}));
      await expectWriteToFail(db, kDocumentCommentDocPath, specTeacherCommentDoc());
    });

    it("authenticated students can't write comments in other classes", async () => {
      await initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await expectWriteToFail(db, kDocumentCommentDocPath, specStudentCommentDoc());
    });

    it("authenticated students can update their own document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specStudentCommentDoc());
      await expectUpdateToSucceed(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated students can't update other users' comments", async () => {
      await initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specStudentCommentDoc({ add: { uid: student2Id }}));
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated students can't update comments in other classes", async () => {
      await initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ add: { context_id: otherClass }}));
      await adminWriteDoc(kDocumentCommentDocPath, specStudentCommentDoc({ add: { context_id: otherClass }}));
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated students can delete their own document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specStudentCommentDoc());
      await expectDeleteToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated students can't delete other users' comments", async () => {
      await initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kDocumentCommentDocPath, specStudentCommentDoc({ add: { uid: student2Id }}));
      await expectDeleteToFail(db, kDocumentCommentDocPath);
    });
  });

});
