import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectQueryToFail, expectQueryToSucceed, expectReadToFail, expectReadToSucceed,
  expectWriteToFail, expectWriteToSucceed, genericAuth, initFirestore, network1, network2, offeringId, prepareEachTest,
  studentAuth, teacher2Auth, teacher2Id, teacher2Name, teacher3Auth, teacher3Id, teacher3Name, teacherAuth, teacherId,
  teacherName, tearDownTests, thisClass
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

  function specOffering(additions?: Record<string, string | string[]>, subtractions?: string[]) {
    const offering: Record<string, string | string[]> = {
            id: offeringId, name: "Activity Offering", uri: "https://concord.org/offering", context_id: thisClass,
            teachers: [teacherId], unit: "msa", problem: "1.4", problemPath: "msa/1/4", network: network1, ...additions };
    subtractions?.forEach(prop => delete offering[prop]);
    return offering;
  }

  describe("offering documents", () => {
    const offeringKey = `${network1}_${offeringId}`;
    const kOfferingsCollectionPath = "authed/myPortal/offerings";
    const kOfferingDocPath = `${kOfferingsCollectionPath}/${offeringKey}`;

    it("unauthenticated users can't read offering documents", async () => {
      db = initFirestore();
      await expectReadToFail(db, kOfferingDocPath);
    });

    it("unauthenticated users can't write offering documents", async () => {
      db = initFirestore();
      await expectWriteToFail(db, kOfferingDocPath, specOffering());
    });

    it("authenticated generic users can't read offering documents", async () => {
      db = initFirestore(genericAuth);
      await expectReadToFail(db, kOfferingDocPath);
    });

    it("authenticated generic users can't write offering documents", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering());
    });

    it("authenticated teachers can read their own offering documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectReadToSucceed(db, kOfferingDocPath);
    });

    it("authenticated teachers can read other offering documents in the network", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectReadToSucceed(db, kOfferingDocPath);
    });

    it("authenticated teachers can't read other offering documents from a different network", async () => {
      db = initFirestore(teacher3Auth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectReadToFail(db, kOfferingDocPath);
    });

    it("authenticated teachers can write their own offering documents", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToSucceed(db, kOfferingDocPath, specOffering());
    });

    it("authenticated teachers can't write their own offering documents without id", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["id"]));
    });

    it("authenticated teachers can't write their own offering documents without name", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["name"]));
    });

    it("authenticated teachers can't write their own offering documents without uri", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["uri"]));
    });

    it("authenticated teachers can't write their own offering documents without context_id", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["context_id"]));
    });

    it("authenticated teachers can't write their own offering documents without teachers", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["teachers"]));
    });

    it("authenticated teachers can't write their own offering documents if they're not one of the teachers", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ teachers: [teacher2Id] }));
    });

    it("authenticated teachers can't write their own offering documents without unit", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["unit"]));
    });

    it("authenticated teachers can't write their own offering documents without problem", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["problem"]));
    });

    it("authenticated teachers can't write their own offering documents without problemPath", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["problemPath"]));
    });

    it("authenticated teachers can't write their own offering documents without network", async () => {
      db = initFirestore(teacherAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering({}, ["network"]));
    });

    it("authenticated teachers can update the name of their own offering documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToSucceed(db, kOfferingDocPath, specOffering({ name: "Improved Activity Offering" }));
    });

    it("authenticated teachers can update the teachers of their own offering documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToSucceed(db, kOfferingDocPath, specOffering({ teachers: [teacherId, teacher2Id] }));
    });

    it("authenticated teachers can't update the teachers of other teachers' offering documents", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ teachers: [teacherId, teacher2Id] }));
    });

    it("authenticated teachers can't update the teachers of their own offerings if they're no longer a teacher", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ teachers: [teacher2Id] }));
    });

    it("authenticated teachers can't update read-only properties of offering documents: id", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ id: "better-id" }));
    });

    it("authenticated teachers can't update read-only properties of offering documents: uri", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ uri: "better-uri" }));
    });

    it("authenticated teachers can't update read-only properties of offering documents: context_id", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ context_id: "better-context-id" }));
    });

    it("authenticated teachers can't update read-only properties of offering documents: unit", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ unit: "better-unit" }));
    });

    it("authenticated teachers can't update read-only properties of offering documents: problem", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ problem: "better-problem" }));
    });

    it("authenticated teachers can't update read-only properties of offering documents: problemPath", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ problemPath: "better-problem-path" }));
    });

    it("authenticated teachers can't update read-only properties of offering documents: network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectWriteToFail(db, kOfferingDocPath, specOffering({ network: "better-network" }));
    });

    it("authenticated teachers can't delete their own offering documents", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      await expectDeleteToFail(db, kOfferingDocPath);
    });

    it("authenticated teachers can query for offering documents in their network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      const query = db.collection(kOfferingsCollectionPath)
                      .where("network", "==", network1)
                      .where("problemPath", "==", "msa/1/4");
      await expectQueryToSucceed(db, query);
    });

    it("authenticated teachers can query for other offering documents in their network", async () => {
      db = initFirestore(teacher2Auth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      const query = db.collection(kOfferingsCollectionPath)
                      .where("network", "==", network1)
                      .where("problemPath", "==", "msa/1/4");
      await expectQueryToSucceed(db, query);
    });

    it("authenticated teachers can't query for offering documents in another network", async () => {
      db = initFirestore(teacher3Auth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      const query = db.collection(kOfferingsCollectionPath)
                      .where("network", "==", network1)
                      .where("problemPath", "==", "msa/1/4");
      await expectQueryToFail(db, query);
    });

    it("authenticated teachers can't query for offering documents without specifying a network", async () => {
      db = initFirestore(teacherAuth);
      await adminWriteDoc(kOfferingDocPath, specOffering());
      const query = db.collection(kOfferingsCollectionPath)
                      .where("problemPath", "==", "msa/1/4");
      await expectQueryToFail(db, query);
    });

    it("authenticated students can't read offering documents", async () => {
      db = initFirestore(studentAuth);
      await expectReadToFail(db, kOfferingDocPath);
    });

    it("authenticated students can't write offering documents", async () => {
      db = initFirestore(studentAuth);
      await expectWriteToFail(db, kOfferingDocPath, specOffering());
    });
  });

});
