import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectDeleteToSucceed, expectReadToFail, expectReadToSucceed,
  expectWriteToFail, expectWriteToSucceed, genericAuth, initFirestore, otherClass, prepareEachTest,
  student2Auth, studentAuth, teacher2Auth, teacherAuth, teacherId, tearDownTests, thisClass
} from "./setup-rules-tests";

describe("Firestore security rules", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  describe("portal documents", () => {
    const kPortalDocPath = "authed/myPortal";

    it("unauthenticated users can't read portal documents", async () => {
      db = initFirestore();
      await expectReadToFail(db, kPortalDocPath);
    });

    it("unauthenticated users can't write portal documents", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kPortalDocPath, { foo: "bar" });
    });

    it("authenticated generic users can't read portal documents", async () => {
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kPortalDocPath);
    });

    it("authenticated generic users can't write portal documents", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kPortalDocPath, { foo: "bar" });
    });

    it("authenticated teachers can read portal documents", async () => {
      db = initFirestore(teacherAuth);
      await expectReadToSucceed(db, kPortalDocPath);
    });

    it("authenticated teachers can write portal documents", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kPortalDocPath, { foo: "bar" });
    });

    it("authenticated students can't read portal documents", async () => {
      db = initFirestore(studentAuth);
      await expectReadToFail(db, kPortalDocPath);
    });

    it("authenticated students can't write portal documents", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kPortalDocPath, { foo: "bar" });
    });
  });

  describe("multi-class supports", () => {
    const kSupportDocPath = "authed/myPortal/mcsupports/mySupport";

    interface ISpecSupportDoc {
      add?: Record<string, string | string[] | object>;
      remove?: string[];
    }
    function specSupportDoc(options?: ISpecSupportDoc) {
      // a valid support document specification
      const supportDoc = { uid: teacherId, classes: [thisClass], context_id: thisClass,
                            type: "supportPublication", content: {} };
      // remove specified props for validating the tests that require them
      options?.remove?.forEach(prop => delete (supportDoc as any)[prop]);
      // add additional props to test behavior of additional props
      options?.add && Object.keys(options.add).forEach(prop => {
        (supportDoc as any)[prop] = options.add?.[prop];
      });
      return supportDoc;
    }

    it("unauthenticated users can't read multi-class supports", async () => {
      db = initFirestore();
      await expectReadToFail(db, kSupportDocPath);
    });

    it("unauthenticated users can't write multi-class supports", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc());
    });

    it("authenticated generic users can't read multi-class supports", async () => {
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kSupportDocPath);
    });

    it("authenticated generic users can't write multi-class supports", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc());
    });

    it("authenticated teachers can't create multi-class supports without valid uid", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc({ remove: ["uid"] }));
    });

    it("authenticated teachers can't create multi-class supports without valid classes", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc({ remove: ["classes"] }));
    });

    it("authenticated teachers can't create multi-class supports without valid context_id", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc({ remove: ["context_id"] }));
    });

    it("authenticated teachers can't create multi-class supports without valid type", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc({ remove: ["type"] }));
    });

    it("authenticated teachers can't create multi-class supports without content", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc({ remove: ["content"] }));
    });

    it("authenticated teachers can create valid multi-class supports", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kSupportDocPath, specSupportDoc());
    });

    it("authenticated teacher users can't create multi-class supports for other teachers", async () => {
      db = initFirestore(teacher2Auth);
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc());
    });

    it("authenticated teachers can read multi-class supports for their class", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc())
      await expectReadToSucceed(db, kSupportDocPath);
    });

    it("authenticated teachers can read multi-class supports for their co-teachers' classes", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc({ add: { classes: [thisClass, otherClass] } }));
      await expectReadToSucceed(db, kSupportDocPath);
    });

    it("authenticated teachers can update their own multi-class supports", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc())
      await expectWriteToSucceed(db, kSupportDocPath, specSupportDoc({ add: { content: { foo: "bar" } } }));
    });

    it("authenticated teachers can't update other teachers' multi-class supports", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc({ add: { classes: [thisClass, otherClass] } }))
      await expectWriteToFail(db, kSupportDocPath, specSupportDoc({ add: { content: { foo: "bar" } } }));
    });

    it("authenticated teachers can delete their own multi-class supports", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc())
      await expectDeleteToSucceed(db, kSupportDocPath);
    });

    it("authenticated teachers can't delete other teachers' multi-class supports", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc({ add: { classes: [thisClass, otherClass] } }))
      await expectDeleteToFail(db, kSupportDocPath);
    });

    it("authenticated students can read multi-class supports for their class", async () => {
      db = initFirestore(studentAuth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc());
      await expectReadToSucceed(db, kSupportDocPath);
    });

    it("authenticated students can't read multi-class supports for other classes", async () => {
      db = initFirestore(student2Auth);
      await adminWriteDoc(kSupportDocPath, specSupportDoc());
      await expectReadToFail(db, kSupportDocPath);
    });
  });
});
