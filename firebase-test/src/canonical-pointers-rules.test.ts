import firebase from "firebase";
import {
  initFirestore, prepareEachTest, studentAuth, teacherAuth, tearDownTests, thisClass
} from "./setup-rules-tests";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

const kOffering = "offering-1";
const kGroup = "3";
const kType = "group";
const kPointerPath =
  `authed/test-portal/classes/${thisClass}/offerings/${kOffering}/groups/${kGroup}/canonical/${kType}`;
const kOtherClassPointerPath =
  `authed/test-portal/classes/other-class/offerings/${kOffering}/groups/${kGroup}/canonical/${kType}`;
const validPointer = () => ({ documentKey: "doc-abc", createdAt: firebase.firestore.Timestamp.now(), createdBy: `group_${kOffering}_${kGroup}` });

let db: firebase.firestore.Firestore;
beforeEach(async () => { await prepareEachTest(); });
afterAll(async () => { await tearDownTests(); });

describe("canonical pointers", () => {
  it("a student in the class may create a pointer with the required keys", async () => {
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kPointerPath).set(validPointer()));
  });

  it("a student in the class may read the pointer", async () => {
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kPointerPath).get());
  });

  it("a create missing a required key is denied", async () => {
    db = initFirestore(studentAuth);
    const { createdBy, ...missing } = validPointer();
    await assertFails(db.doc(kPointerPath).set(missing));
  });

  it("a user in a different class is denied create and read", async () => {
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kOtherClassPointerPath).set(validPointer()));
    await assertFails(db.doc(kOtherClassPointerPath).get());
  });

  it("pointers are immutable — update and delete are denied", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kPointerPath).set(validPointer()); // teacher of class may seed it
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kPointerPath).update({ documentKey: "hijacked" }));
    await assertFails(db.doc(kPointerPath).delete());
  });
});

const kDocPath = `authed/test-portal/documents/group-doc-1`;
const groupDoc = (extra: any = {}) => ({
  uid: `group_${kOffering}_${kGroup}`, type: "group", key: "group-doc-1",
  createdAt: firebase.firestore.Timestamp.now(), context_id: thisClass, network: null,
  offeringId: kOffering, groupId: kGroup, ...extra
});

describe("deleting group documents", () => {
  it("a class member may delete a non-canonical group document", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kDocPath).set(groupDoc());               // no canonical flag
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kDocPath).delete());
  });

  it("a class member may NOT delete a canonical group document", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kDocPath).set(groupDoc({ canonical: true }));
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).delete());
  });

  it("a user outside the class may not delete the group document", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kDocPath).set(groupDoc());
    db = initFirestore({ uid: "99", platform_user_id: 99, user_type: "student", class_hash: "other-class" });
    await assertFails(db.doc(kDocPath).delete());
  });
});
