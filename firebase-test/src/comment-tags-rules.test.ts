import firebase from "firebase";
import {
  adminWriteDoc, cUnit, expectReadToFail, expectReadToSucceed, expectWriteToFail,
  expectWriteToSucceed, genericAuth, initFirestore, prepareEachTest, researcherAuth, student2Auth,
  studentAuth, teacher2Auth, teacher2Id, teacherId, teacherAuth, tearDownTests, thisClass
} from "./setup-rules-tests";

describe("Firestore security rules", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  describe("custom comment tags", () => {
    const kTagId = "my-tag";
    const kTagPath = `authed/myPortal/commentTags/${thisClass}/units/${cUnit}/tags/${kTagId}`;
    // A payload consistent with the path and attributed to the requesting teacher.
    const validTag = () => ({
      id: kTagId, label: "My Tag", classHash: thisClass, unit: cUnit, createdBy: teacherId
    });

    it("a teacher in the class can create a valid tag", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kTagPath, validTag());
    });

    it("rejects a tag whose createdBy isn't the requesting teacher", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kTagPath, { ...validTag(), createdBy: "999" });
    });

    it("rejects a tag with an empty label", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kTagPath, { ...validTag(), label: "" });
    });

    it("rejects a tag whose payload fields don't match its path", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kTagPath, { ...validTag(), classHash: "some-other-class" });
      await expectWriteToFail(db, kTagPath, { ...validTag(), id: "different-id" });
    });

    it("a teacher of a different class (not in this class) can't write tags here", async () => {
      db = initFirestore(teacher2Auth);
      await expectWriteToFail(db, kTagPath, validTag());
    });

    // teacher2's own class_hash is otherClass, but they're listed as a teacher of thisClass, so
    // teacherIsInClass grants access.
    async function addTeacherToClass(classId: string, tId: string) {
      await adminWriteDoc(`authed/myPortal/classes/${classId}`,
        { id: classId, name: "MyClass", context_id: classId, teacher: "Some Teacher", teachers: [tId] });
    }

    it("a networked teacher (listed in the class) can write tags here", async () => {
      await addTeacherToClass(thisClass, teacher2Id);
      db = initFirestore(teacher2Auth);
      await expectWriteToSucceed(db, kTagPath, { ...validTag(), createdBy: teacher2Id });
    });

    it("a networked teacher (listed in the class) can read tags here", async () => {
      await addTeacherToClass(thisClass, teacher2Id);
      await adminWriteDoc(kTagPath, validTag());
      db = initFirestore(teacher2Auth);
      await expectReadToSucceed(db, kTagPath);
    });

    it("a student in the class can read tags", async () => {
      await adminWriteDoc(kTagPath, validTag());
      db = initFirestore(studentAuth);
      await expectReadToSucceed(db, kTagPath);
    });

    it("a researcher in the class can read tags (to see/use them when commenting)", async () => {
      await adminWriteDoc(kTagPath, validTag());
      db = initFirestore(researcherAuth);
      await expectReadToSucceed(db, kTagPath);
    });

    it("a researcher in the class can't write tags", async () => {
      db = initFirestore(researcherAuth);
      await expectWriteToFail(db, kTagPath, validTag());
    });

    it("a student in the class can't write tags", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kTagPath, validTag());
    });

    it("a student in a different class can't read tags", async () => {
      await adminWriteDoc(kTagPath, validTag());
      db = initFirestore(student2Auth);
      await expectReadToFail(db, kTagPath);
    });

    it("unauthenticated users can't read or write tags", async () => {
      await adminWriteDoc(kTagPath, validTag());
      db = initFirestore();
      await expectReadToFail(db, kTagPath);
      await expectWriteToFail(db, kTagPath, validTag());
    });

    it("authenticated generic (non-portal) users can't read or write tags", async () => {
      await adminWriteDoc(kTagPath, validTag());
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kTagPath);
      await expectWriteToFail(db, kTagPath, validTag());
    });
  });
});
