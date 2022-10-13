import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectDeleteToSucceed, expectReadToFail, expectReadToSucceed,
  expectUpdateToFail, expectUpdateToSucceed, expectWriteToFail, expectWriteToSucceed, genericAuth,
  initFirestore, mockTimestamp, noNetwork, prepareEachTest, studentAuth, studentId, teacher2Auth, teacher2Id, teacherAuth,
  teacherId, teacherName, tearDownTests, thisClass
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
    const documentDoc = { context_id: thisClass, network: noNetwork, teachers: [teacherId], uid: teacherId,
                          type: "problemDocument", key: "my-document", createdAt: mockTimestamp() };
    // remove specified props for validating the tests that require them
    options?.remove?.forEach(prop => delete (documentDoc as any)[prop]);
    // add additional props to test behavior of additional props
    options?.add && Object.keys(options.add).forEach(prop => {
      (documentDoc as any)[prop] = options.add?.[prop];
    });
    return documentDoc;
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

    it("student can tell if document exists, but not read it", async () => {
      db = initFirestore(studentAuth);
      await expectReadToSucceed(db, kDocumentDocPath);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToFail(db, kDocumentDocPath);
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
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ remove: ["uid"] }));
    });

    it("authenticated teachers can't write user documents without required network", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ remove: ["network"] }));
    });

    it("authenticated teachers can't write user documents without required type", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ remove: ["type"] }));
    });

    it("authenticated teachers can't write user documents without required key", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc({ remove: ["key"] }));
    });

    it("authenticated teachers can write user documents", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kDocumentDocPath, specDocumentDoc());
    });

    it("authenticated teachers can update user documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToSucceed(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated teachers can't update user documents' read-only fields", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title", uid: teacher2Id });
    });

    it("authenticated teachers can't update other teachers' documents", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectUpdateToFail(db, kDocumentDocPath, { title: "new-title" });
    });

    it("authenticated teachers can delete user documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectDeleteToSucceed(db, kDocumentDocPath);
    });

    it("authenticated teachers can't delete other teachers' documents", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectDeleteToFail(db, kDocumentDocPath);
    });

    it("authenticated students can't read user documents", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToFail(db, kDocumentDocPath);
    });

    it("authenticated students can't write user documents", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kDocumentDocPath, specDocumentDoc());
    });

  });

  describe("history entries", () => {
    const kDocumentDocPath = "authed/myPortal/documents/myDocument";
    const kDocumentHistoryDocPath = `${kDocumentDocPath}/history/myHistoryEntry`;
    interface ISpecHisoryDoc {
      add?: Record<string, string | string[] | object>;
      remove?: string[];
    }
    function specHistoryEntryDoc(options?: ISpecHisoryDoc) {
      // a valid history document specification
      const historyDoc = { id: "an-id", tree: "my-document", action: "/content/stuff",
                           undoable: true, createdAt: mockTimestamp(),
                           records: [], state: "complete"
                         };
      // remove specified props for validating the tests that require them
      options?.remove?.forEach(prop => delete (historyDoc as any)[prop]);
      // add additional props to test behavior of additional props
      options?.add && Object.keys(options.add).forEach(prop => {
        (historyDoc as any)[prop] = options.add?.[prop];
      });
      return historyDoc;
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
    
    it("unauthed user cannot read. Parent doc does not exist", async () => {
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
    
    it ("student cannot read their own history entries if no parent", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToFail(db, kDocumentHistoryDocPath);
    });
    
    it ("teacher can read student history", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(db, kDocumentHistoryDocPath);
    });
    
    it ("users authed from different portals cannot read each other's history entries", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      await expectReadToFail(db, "authed/otherPortal/documents/myDocument/history/myHistoryEntry");
    });

    it ("user cannot read someone else's history entries", async () => {
      db = initFirestore(genericAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await adminWriteDoc(kDocumentHistoryDocPath, specHistoryEntryDoc());
      expectReadToFail(db, kDocumentHistoryDocPath);
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
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
      await expectWriteToSucceed(db, kDocumentHistoryDocPath, specHistoryEntryDoc());
    });

    it ("users authed from different portals cannot write each other's history entries", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kDocumentDocPath, specHistoryEntryParentDoc({add:{uid: studentId }}));
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

  describe("teacher document comments", () => {
    const kDocumentCommentDocPath = `${kDocumentDocPath}/comments/myComment`;

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
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
    };

    it("unauthenticated users can't read document comments", async () => {
      await initFirestoreWithUserDocument();
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kDocumentCommentDocPath);
    });

    it("unauthenticated users can't write document comments", async () => {
      await initFirestoreWithUserDocument();
      await expectWriteToFail(db, kDocumentCommentDocPath, specCommentDoc());
    });

    it("authenticated generic users can't read document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated generic users can't write document comments", async () => {
      await initFirestoreWithUserDocument(genericAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specCommentDoc());
    });

    it("authenticated teachers can read their own document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectReadToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated teachers can't write document comments without required uid", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specCommentDoc({ remove: ["uid"] }));
    });

    it("authenticated teachers can't write document comments without required name", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specCommentDoc({ remove: ["name"] }));
    });

    it("authenticated teachers can't write document comments without required name", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specCommentDoc({ remove: ["content"] }));
    });

    it("authenticated teachers can't write document comments with inconsistent network", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specCommentDoc({ add: { network: "other-network" } }));
    });

    it("authenticated teachers can write document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await expectWriteToSucceed(db, kDocumentCommentDocPath, specCommentDoc());
    });

    it("authenticated teachers can't update document comments' read-only uid field", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!", uid: teacher2Id });
    });

    it("authenticated teachers can't update document comments' read-only network field", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!", network: "other-network" });
    });

    it("authenticated teachers can update document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectUpdateToSucceed(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can't update other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectUpdateToFail(db, kDocumentCommentDocPath, { content: "A new comment!" });
    });

    it("authenticated teachers can delete document comments", async () => {
      await initFirestoreWithUserDocument(teacherAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectDeleteToSucceed(db, kDocumentCommentDocPath);
    });

    it("authenticated teachers can't delete other teachers' document comments", async () => {
      await initFirestoreWithUserDocument(teacher2Auth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectDeleteToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated students can't read document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await adminWriteDoc(kDocumentCommentDocPath, specCommentDoc());
      await expectReadToFail(db, kDocumentCommentDocPath);
    });

    it("authenticated students can't write document comments", async () => {
      await initFirestoreWithUserDocument(studentAuth);
      await expectWriteToFail(db, kDocumentCommentDocPath, specCommentDoc());
    });

  });

});
