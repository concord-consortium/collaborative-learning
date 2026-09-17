import {
  apps, assertFails, assertSucceeds, clearFirestoreData, initializeAdminApp, initializeTestApp, useEmulators
} from "@firebase/rules-unit-testing";
import firebase from "firebase";

export const kCLUEFirebaseProjectId = "collaborative-learning-ec215";
export const genericAuth = { uid: "user-generic" };
export const thisClass = "this-class";
export const otherClass = "other-class";
export const lastClass = "last-class";
// The portal mints `offering_id` only for a learner — a student launched into one offering. A teacher's
// or researcher's token deliberately omits it so they are not restricted to a single offering, which is
// why only the student auths below carry it. It is a number in the token, as it is in the portal.
export const offeringIdNumeric = 2000;
export const offeringId = `${offeringIdNumeric}`;
export const otherOfferingIdNumeric = 9999;
export const otherOfferingId = `${otherOfferingIdNumeric}`;

export const studentIdNumeric = 1;
export const studentId = `${studentIdNumeric}`;
export const studentName = "Sam Student";
export const studentAuth = { uid: studentId, platform_user_id: studentIdNumeric, user_type: "student", class_hash: thisClass, offering_id: offeringIdNumeric };
export const student2IdNumeric = 2;
export const student2Id = `${student2IdNumeric}`;
export const student2Auth = { uid: student2Id, platform_user_id: student2IdNumeric, user_type: "student", class_hash: otherClass, offering_id: offeringIdNumeric };

export const teacherIdNumeric = 11;
export const teacherId = `${teacherIdNumeric}`;
export const teacherName = "Jane Teacher";
export const teacherAuth = { uid: teacherId, platform_user_id: teacherIdNumeric, user_type: "teacher", class_hash: thisClass };

export const teacher2IdNumeric = 12;
export const teacher2Id = `${teacher2IdNumeric}`;
export const teacher2Name = "John Teacher";
export const teacher2Auth = { uid: teacher2Id, platform_user_id: teacher2IdNumeric, user_type: "teacher", class_hash: otherClass };

export const teacher3IdNumeric = 13;
export const teacher3Id = `${teacher3IdNumeric}`;
export const teacher3Name = "Jade Teacher";
export const teacher3Auth = { uid: teacher3Id, platform_user_id: teacher3IdNumeric, user_type: "teacher", class_hash: lastClass };

// Co-teacher of teacher's class
export const teacher4IdNumeric = 14;
export const teacher4Id = `${teacher4IdNumeric}`;
export const teacher4Name = "Joe Teacher";
export const teacher4Auth = { uid: teacher4Id, platform_user_id: teacher4IdNumeric, user_type: "teacher", class_hash: thisClass };

export const researcherIdNumeric = 21;
export const researcherId = `${researcherIdNumeric}`;
export const researcherName = "Rita Researcher";
export const researcherAuth = { uid: researcherId, platform_user_id: researcherIdNumeric, user_type: "researcher", class_hash: thisClass };

// The Researcher Dashboard's MicroVM holds a researcher token carrying
// `researcher_dashboard_runner`. It is the same researcher, with the same class, so the
// only difference the rules may key on is the claim: everything this token reads, the
// plain researcher token above reads too, and everything it writes must be denied.
export const researcherRunnerAuth = { ...researcherAuth, researcher_dashboard_runner: true };
// A second runner token, for the class the researcher is not in, so a denial cannot be
// mistaken for the class check doing the work.
export const researcherRunnerOtherClassAuth = { ...researcherRunnerAuth, class_hash: otherClass };

export const noNetwork = null;
export const network1 = "network-1";
export const network2 = "network-2";
export const cUnit = "abc";
export const cFacet = "facet";
export const cProblem = "1.2";
export const cSection = "intro";
export const cPath = `${cUnit}/1/2/intro`;
export const cPathWithFacet = `${cUnit}:${cFacet}/1/2/intro`;

// @firebase/rules-unit-testing doesn't support firebase.firestore.FieldValue.serverTimestamp()
export const mockTimestamp = () => Date.now();

useEmulators({
  firestore: { host: "localhost", port: 8088 },
  database: { host: "localhost", port: 9000 }
});
const dbAdmin = initializeAdminApp({ projectId: kCLUEFirebaseProjectId }).firestore();

// CLUE keeps document *content* in the Realtime Database while Firestore holds the
// metadata and history, so the two rule files have to be tested separately. The RTDB
// portal key is part of the path rather than a claim, and the rules name each portal
// explicitly, so a test has to use one of the four they list.
// The emulator applies database.rules.json to the namespace named by the project, and
// creates any other namespace on demand with OPEN rules. Naming a different database here
// therefore runs every test against a ruleless instance, where each assertFails fails and
// each assertSucceeds passes for the wrong reason.
export const kCLUEDatabaseName = kCLUEFirebaseProjectId;
export const kRtdbPortal = "learn_portal_staging_concord_org";
const rtdbAdmin = initializeAdminApp({ databaseName: kCLUEDatabaseName }).database();

export const initDatabase = (auth?: any) => {
  return initializeTestApp({ databaseName: kCLUEDatabaseName, auth: auth || null }).database();
};

export const adminWriteRtdb = async (path: string, value: any) => {
  await rtdbAdmin.ref(path).set(value);
};

export const clearRtdb = async () => {
  await rtdbAdmin.ref("/").set(null);
};

export const expectRtdbReadToSucceed = async (db: firebase.database.Database, path: string) => {
  expect(await assertSucceeds(db.ref(path).once("value"))).toBeDefined();
};

export const expectRtdbReadToFail = async (db: firebase.database.Database, path: string) => {
  await assertFails(db.ref(path).once("value"));
};

export const expectRtdbWriteToSucceed = async (db: firebase.database.Database, path: string, value: any) => {
  await assertSucceeds(db.ref(path).set(value));
};

export const expectRtdbWriteToFail = async (db: firebase.database.Database, path: string, value: any) => {
  await assertFails(db.ref(path).set(value));
};

export const prepareEachTest = async () => {
  await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
}

// Pass false to preserve the contents of the database after tests are run.
// This is particularly useful in combination with `.only` to see what was
// written to the database for a particular test.
// The database contents can be viewed in the emulator UI at http://localhost:4000/firestore
export const tearDownTests = async (clear = true) => {
  clear && await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
  // https://firebase.google.com/docs/firestore/security/test-rules-emulator#run_local_tests
  await Promise.all(apps().map(app => app.delete()))
};

export const initFirestore = (auth?: any) => {
  return initializeTestApp({ projectId: kCLUEFirebaseProjectId, auth: auth || null }).firestore();
}

export const adminWriteDoc = async (docPath: string, value: any) => {
  await dbAdmin.doc(docPath).set(value);
};

export const expectQueryToFail = async (db: firebase.firestore.Firestore, query: firebase.firestore.Query) => {
  // awaited writes via admin app don't always complete before the read occurs
  await db.waitForPendingWrites();
  expect(await assertFails(query.get())).toBeDefined();
}

export const expectQueryToSucceed = async (db: firebase.firestore.Firestore, query: firebase.firestore.Query) => {
  // awaited writes via admin app don't always complete before the read occurs
  await db.waitForPendingWrites();
  expect(await assertSucceeds(query.get())).toBeDefined();
}

export const expectReadToFail = async (db: firebase.firestore.Firestore, docPath: string) => {
  // awaited writes via admin app don't always complete before the read occurs
  await db.waitForPendingWrites();
  expect(await assertFails(db.doc(docPath).get())).toBeDefined();
};
export const expectReadToSucceed = async (db: firebase.firestore.Firestore, docPath: string) => {
  // awaited writes via admin app don't always complete before the read occurs
  await db.waitForPendingWrites();
  expect(await assertSucceeds(db.doc(docPath).get())).toBeDefined();
};
export const expectWriteToFail = async (db: firebase.firestore.Firestore, docPath: string, value: any) => {
  expect(await assertFails(db.doc(docPath).set(value))).toBeDefined();
};
export const expectWriteToSucceed = async (db: firebase.firestore.Firestore, docPath: string, value: any) => {
  // when the write succeeds the return value is undefined
  expect(await assertSucceeds(db.doc(docPath).set(value))).toBeUndefined();
};
export const expectUpdateToFail = async (db: firebase.firestore.Firestore, docPath: string, value: any) => {
  expect(await assertFails(db.doc(docPath).set(value, { merge: true }))).toBeDefined();
};
export const expectUpdateToSucceed = async (db: firebase.firestore.Firestore, docPath: string, value: any) => {
  // when the write succeeds the return value is undefined
  expect(await assertSucceeds(db.doc(docPath).set(value, { merge: true }))).toBeUndefined();
};
export const expectDeleteToFail = async (db: firebase.firestore.Firestore, docPath: string) => {
  expect(await assertFails(db.doc(docPath).delete())).toBeDefined();
};
export const expectDeleteToSucceed = async (db: firebase.firestore.Firestore, docPath: string) => {
  // when the delete succeeds the return value is undefined
  expect(await assertSucceeds(db.doc(docPath).delete())).toBeUndefined();
};
