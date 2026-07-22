import firebase from "firebase";
import {
  adminWriteDoc, initFirestore, prepareEachTest, studentAuth, teacherAuth, tearDownTests, thisClass
} from "./setup-rules-tests";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

const kOffering = "offering-1";
const kGroup = "3";
const kLabel = "default";
const kPointerPath =
  `authed/test-portal/classes/${thisClass}/offerings/${kOffering}/groups/${kGroup}/canonical/${kLabel}`;
const kOtherClassPointerPath =
  `authed/test-portal/classes/other-class/offerings/${kOffering}/groups/${kGroup}/canonical/${kLabel}`;
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
  offeringId: kOffering, groupId: kGroup, concurrent: true, ...extra
});

describe("deleting group documents", () => {
  it("a class member may delete a non-canonical group document", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kDocPath).set(groupDoc());               // no canonical flag
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kDocPath).delete());
  });

  it("a class member may NOT delete a canonical group document", async () => {
    await adminWriteDoc(kDocPath, { ...groupDoc(), canonical: "default", createdAt: Date.now() });
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).delete());
  });

  it("a user outside the class may not delete the group document", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kDocPath).set(groupDoc());
    db = initFirestore({ uid: "99", platform_user_id: 99, user_type: "student", class_hash: "other-class" });
    await assertFails(db.doc(kDocPath).delete());
  });

  it("a class member may NOT delete a non-concurrent document even if type is group", async () => {
    const admin = initFirestore(teacherAuth);
    // type "group" but no concurrent flag -> not deletable by a class member under the new rule
    await admin.doc(kDocPath).set({
      uid: `group_${kOffering}_${kGroup}`, type: "group", key: "group-doc-1",
      createdAt: firebase.firestore.Timestamp.now(), context_id: thisClass, network: null,
      offeringId: kOffering, groupId: kGroup
    });
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).delete());
  });
});

describe("canonical flag integrity", () => {
  it("create is denied if the doc arrives pre-flagged canonical", async () => {
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).set(groupDoc({ canonical: "default" })));
  });

  it("create is denied if the doc arrives with a non-string canonical value", async () => {
    // Only null/absent/"" may arrive on a create; a boolean (or any non-blank value) is rejected.
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).set(groupDoc({ canonical: true })));
  });

  it("a normal metadata update (title) that does not touch canonical is allowed", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kDocPath).set(groupDoc());
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kDocPath).update({ title: "hello" }));
  });

  it("clearing an existing canonical label is denied", async () => {
    await adminWriteDoc(kDocPath, { ...groupDoc(), canonical: "default", createdAt: Date.now() });
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).update({ canonical: "" }));
  });

  it("changing an existing canonical label is denied", async () => {
    await adminWriteDoc(kDocPath, { ...groupDoc(), canonical: "default", createdAt: Date.now() });
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).update({ canonical: "other" }));
  });

  it("setting a canonical label WITHOUT a matching pointer (standalone) is denied", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kDocPath).set(groupDoc());   // no pointer exists
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).update({ canonical: "default" }));
  });

  it("a document whose scope has no canonical shape (no group association) cannot claim canonical", async () => {
    // Scope is read from the association fields. Without a group association the document has no
    // canonical-pointer path (canonicalPointerPath() is null), so the claim is denied before any
    // pointer is consulted — the update touches only `canonical`, so nothing else can reject it.
    const { groupId, ...noGroupScope } = groupDoc();
    await adminWriteDoc(kDocPath, { ...noGroupScope, createdAt: Date.now() });
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kDocPath).update({ canonical: "default" }));
  });
});
