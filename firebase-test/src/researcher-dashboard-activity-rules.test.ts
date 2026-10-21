import { assertFails } from "@firebase/rules-unit-testing";
import firebase from "firebase";
import {
  adminWriteDoc, expectDeleteToFail, expectQueryToFail, expectQueryToSucceed, expectReadToFail, expectReadToSucceed,
  expectUpdateToFail, expectWriteToFail, initFirestore, otherClass, prepareEachTest, researcherAuth, studentAuth,
  studentId, teacherAuth, tearDownTests, thisClass
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

  it("refuses every client write, the class's researcher included", async () => {
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
