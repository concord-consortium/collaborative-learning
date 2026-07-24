import firebase from "firebase";
import {
  adminWriteDoc, initFirestore, prepareEachTest, studentAuth, teacherAuth, tearDownTests, thisClass
} from "./setup-rules-tests";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

const kOffering = "offering-1";
const kGroup = "3";
const kLabel = "default";
const kPointerPath =
  `authed/test-portal/canonical/v1/classes/${thisClass}/offerings/${kOffering}/groups/${kGroup}/slots/${kLabel}`;
const kOtherClassPointerPath =
  `authed/test-portal/canonical/v1/classes/other-class/offerings/${kOffering}/groups/${kGroup}/slots/${kLabel}`;
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

const kUnit = "msu";
const kClassWideLabel = "driving-question-board";
const kClassWidePointerPath =
  `authed/test-portal/canonical/v1/classes/${thisClass}/units/${kUnit}/slots/${kClassWideLabel}`;
const kOtherClassWidePointerPath =
  `authed/test-portal/canonical/v1/classes/other-class/units/${kUnit}/slots/${kClassWideLabel}`;

describe("class+unit canonical pointers", () => {
  it("a student in the class may create a class+unit pointer with the required keys", async () => {
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kClassWidePointerPath).set(validPointer()));
  });

  it("a student in the class may read the class+unit pointer", async () => {
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kClassWidePointerPath).get());
  });

  it("a create missing a required key is denied", async () => {
    db = initFirestore(studentAuth);
    const { createdBy, ...missing } = validPointer();
    await assertFails(db.doc(kClassWidePointerPath).set(missing));
  });

  it("a user in a different class is denied create and read", async () => {
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kOtherClassWidePointerPath).set(validPointer()));
    await assertFails(db.doc(kOtherClassWidePointerPath).get());
  });

  it("class+unit pointers are immutable — update and delete are denied", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kClassWidePointerPath).set(validPointer());
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kClassWidePointerPath).update({ documentKey: "hijacked" }));
    await assertFails(db.doc(kClassWidePointerPath).delete());
  });
});

const kClassWideDocPath = `authed/test-portal/documents/dqb-doc-1`;
const classWideDoc = (extra: any = {}) => ({
  uid: `class_${kUnit}`, type: "group", key: "dqb-doc-1",
  createdAt: firebase.firestore.Timestamp.now(), context_id: thisClass, network: null,
  unit: kUnit, kind: kClassWideLabel, concurrent: true, ...extra
});

describe("class-wide document canonical claim", () => {
  it("a class-wide doc may set canonical when its class+unit pointer confirms it", async () => {
    const admin = initFirestore(teacherAuth);
    // Seed the doc (non-canonical) and the pointer that points at it.
    await admin.doc(kClassWideDocPath).set(classWideDoc());
    await admin.doc(kClassWidePointerPath).set({
      documentKey: "dqb-doc-1", createdAt: firebase.firestore.Timestamp.now(), createdBy: `class_${kUnit}`
    });
    db = initFirestore(studentAuth);
    await assertSucceeds(db.doc(kClassWideDocPath).update({ canonical: kClassWideLabel }));
  });

  it("a class-wide doc may NOT set a canonical label its pointer does not confirm", async () => {
    const admin = initFirestore(teacherAuth);
    await admin.doc(kClassWideDocPath).set(classWideDoc());   // no pointer seeded
    db = initFirestore(studentAuth);
    await assertFails(db.doc(kClassWideDocPath).update({ canonical: kClassWideLabel }));
  });
});

describe("class-wide get-or-create convergence (#1, #6)", () => {
  it("two concurrent claims on the same class+unit pointer converge to one documentKey", async () => {
    const a = initFirestore(studentAuth);
    const b = initFirestore({ uid: "77", platform_user_id: 77, user_type: "student", class_hash: thisClass });
    // First writer wins; the pointer is immutable, so the second create is denied (it must then adopt the winner).
    await assertSucceeds(a.doc(kClassWidePointerPath).set(
      { documentKey: "doc-A", createdAt: firebase.firestore.Timestamp.now(), createdBy: `class_${kUnit}` }));
    await assertFails(b.doc(kClassWidePointerPath).set(
      { documentKey: "doc-B", createdAt: firebase.firestore.Timestamp.now(), createdBy: `class_${kUnit}` }));
    const snap = await a.doc(kClassWidePointerPath).get();
    expect(snap.data()!.documentKey).toBe("doc-A");
  });

  it("the class-wide metadata document is readable before any history entry exists (#6 ordering)", async () => {
    // getOrCreateCanonicalDocument writes the Firestore metadata document (rules require the create to
    // arrive non-canonical; the label is stamped afterward by the pointer-claim update — see
    // isValidDocumentCreateRequest) before the document is opened and its history manager subscribes,
    // so a first-session drift false-positive cannot occur. Assert the metadata doc is present/readable
    // immediately after creation, with no history subcollection involved.
    const admin = initFirestore(teacherAuth);
    await admin.doc(kClassWideDocPath).set(classWideDoc());
    const student = initFirestore(studentAuth);
    await assertSucceeds(student.doc(kClassWideDocPath).get());
  });
});
