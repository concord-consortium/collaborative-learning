import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectReadToFail, expectReadToSucceed, expectWriteToFail, expectWriteToSucceed,
  genericAuth, initFirestore, network1, network2, prepareEachTest, researcherAuth, studentAuth,
  teacher2Auth, teacher2Id, teacher2Name,
  teacher3Auth, teacher3Id, teacher3Name,
  teacher4Auth, teacher4Id, teacher4Name,
  teacherAuth, teacherId, teacherName,
  tearDownTests, thisClass
} from "./setup-rules-tests";

// duplicated from firestore-schema.ts since we can't reach outside our folder
interface ClassDocument {
  id: string;                 // portal class id
  name: string;               // portal class name
  uri: string;                // portal class info url
  context_id: string;         // portal class hash
  teacher: string;            // name of primary(?) teacher
  teachers: string[];         // uids of teachers of class
  network: string;            // network of teacher creating class
}

describe("Firestore security rules", () => {

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
    // teacher 4 is not in a network
    // TODO: should have a teacher with no networks array for testing purposes too.
    await adminWriteDoc(
      `authed/myPortal/users/${teacher4Id}`,
      { uid: teacher4Id, name: teacher4Name, type: "teacher", networks: [] });
});

  afterAll(async () => {
    await tearDownTests();
  });

  function specClass(additions?: Partial<ClassDocument>, subtractions?: string[]) {
    const _class: ClassDocument = {
            id: thisClass, name: "My Class", uri: "https://concord.org/class", context_id: thisClass,
            teacher: "Teacher 1", teachers: [teacherId], network: network1, ...additions };
    subtractions?.forEach(prop => delete (_class as any)[prop]);
    return _class;
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

    it("authenticated teachers in a network can read their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectReadToSucceed(db, kClassDocPath);
    });

    it("authenticated teachers without a network can read their own class documents", async () => {
      db = initFirestore(teacher4Auth);
      await adminWriteDoc(kClassDocPath, specClass({teachers: [teacher4Id]}, ["network"]));
      await expectReadToSucceed(db, kClassDocPath);
    });

    it("authenticated teachers can read class documents that don't exist", async () => {
      db = initFirestore(teacherAuth);
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

    it("authenticated teachers can't write their own class documents without a primary teacher", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["teacher"]));
    });

    it("authenticated teachers can't write their own class documents without teachers", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({}, ["teachers"]));
    });

    it("authenticated teachers can't write their own class documents if they're not one of the teachers", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass({ teachers: [teacher2Id] }));
    });

    it("authenticated teachers can write their own class documents without network", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kClassDocPath, specClass({}, ["network"]));
    });

    it("authenticated teachers can update the name of their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToSucceed(db, kClassDocPath, specClass({ name: "Improved Class Name" }));
    });

    it("authenticated teachers can update the primary teacher's name of their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToSucceed(db, kClassDocPath, specClass({ teacher: "Ms. Teacher 1" }));
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

    it("authenticated teachers can't delete their own class documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectDeleteToFail(db, kClassDocPath);
    });

    it("authenticated researchers can read their own class documents", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectReadToSucceed(db, kClassDocPath);
    });

    it("authenticated researchers can't read other class documents", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kClassDocPath, specClass({ context_id: "other-class" }));
      await expectReadToFail(db, kClassDocPath);
    });

    it("authenticated researchers can't write class documents", async () => {
      db = initFirestore(researcherAuth);
      await expectWriteToFail(db, kClassDocPath, specClass());
    });

    it("authenticated researchers can't update class documents", async () => {
      db = initFirestore(researcherAuth);
      await adminWriteDoc(kClassDocPath, specClass());
      await expectWriteToFail(db, kClassDocPath, specClass({ name: "Improved Class Name" }));
    });

    it("authenticated researchers can't delete class documents", async () => {
      db = initFirestore(researcherAuth);
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
