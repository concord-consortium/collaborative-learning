import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectReadToFail, expectReadToSucceed, expectWriteToFail, expectWriteToSucceed,
  genericAuth, initFirestore, network1, network2, prepareEachTest, studentAuth,
  teacher2Auth, teacher2Id, teacher2Name, teacher3Auth, teacher3Id, teacher3Name, teacherAuth, teacherId, teacherName,
  tearDownTests, thisClass
} from "./setup-rules-tests";

describe("Firestore security rules for offering (activity) documents", () => {

  let db: firebase.firestore.Firestore;

  beforeEach(async () => {
    await prepareEachTest();

    await adminWriteDoc(
            `authed/myPortal/users/${teacherId}`,
            { uid: teacherId, name: teacherName, type: "teacher", network: network1, networks: [network1] });
    // teacher 2 is in same network as teacher 1, but a different class
    await adminWriteDoc(
            `authed/myPortal/users/${teacher2Id}`,
            { uid: teacher2Id, name: teacher2Name, type: "teacher", network: network1, networks: [network1] });
    // teacher 3 is in a different network than teachers 1 and 2
    await adminWriteDoc(
            `authed/myPortal/users/${teacher3Id}`,
            { uid: teacher3Id, name: teacher3Name, type: "teacher", network: network2, networks: [network2] });
  });

  afterAll(async () => {
    await tearDownTests();
  });

  function specClass(additions?: Record<string, string | string[]>, subtractions?: string[]) {
    const offering: Record<string, string | string[]> = {
            id: thisClass, name: "My Class", uri: "https://concord.org/class", context_id: thisClass,
            teachers: [teacherId], network: network1, ...additions };
    subtractions?.forEach(prop => delete offering[prop]);
    return offering;
  }

  describe("class documents", () => {
    const classKey = `${network1}_${thisClass}`;
    const kClassDocPath = `authed/myPortal/classes/${classKey}`;

    it("unauthenticated users can't read class documents", async () => {
      db = initFirestore();
      await expectReadToFail(db, kClassDocPath);
    });

    it("unauthenticated users can't write class documents", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kClassDocPath, specClass());
    });

    it("authenticated generic users can't read class documents", async () => {
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kClassDocPath);
    });

    it("authenticated generic users can't write class documents", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kClassDocPath, specClass());
    });

    it("authenticated teachers can read their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectReadToSucceed(db, kClassDocPath);
    });

    it("authenticated teachers can read other class documents in the network", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectReadToSucceed(db, kClassDocPath);
    });

    it("authenticated teachers can't read other class documents from a different network", async () => {
      db = initFirestore(teacher3Auth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectReadToFail(db, kClassDocPath);
    });

    it("authenticated teachers can write their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kClassDocPath, specClass());
    });

    it("authenticated teachers can't write their own class documents without id", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["id"]));
    });

    it("authenticated teachers can't write their own class documents without name", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["name"]));
    });

    it("authenticated teachers can't write their own class documents without uri", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["uri"]));
    });

    it("authenticated teachers can't write their own class documents without context_id", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["context_id"]));
    });

    it("authenticated teachers can't write their own class documents without teachers", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["teachers"]));
    });

    it("authenticated teachers can't write their own class documents if they're not one of the teachers", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({ teachers: [teacher2Id] }));
    });

    it("authenticated teachers can't write their own class documents without network", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["network"]));
    });

    it("authenticated teachers can update the name of their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToSucceed(db, kClassDocPath, specClass({ name: "Improved Class Name" }));
    });

    it("authenticated teachers can update the teachers of their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToSucceed(db, kClassDocPath, specClass({ teachers: [teacherId, teacher2Id] }));
    });

    it("authenticated teachers can't update the teachers of other teachers' class documents", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToFail(db, kClassDocPath, specClass({ teachers: [teacherId, teacher2Id] }));
    });

    it("authenticated teachers can't update the teachers of their own classes if they're no longer a teacher", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToFail(db, kClassDocPath, specClass({ teachers: [teacher2Id] }));
    });

    it("authenticated teachers can't update read-only properties of class documents: id", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToFail(db, kClassDocPath, specClass({ id: "better-id" }));
    });

    it("authenticated teachers can't update read-only properties of class documents: uri", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToFail(db, kClassDocPath, specClass({ uri: "better-uri" }));
    });

    it("authenticated teachers can't update read-only properties of class documents: context_id", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToFail(db, kClassDocPath, specClass({ context_id: "better-context-id" }));
    });

    it("authenticated teachers can't update read-only properties of class documents: network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToFail(db, kClassDocPath, specClass({ network: "better-network" }));
    });

    it("authenticated teachers can't delete their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectDeleteToFail(db, kClassDocPath);
    });

    it("authenticated students can't read class documents", async () => {
      db = initFirestore(studentAuth);
      await expectReadToFail(db, kClassDocPath);
    });

    it("authenticated students can't write class documents", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kClassDocPath, specClass());
    });
  });

});
