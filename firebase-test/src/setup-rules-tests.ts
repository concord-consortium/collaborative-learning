import {
  apps, assertFails, assertSucceeds, clearFirestoreData, initializeAdminApp, initializeTestApp, useEmulators
} from "@firebase/rules-unit-testing";
import firebase from "firebase";

export const kCLUEFirebaseProjectId = "collaborative-learning-ec215";
export const genericAuth = { uid: "user-generic" };
export const thisClass = "this-class";
export const otherClass = "other-class";
export const studentId = "user-student";
export const studentAuth = { uid: studentId, platform_user_id: studentId, user_type: "student", class_hash: thisClass };
export const student2Id = "user-student2";
export const student2Auth = { uid: student2Id, platform_user_id: student2Id, user_type: "student", class_hash: otherClass };
export const teacherId = "user-teacher";
export const teacherName = "Jane Teacher";
export const teacherAuth = { uid: teacherId, platform_user_id: teacherId, user_type: "teacher", class_hash: thisClass };
export const teacher2Id = "user-teacher2";
export const teacher2Name = "John Teacher";
export const teacher2Auth = { uid: teacher2Id, platform_user_id: teacher2Id, user_type: "teacher", class_hash: otherClass };

// @firebase/rules-unit-testing doesn't support firebase.firestore.FieldValue.serverTimestamp()
export const mockTimestamp = () => Date.now();

useEmulators({ firestore: { host: "localhost", port: 8088 } });
const dbAdmin = initializeAdminApp({ projectId: kCLUEFirebaseProjectId }).firestore();

export const prepareEachTest = async () => {
  await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
}

export const tearDownTests = async () => {
  await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
  // https://firebase.google.com/docs/firestore/security/test-rules-emulator#run_local_tests
  await Promise.all(apps().map(app => app.delete()))
};

export const initFirestore = (auth?: any) => {
  return initializeTestApp({ projectId: kCLUEFirebaseProjectId, auth: auth || null }).firestore();
}

export const adminWriteDoc = async (docPath: string, value: any) => {
  await dbAdmin.doc(docPath).set(value);
};

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
