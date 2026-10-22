import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectQueryToFail, expectQueryToSucceed, expectReadToFail, expectReadToSucceed,
  expectUpdateToFail, expectWriteToFail, initFirestore, learnerAuth, offeringId, otherClass,
  otherOfferingId, prepareEachTest, researcherAuth, studentAuth, studentId, teacherAuth, tearDownTests, thisClass
} from "./setup-rules-tests";

const activityUsers = (classHash: string) => `researcher_dashboard/learn_concord_org/activity/${classHash}/users`;
const otherResearcherAuth = { ...researcherAuth, class_hash: otherClass };
const seededDoc = `${activityUsers(thisClass)}/${studentId}`;

describe("researcher dashboard activity rules", () => {
  beforeEach(async () => {
    await prepareEachTest();
    await adminWriteDoc(seededDoc, { writeCount: 1 });
  });
  afterAll(() => tearDownTests());

  it("lets the class's researcher get a document and list the collection", async () => {
    const db = initFirestore(researcherAuth);
    await expectReadToSucceed(db, seededDoc);
    await expectQueryToSucceed(db, db.collection(activityUsers(thisClass)));
    const snapshot = await db.collection(activityUsers(thisClass)).get();
    expect(snapshot.docs.map(doc => doc.id)).toEqual([studentId]);
  });

  it("gives a listener on an empty collection an empty snapshot", async () => {
    const db = initFirestore(otherResearcherAuth);
    const snapshot = await new Promise<firebase.firestore.QuerySnapshot>((resolve, reject) => {
      const unsubscribe = db.collection(activityUsers(otherClass)).onSnapshot(
        snap => { unsubscribe(); resolve(snap); },
        reject
      );
    });
    expect(snapshot.empty).toBe(true);
  });

  it("refuses other classes' researchers, the class's teacher and student, and no token", async () => {
    for (const auth of [otherResearcherAuth, teacherAuth, studentAuth, undefined]) {
      const db = initFirestore(auth);
      await expectReadToFail(db, seededDoc);
      await expectQueryToFail(db, db.collection(activityUsers(thisClass)));
    }
  });

  it("refuses a token with user_type researcher but no platform_user_id", async () => {
    const db = initFirestore({ uid: "researcher-no-id", user_type: "researcher", class_hash: thisClass });
    await expectReadToFail(db, seededDoc);
    await expectQueryToFail(db, db.collection(activityUsers(thisClass)));
  });

  it("refuses writes from the class's researcher, teacher and student-claim tokens", async () => {
    const newDoc = `${activityUsers(thisClass)}/999`;
    const fields = { writeCount: 2 };
    for (const auth of [researcherAuth, teacherAuth, studentAuth]) {
      const db = initFirestore(auth);
      await expectWriteToFail(db, newDoc, fields);
      expect(await assertFails(db.collection(activityUsers(thisClass)).add(fields))).toBeDefined();
      await expectWriteToFail(db, seededDoc, fields);
      await expectUpdateToFail(db, seededDoc, fields);
      expect(await assertFails(db.doc(seededDoc).update(fields))).toBeDefined();
      await expectDeleteToFail(db, seededDoc);
    }
  });

  it("matches no rule for the class document itself", async () => {
    const db = initFirestore(researcherAuth);
    await expectReadToFail(db, `researcher_dashboard/learn_concord_org/activity/${thisClass}`);
  });
});

const FV = firebase.firestore.FieldValue;
const ts = () => FV.serverTimestamp();
const own = `${activityUsers(thisClass)}/${studentId}`;
const first = () => ({ lastActivityAt: ts(), writeCount: 1, changed: { [offeringId]: ts() } });
const next = (changed?: Record<string, unknown>) =>
  ({ lastActivityAt: ts(), writeCount: FV.increment(1), ...(changed ? { changed } : {}) });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ok = (p: Promise<any>) => assertSucceeds(p);
const no = (p: Promise<any>) => assertFails(p);
const seedOld = () => adminWriteDoc(own, {
  lastActivityAt: new Date(Date.now() - 60000), writeCount: 3,
  changed: { "1500": new Date(Date.now() - 60000), [offeringId]: new Date(Date.now() - 60000) }
});

describe("researcher dashboard activity learner writes", () => {
  beforeEach(prepareEachTest);
  afterAll(() => tearDownTests());

  it("creates the learner's own document with server times", async () => {
    const db = initFirestore(learnerAuth);
    await ok(db.doc(own).set(first(), { merge: true }));
  });

  it("creates with lastActivityAt and writeCount only", async () => {
    const db = initFirestore(learnerAuth);
    await ok(db.doc(own).set({ lastActivityAt: ts(), writeCount: 1 }, { merge: true }));
  });

  it("uses increment for writeCount on create", async () => {
    const db = initFirestore(learnerAuth);
    await ok(db.doc(own).set({ lastActivityAt: ts(), writeCount: FV.increment(1) }, { merge: true }));
  });

  it("refuses another learner's document, class or portal", async () => {
    const db = initFirestore(learnerAuth);
    await no(db.doc(`${activityUsers(thisClass)}/2`).set(first(), { merge: true }));
    await no(db.doc(`${activityUsers(otherClass)}/1`).set(first(), { merge: true }));
    const stagingDoc = `researcher_dashboard/learn_staging_concord_org/activity/${thisClass}/users/1`;
    await no(db.doc(stagingDoc).set(first(), { merge: true }));
  });

  it("refuses another offering's key", async () => {
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 1, changed: { [otherOfferingId]: ts() } },
      { merge: true }));
    await no(db.doc(own).set(
      { lastActivityAt: ts(), writeCount: 1, changed: { [offeringId]: ts(), [otherOfferingId]: ts() } },
      { merge: true }));
  });

  it("refuses client times and extra fields", async () => {
    const db = initFirestore(learnerAuth);
    const now = firebase.firestore.Timestamp.now();
    await no(db.doc(own).set({ lastActivityAt: now, writeCount: 1 }, { merge: true }));
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 1, changed: { [offeringId]: now } }, { merge: true }));
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 1, extra: true }, { merge: true }));
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 5 }, { merge: true }));
  });

  it("refuses a second write inside 5 seconds and allows one after", async () => {
    const db = initFirestore(learnerAuth);
    await ok(db.doc(own).set(first(), { merge: true }));
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: FV.increment(1), changed: { [offeringId]: ts() } },
      { merge: true }));
    await sleep(5200);
    await ok(db.doc(own).set({ lastActivityAt: ts(), writeCount: FV.increment(1), changed: { [offeringId]: ts() } },
      { merge: true }));
    await sleep(5200);
    await ok(db.doc(own).set({ lastActivityAt: ts(), writeCount: FV.increment(1) }, { merge: true }));
  }, 20000);

  it("refuses an update that changes a stored key of another offering", async () => {
    await adminWriteDoc(own, {
      lastActivityAt: new Date(Date.now() - 60000), writeCount: 3,
      changed: { "1500": new Date(Date.now() - 60000) }
    });
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: FV.increment(1), changed: { "1500": ts() } },
      { merge: true }));
    await ok(db.doc(own).set({ lastActivityAt: ts(), writeCount: FV.increment(1), changed: { [offeringId]: ts() } },
      { merge: true }));
  });

  it("refuses delete", async () => {
    await adminWriteDoc(own, { writeCount: 1 });
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).delete());
  });

  it("refuses teacher, researcher, user and anonymous tokens, even on matching paths", async () => {
    const { offering_id, platform_id } = learnerAuth;
    const asTeacher = { ...teacherAuth, uid: "t", platform_user_id: 1, offering_id, platform_id };
    const asResearcher = { ...researcherAuth, uid: "r", platform_user_id: 1, offering_id, platform_id };
    const asUser = { ...learnerAuth, uid: "u", user_type: "user" };
    const asStudentClaim = { ...learnerAuth, uid: "s", user_type: "student" };
    for (const auth of [asTeacher, asResearcher, asUser, asStudentClaim, { uid: "anon" }, undefined]) {
      const db = initFirestore(auth);
      await no(db.doc(own).set(first(), { merge: true }));
    }
  });

  it("refuses a learner token missing offering_id or platform_id", async () => {
    const { offering_id, ...noOffering } = learnerAuth;
    const { platform_id, ...noPlatform } = learnerAuth;
    for (const auth of [{ ...noOffering, uid: "a" }, { ...noPlatform, uid: "b" }]) {
      const db = initFirestore(auth);
      await no(db.doc(own).set(first(), { merge: true }));
    }
  });

  it("allows the class researcher to read what a learner wrote", async () => {
    await ok(initFirestore(learnerAuth).doc(own).set(first(), { merge: true }));
    const snap = await initFirestore(researcherAuth).doc(own).get();
    expect(snap.get("lastActivityAt")).toBeInstanceOf(firebase.firestore.Timestamp);
    expect(snap.get("changed")[offeringId]).toBeInstanceOf(firebase.firestore.Timestamp);
    expect(snap.get("writeCount")).toBe(1);
  });


  it("refuses a non-merge overwrite that drops another offering's key", async () => {
    await seedOld();
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 4, changed: { [offeringId]: ts() } }));
  });

  it("allows update() with a dotted path to its own key, and refuses one to another key", async () => {
    await seedOld();
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).update({ lastActivityAt: ts(), writeCount: FV.increment(1), "changed.1500": ts() }));
    await ok(db.doc(own).update(
      { lastActivityAt: ts(), writeCount: FV.increment(1), [`changed.${offeringId}`]: ts() }));
  });

  it("refuses resetting or skipping writeCount on update", async () => {
    await seedOld();
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 1 }, { merge: true }));
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 9 }, { merge: true }));
    await ok(db.doc(own).set({ lastActivityAt: ts(), writeCount: 4 }, { merge: true }));
  });

  it("refuses an update that leaves lastActivityAt unchanged", async () => {
    await seedOld();
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).set({ writeCount: FV.increment(1), changed: { [offeringId]: ts() } }, { merge: true }));
  });

  it("accepts a staging portal token on the staging segment, with or without a trailing slash", async () => {
    const stagingPortal = "learn_portal_staging_concord_org";
    const path = `researcher_dashboard/${stagingPortal}/activity/${thisClass}/users/1`;
    const stagingHost = "https://learn.portal.staging.concord.org";
    for (const platform_id of [stagingHost, `${stagingHost}/`]) {
      await prepareEachTest();
      const db = initFirestore({ ...learnerAuth, uid: `st-${platform_id.length}`, platform_id });
      await ok(db.doc(path).set(first(), { merge: true }));
      await no(db.doc(own).set(first(), { merge: true }));
    }
  });

  it("refuses a portal segment that only matches after underscores are read as dots", async () => {
    const db = initFirestore({ ...learnerAuth, uid: "evil", platform_id: "https://learn_concord.org/" });
    await no(db.doc(own).set(first(), { merge: true }));
  });

  it("refuses an existing document that has no lastActivityAt", async () => {
    await adminWriteDoc(own, { writeCount: 1 });
    const db = initFirestore(learnerAuth);
    await no(db.doc(own).set({ lastActivityAt: ts(), writeCount: 2 }, { merge: true }));
  });
});

describe("researcher dashboard activity write floor", () => {
  const write = (db: firebase.firestore.Firestore) => db.doc(own).set(next({ [offeringId]: ts() }), { merge: true });
  beforeEach(prepareEachTest);
  afterAll(() => tearDownTests());

  it("accepts a write 5000 ms after the previous acknowledgment, 10 times running", async () => {
    const db = initFirestore(learnerAuth);
    await assertSucceeds(write(db));
    for (let i = 0; i < 10; i++) {
      await sleep(5000);
      await assertSucceeds(write(db));
    }
  }, 90000);

  it("refuses a write 4900 ms after the acknowledgment", async () => {
    const db = initFirestore(learnerAuth);
    await assertSucceeds(write(db));
    await sleep(4900);
    await assertFails(write(db));
  }, 20000);

  it("accepts exactly one of two tabs writing at once", async () => {
    await assertSucceeds(write(initFirestore(learnerAuth)));
    await sleep(5200);
    const results = await Promise.allSettled([write(initFirestore(learnerAuth)), write(initFirestore(learnerAuth))]);
    expect(results.filter(r => r.status === "fulfilled").length).toBe(1);
  }, 20000);
});
