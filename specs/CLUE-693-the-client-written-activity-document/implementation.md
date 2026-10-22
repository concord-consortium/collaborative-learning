# Implementation Plan: The client-written activity document

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-693
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Every code block below was built for real in this worktree on 2026-10-22 and then reverted: type-checked (`tsc --noEmit` clean), run against the existing suites for every touched file (14 suites, 229 tests, all passing), and the tests this plan adds run as written (the recorder's 27, the base manager's 4, the concurrent manager's callback cases, the hook's 3 and the wiring test). Eight mutations of the recorder (a debounce, releasing on any save, dropping the tick filter, flushing on hidden, dropping the class and offering gate, never restarting after a stop, not resetting refusals on success, holding a `pagehide` write to the floor) each failed exactly the test meant to catch it.

The rule is the research's draft, unchanged; this branch's `firestore.rules` is byte-identical to the file the research harness ran it against, so its results (19 cases, every clause load-bearing, the full rules suite of 511 passing) hold here.

### The learner write rule, its tests and the index exemption

**Summary**: Lets a launched learner write their own activity document under the limits R9 lists, pins those limits with emulator tests, and exempts `changed` from indexing. Deploys before the client (rules: before, indexes: before), so it is its own commit and can ship alone.

**Files affected**:
- `firestore.rules`: the write rule and a rewritten block comment.
- `firestore.indexes.json`: the `users.changed` field override.
- `firebase-test/src/setup-rules-tests.ts`: a shared `learnerAuth` fixture.
- `firebase-test/src/researcher-dashboard-activity-rules.test.ts`: the write and timing cases; the "every client write" test rewritten.

**Estimated diff size**: ~290 lines

`firestore.rules`, replacing the block at `:825-829`:

```
    // The researcher dashboard's per-learner activity documents. The CLUE app writes the launched
    // learner's own document after each saved change, at most every 5 seconds. A researcher of the
    // class may read them.
    match /researcher_dashboard/{portal}/activity/{classHash}/users/{uid} {
      // Same label comparison report-service uses for its activity documents.
      function tokenPortalIs() {
        return request.auth.token.platform_id.split('://')[1].split('/')[0].split('\\.') == portal.split('_');
      }
      function isOwnLearnerWrite() {
        return hasRole("learner") && hasUserId()
          && string(request.auth.token.platform_user_id) == uid
          && request.auth.token.class_hash == classHash
          && tokenPortalIs();
      }
      function isValidActivity() {
        let d = request.resource.data;
        let before = resource == null ? {} : resource.data;
        let offering = string(request.auth.token.offering_id);
        let keys = d.get("changed", {}).diff(before.get("changed", {})).affectedKeys();
        return d.keys().hasOnly(["lastActivityAt", "writeCount", "changed"])
          && d.lastActivityAt == request.time
          && d.writeCount == before.get("writeCount", 0) + 1
          && keys.hasOnly([offering])
          && (!(offering in keys) || d.changed[offering] == request.time)
          && (resource == null || request.time >= before.lastActivityAt + duration.value(5, "s"));
      }
      allow get, list: if isAuthedResearcher() && request.auth.token.class_hash == classHash;
      allow create, update: if isOwnLearnerWrite() && isValidActivity();
    }
```

`firestore.indexes.json`, appended to `fieldOverrides` (as `d8e954a45` on the old branch had it):

```json
    {
      "collectionGroup": "users",
      "fieldPath": "changed",
      "ttl": false,
      "indexes": []
    }
```

`setup-rules-tests.ts`, after `studentAuth`:

```ts
// The claims the portal really mints for a launched student. studentAuth's user_type "student" is the
// client-side remap, which no rule sees; rules that grant learners must be tested with this.
export const learnerAuth = {
  uid: "learner-firebase-uid", platform_user_id: studentIdNumeric, user_type: "learner", class_hash: thisClass,
  offering_id: offeringIdNumeric, platform_id: "https://learn.concord.org/"
};
```

`researcher-dashboard-activity-rules.test.ts`, in full. The read tests are unchanged; "refuses every client write, the class's researcher included" keeps its body and is renamed for what it now shows, since the learner can write; two new `describe` blocks hold R11's write and timing cases. This file ran as shown against this branch's rules with the block above (28 passing, 2026-10-22), and the whole rules suite with it (514 passing, 2 skipped). Run with `npm --prefix firebase-test run test:exec` (Java 21); the floor block adds about a minute of real-time sleeps.

```ts
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
```

---

### Report uploaded local entries from the history managers

**Summary**: Adds an `onLocalEntryUploaded` callback to `IFirestoreHistoryManagerArgs`, invoked once per local entry after Firestore accepts it. An entry whose upload fails, or which is rolled back before upload, is never reported, which is how R4's "dropped" entries are dropped: the recorder only learns of an entry once it has landed.

**Files affected**:
- `src/models/history/firestore-history-manager.ts`: the arg, the field, and an awaited `set` followed by the callback.
- `src/models/history/firestore-history-manager-concurrent.ts`: the callback for each entry of a committed transaction.
- `src/models/history/firestore-history-manager.test.ts`, `firestore-history-manager-concurrent.test.ts`: tests.

**Estimated diff size**: ~110 lines

`firestore-history-manager.ts`:

```ts
import { HistoryEntry, HistoryEntrySnapshot, HistoryEntryType } from "./history";
...
  onContentDrift?: (message: string) => void;
  // Invoked once for each local entry after Firestore has accepted its upload. Not invoked for an entry
  // whose upload fails or that is rolled back before it is uploaded.
  onLocalEntryUploaded?: (entry: HistoryEntryType) => void;
}
...
  onLocalEntryUploaded: ((entry: HistoryEntryType) => void) | undefined;
...
  constructor({ ..., onContentDrift, onLocalEntryUploaded }: IFirestoreHistoryManagerArgs) {
    ...
    this.onLocalEntryUploaded = onLocalEntryUploaded;
```

and in `onHistoryEntryCompleted`, at `:247`:

```ts
    await docRef.set({
      index,
      created: firestore.timestamp(),
      previousEntryId,
      entry: JSON.stringify(snapshot)
    });
    this.onLocalEntryUploaded?.(entry);
```

Awaiting the `set` changes nothing for callers: `TreeManager.completeHistoryEntry` does not await `onHistoryEntryCompleted`, entries' indexes are assigned before the `set`, and a rejected `set` was already an unhandled rejection.

`firestore-history-manager-concurrent.ts`, in the `!uploadAborted` branch at `:375-385`, after `setExpectedRemoteHead`:

```ts
        entriesToUpload.forEach(entry => this.onLocalEntryUploaded?.(entry));
```

The constructor arg reaches the subclass through `super(args)`.

Tests:
- `firestore-history-manager-concurrent.test.ts`, a `describe("onLocalEntryUploaded")` using `setupManager`: "reports each entry of a committed transaction, in order" (two queued entries, metadata head matching `expectedRemoteHead`, callback ids `["L1", "L2"]`); "reports nothing when the transaction is aborted by a moved head" (metadata head `R1`, callback not called); "reports nothing for an entry rolled back before upload" (seed `tree.setItems([a, b])` and apply `L1`'s patch so its inverse resolves, queue `L1`, `rollbackLocalEntries(1, [])`, then `uploadQueuedHistoryEntries()`: the queue is empty, no transaction `set`, callback not called). Set `historyManager.onLocalEntryUploaded = jest.fn()` after setup; all three were run against the change.
- `firestore-history-manager.test.ts`, a `describe("onHistoryEntryCompleted")`: the mock firestore gains `documentRef: jest.fn(() => ({ set }))` and the info promise is stubbed (`historyManager.firestoreHistoryInfoPromise = Promise.resolve({ documentPath: "d", lastEntryIndex: -1, lastEntryId: null })`). Cases: "reports the entry after its set resolves" (a deferred `set`; not called before it resolves, called once with the entry after); "does not report an entry whose set rejects" (`await expect(onHistoryEntryCompleted(...)).rejects`, callback not called); "does not report an entry when uploadLocalHistory is false"; "does not report an entry when the metadata document never appears" (`firestoreHistoryInfoPromise` rejected).

---

### Record each content save's history entry id on the document

**Summary**: The save hook already stamps each RTDB content save with `lastHistoryEntryId`; it now hands that id to the document when the save succeeds, so the recorder can tell which entries the saved content covers. Reuses `DocumentModel.savedLastHistoryEntryId` (the loaded envelope's id) rather than adding a second field for the same value.

**Files affected**:
- `src/hooks/use-document-sync-to-firebase.ts`: the mutation resolves to the id it saved, a retry keeping its first attempt's id; `onSuccess` sets it.
- `src/models/document/document.ts`: the field's comment.
- `src/hooks/use-document-sync-to-firebase.test.ts`: a test.

**Estimated diff size**: ~65 lines

```ts
  type SyncMutationOptions =
    Omit<UseMutationOptions<string | undefined, unknown, SnapshotOut<DocumentContentSnapshotType>, SyncContext>,
      'mutationFn'>;
  ...
    onSuccess: (lastHistoryEntryId, snapshot, context) => {
      debugLog(...);
      const seq = context?.seq ?? 0;
      if (seq > savedSeqRef.current) savedSeqRef.current = seq;
      if (lastHistoryEntryId) document.setSavedLastHistoryEntryId(lastHistoryEntryId);
      ...
  const stampedIdsRef = useRef(new WeakMap<DocumentContentSnapshotType, string | undefined>());
  const transform = (snapshot: DocumentContentSnapshotType):
      { changeCount: number, content: string, lastHistoryEntryId?: string } => {
    ...
    // A retry runs again with the same snapshot and must keep the id of its first attempt, or the
    // older content would be stamped with a later entry.
    const stampedIds = stampedIdsRef.current;
    const treeManager = document.treeManagerAPI as TreeManagerType | undefined;
    const lastHistoryEntryId = stampedIds.has(snapshot)
      ? stampedIds.get(snapshot)
      : treeManager?.latestDocumentHistoryEntry?.id;
    stampedIds.set(snapshot, lastHistoryEntryId);
  ...
    const content = transform(snapshot);
    promises.push(firebase.ref(contentPath).update(content));
    return Promise.all(promises).then(() => content.lastHistoryEntryId);
```

`document.ts:107-111`, the comment above `savedLastHistoryEntryId`:

```ts
    // The envelope's lastHistoryEntryId: the id of the last history entry that
    // had been applied when the content in RTDB was saved. Loaded with the
    // document, and updated by each successful content save. The history
    // manager reads the loaded value once to detect drift between the content
    // and the Firestore history chain; the activity recorder reads it to know
    // which entries the saved content covers. Undefined for pre-feature saves
    // or documents with no history.
```

The drift check is unaffected: `documents.ts:266` copies the field into the manager's own `savedLastHistoryEntryId` when the manager is created, at document load, before any save, and the check runs once against that copy.

Test, in `use-document-sync-to-firebase.test.ts`: "records the saved history entry id on the document when a content save succeeds". Give the document a history entry (`treeManager.addHistoryEntryAfterApplying(HistoryEntry.create({ id: "e1", ... }))`), render the hook, `addTile("text")`, advance timers, and expect `document.savedLastHistoryEntryId` to be the id the hook wrote (the `lastHistoryEntryId` in `mockUpdate`'s argument). A second case: a save that fails leaves the field unchanged. A third: "a retried save keeps the history entry id of its first attempt" (`mockUpdate` rejects once; add entry `e2` before `jest.runAllTimers()`; the retry's `lastHistoryEntryId` equals the first attempt's, not `e2`). The file's `mockUseMutation` already passes the mutation's resolved value to `onSuccess`.

---

### The activity recorder

**Summary**: The recorder (R1 to R8), its tests (R12), and the wiring that hands it every uploaded entry: `DocumentsModel` holds it and passes `onLocalEntryUploaded` into both managers, and `Stores` creates it where it sets the documents' Firestore.

**Files affected**:
- `src/models/stores/activity-recorder.ts`: new.
- `src/models/stores/activity-recorder.test.ts`: new.
- `src/models/stores/documents.ts`: a volatile `activityRecorder`, `setActivityRecorder`, and the callback in `historyManagerArgs`.
- `src/models/stores/stores.ts`: creates the recorder.
- `src/models/stores/documents.test.ts`: a wiring test.
- `firestore.rules`: the block comment's first sentence gains the pointer to the client constant, which exists from this step on: "at most every 5 seconds (the floor below must equal kActivityWriteFloorMs in src/models/stores/activity-recorder.ts)". Comment only; the rule is unchanged.

**Estimated diff size**: ~530 lines

`activity-recorder.ts`:

```ts
import firebase from "firebase/app";
import { reaction, IReactionDisposer } from "mobx";
import { escapeKey } from "../../lib/fire-utils";
import { Firestore } from "../../lib/firestore";
import { AppMode } from "./store-types";
import { UserModelType } from "./user";
import { DocumentModelType } from "../document/document";
import { isPlanningType, isProblemType } from "../document/document-types";
import { HistoryEntryType } from "../history/history";
import { TreeManagerType } from "../history/tree-manager";

// Must equal the floor in firestore.rules' researcher_dashboard block, which refuses a write sooner
// than this after the stored lastActivityAt. activity-recorder.test.ts reads the rule to check.
export const kActivityWriteFloorMs = 5000;
// How long a change whose history has been uploaded waits for a content save that covers it.
export const kActivitySaveTimeoutMs = 30000;
// Consecutive refused writes after which the recorder waits for the next change.
export const kActivityMaxRefusals = 3;

// Entries a running Simulator or DataFlow tile records on its own, every step. They are not activity.
const kTickEntries: Array<{ model: string, actionSuffix: string }> = [
  { model: "SimulatorTool", actionSuffix: "/step" },
  { model: "DataflowProgram", actionSuffix: "/tickAndProcess" }
];

export function isTickEntry(entry: Pick<HistoryEntryType, "model" | "action">) {
  return kTickEntries.some(({ model, actionSuffix }) =>
    entry.model === model && !!entry.action?.endsWith(actionSuffix));
}

export interface IActivityRecorderStores {
  appMode: AppMode;
  user: UserModelType;
  db: { firestore: Firestore };
}

interface IPendingChange {
  entryId: string;
  document: DocumentModelType;
  inLaunchOffering: boolean;
  uploadedAt: number;
}

/**
 * Keeps the launched student's researcher dashboard activity document,
 * researcher_dashboard/{portal}/activity/{classHash}/users/{uid}, current. A change counts once its
 * history entry has been uploaded and a content save covering it has succeeded; writes are at least
 * kActivityWriteFloorMs apart and each covers every change that has landed by then.
 */
export class ActivityRecorder {
  private pending: IPendingChange[] = [];
  private inFlight = false;
  private lastAckAt: number | undefined;
  private refusals = 0;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timerDueAt: number | undefined;
  private saveReactions = new Map<DocumentModelType, IReactionDisposer>();

  constructor(private stores: IActivityRecorderStores) {
    window.addEventListener("pagehide", this.handlePageHide);
  }

  dispose() {
    window.removeEventListener("pagehide", this.handlePageHide);
    this.clearTimer();
    this.saveReactions.forEach(dispose => dispose());
    this.saveReactions.clear();
  }

  get isEnabled() {
    const { appMode, user } = this.stores;
    return appMode === "authed" && user.isStudent && !!user.classHash && !!user.offeringId;
  }

  get documentPath() {
    const { user } = this.stores;
    return `researcher_dashboard/${escapeKey(user.portal)}/activity/${user.classHash}/users/${user.id}`;
  }

  isInLaunchOffering(document: DocumentModelType) {
    const { user } = this.stores;
    if (isProblemType(document.type) || isPlanningType(document.type)) return true;
    return !!user.userIdForGroupDocuments && document.uid === user.userIdForGroupDocuments;
  }

  onLocalEntryUploaded(document: DocumentModelType, entry: HistoryEntryType) {
    if (!this.isEnabled || isTickEntry(entry)) return;
    this.stopped = false;
    this.refusals = 0;
    this.pending.push({
      entryId: entry.id, document, inLaunchOffering: this.isInLaunchOffering(document), uploadedAt: Date.now()
    });
    this.watchSaves(document);
    this.schedule();
  }

  private watchSaves(document: DocumentModelType) {
    if (this.saveReactions.has(document)) return;
    this.saveReactions.set(document, reaction(() => document.savedLastHistoryEntryId, () => this.schedule()));
  }

  private unwatchSettledDocuments() {
    this.saveReactions.forEach((dispose, document) => {
      if (!this.pending.some(change => change.document === document)) {
        dispose();
        this.saveReactions.delete(document);
      }
    });
  }

  private isSaved(change: IPendingChange) {
    const { document, entryId } = change;
    const savedId = document.savedLastHistoryEntryId;
    if (!savedId) return false;
    const history = (document.treeManagerAPI as TreeManagerType | undefined)?.document.history;
    if (!history) return false;
    const entryIndex = history.findIndex(e => e.id === entryId);
    const savedIndex = history.findIndex(e => e.id === savedId);
    return entryIndex >= 0 && savedIndex >= entryIndex;
  }

  private hasLanded(change: IPendingChange, now: number) {
    return this.isSaved(change) || now - change.uploadedAt >= kActivitySaveTimeoutMs;
  }

  private setTimer(dueAt: number) {
    if (this.timer && this.timerDueAt !== undefined && this.timerDueAt <= dueAt) return;
    this.clearTimer();
    this.timerDueAt = dueAt;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.timerDueAt = undefined;
      this.schedule();
    }, Math.max(0, dueAt - Date.now()));
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.timerDueAt = undefined;
  }

  private schedule() {
    if (this.inFlight || this.stopped || this.pending.length === 0) return;
    const now = Date.now();
    const landed = this.pending.filter(change => this.hasLanded(change, now));
    if (landed.length === 0) {
      this.setTimer(Math.min(...this.pending.map(change => change.uploadedAt + kActivitySaveTimeoutMs)));
      return;
    }
    const dueAt = this.lastAckAt === undefined ? now : this.lastAckAt + kActivityWriteFloorMs;
    if (now < dueAt) {
      this.setTimer(dueAt);
      return;
    }
    this.write(landed);
  }

  private write(changes: IPendingChange[]) {
    const { user, db } = this.stores;
    const { FieldValue } = firebase.firestore;
    this.pending = this.pending.filter(change => !changes.includes(change));
    this.unwatchSettledDocuments();
    const data: Record<string, any> = {
      lastActivityAt: FieldValue.serverTimestamp(),
      writeCount: FieldValue.increment(1)
    };
    if (changes.some(change => change.inLaunchOffering)) {
      data.changed = { [user.offeringId]: FieldValue.serverTimestamp() };
    }
    this.inFlight = true;
    db.firestore.documentRef(this.documentPath).set(data, { merge: true })
      .then(() => {
        this.refusals = 0;
      })
      .catch(error => {
        // Refused by the rule's floor (another tab wrote) or otherwise failed: keep the changes for the
        // next write.
        this.pending = [...changes, ...this.pending];
        changes.forEach(change => this.watchSaves(change.document));
        this.refusals++;
        if (this.refusals >= kActivityMaxRefusals) this.stopped = true;
        console.warn("Could not record researcher dashboard activity", error);
      })
      .finally(() => {
        this.lastAckAt = Date.now();
        this.inFlight = false;
        this.schedule();
      });
  }

  private handlePageHide = () => {
    if (!this.isEnabled || this.pending.length === 0) return;
    this.clearTimer();
    this.write([...this.pending]);
  };
}
```

How the code meets the requirements, where it is not plain from the code:
- **R4, the save condition**: `isSaved` compares positions in the document's history, because a leading save of a shared-model edit carries the previous entry's id (requirements, Technical Notes). The 30 s timeout runs from the upload, since the recorder learns of an entry only then.
- **R5, no debounce**: `setTimer` keeps an earlier timer rather than replacing it, so a new change never pushes back a write that is due. The floor is measured from `lastAckAt`, set when the previous write settles, which is after the server's `request.time` for it, so the client never writes inside the rule's window on its own.
- **R5, hidden**: hiding the tab needs no handler. Every upload, save and timer already calls `schedule`, so landed changes are written when the floor allows and unconfirmed ones keep waiting, hidden or not; the hidden test guards against a flush on hide. **`pagehide`** writes everything pending, landed or not, ignoring the floor and a write in flight.
- **R6**: a refusal (the rule's floor, when another tab wrote) puts the changes back, sets `lastAckAt` so the retry waits the floor, and the third consecutive refusal stops the recorder until `onLocalEntryUploaded` sees the next counted change.
- **R7**: one write may cover changes in several documents; `changed` is set when any of them is in the launch offering.

`documents.ts`:

```ts
import type { ActivityRecorder } from "./activity-recorder";
...
  .volatile(self => ({
    ...
    firestore: undefined as Firestore | undefined,
    activityRecorder: undefined as ActivityRecorder | undefined,
...
    setActivityRecorder(activityRecorder: ActivityRecorder) {
      self.activityRecorder = activityRecorder;
    },
...
        const historyManagerArgs: IFirestoreHistoryManagerArgs = {
          ...
          onContentDrift: (message) => { ... },
          onLocalEntryUploaded: (entry) => self.activityRecorder?.onLocalEntryUploaded(document, entry)
        };
```

`stores.ts`, in the `runInAction` at `:405-411`, after `setUserContextProvider`:

```ts
      if (!this.documents.activityRecorder) {
        this.documents.setActivityRecorder(new ActivityRecorder(this));
      }
```

`Stores` satisfies `IActivityRecorderStores` (`appMode`, `user`, `db.firestore`). The recorder is created for every launch and checks R1 on each entry (`isEnabled`), because the user is authenticated and their offering known only after the stores exist.

`activity-recorder.test.ts`:

```ts
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { createDocumentModel, DocumentModelType } from "../document/document";
import { HistoryEntry } from "../history/history";
import { TreeManagerType } from "../history/tree-manager";
import { UserModel } from "./user";
import {
  ActivityRecorder, IActivityRecorderStores, kActivitySaveTimeoutMs, kActivityWriteFloorMs
} from "./activity-recorder";

jest.mock("firebase/app", () => ({
  firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIME", increment: (n: number) => ({ increment: n }) } }
}));

const mockSet = jest.fn();
const mockDocumentRef = jest.fn((_path: string) => ({ set: mockSet }));

const makeStores = (overrides: Partial<IActivityRecorderStores> = {}, user = {}): IActivityRecorderStores => ({
  appMode: "authed",
  user: UserModel.create({
    id: "7", type: "student", classHash: "cls", offeringId: "2000", portal: "learn.concord.org",
    currentGroupId: "3", ...user
  }),
  db: { firestore: { documentRef: mockDocumentRef } as any },
  ...overrides
});

const makeDocument = (type = "problem", uid = "7") =>
  createDocumentModel({ type: type as any, key: nanoid(), uid, content: {} });

const addEntry = (document: DocumentModelType, model = "TextContent",
                  action = "/content/tileMap/t/content/setText") => {
  const entry = HistoryEntry.create({ id: nanoid(), tree: document.key, model, action, state: "complete" });
  (document.treeManagerAPI as TreeManagerType).addHistoryEntryAfterApplying(entry);
  return entry;
};

const addSavedEntry = (document: DocumentModelType) => {
  const entry = addEntry(document);
  document.setSavedLastHistoryEntryId(entry.id);
  return entry;
};

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("ActivityRecorder", () => {
  let recorder: ActivityRecorder;

  beforeEach(() => {
    jest.useFakeTimers();
    mockSet.mockReset();
    mockSet.mockResolvedValue(undefined);
    mockDocumentRef.mockClear();
  });
  afterEach(() => {
    recorder?.dispose();
    setVisibility("visible");
    jest.useRealTimers();
  });

  it("writes nothing for a Simulator or DataFlow tick", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    const tick = addEntry(doc, "SimulatorTool", "/content/tileMap/s/content/step");
    const df = addEntry(doc, "DataflowProgram", "/content/tileMap/d/content/program/tickAndProcess");
    recorder.onLocalEntryUploaded(doc, tick);
    recorder.onLocalEntryUploaded(doc, df);
    doc.setSavedLastHistoryEntryId(df.id);
    jest.advanceTimersByTime(kActivitySaveTimeoutMs * 2);
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("waits for a content save covering the entry, and an earlier entry's save does not release it", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    const first = addEntry(doc);
    const second = addEntry(doc);
    doc.setSavedLastHistoryEntryId(first.id);
    recorder.onLocalEntryUploaded(doc, second);
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
    doc.setSavedLastHistoryEntryId(second.id);
    await flush();
    expect(mockDocumentRef).toHaveBeenCalledWith("researcher_dashboard/learn_concord_org/activity/cls/users/7");
    expect(mockSet.mock.calls).toEqual([[
      { lastActivityAt: "SERVER_TIME", writeCount: { increment: 1 }, changed: { "2000": "SERVER_TIME" } },
      { merge: true }
    ]]);
  });

  it("writes an unsaved change once the save timeout passes", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    jest.advanceTimersByTime(kActivitySaveTimeoutMs - 1);
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("gives one leading and one trailing write inside the floor, the trailing covering a change made in flight",
  async () => {
    let resolveSet: () => void = () => undefined;
    mockSet.mockImplementationOnce(() => new Promise<void>(r => { resolveSet = r; }));
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    resolveSet();
    await flush();
    jest.advanceTimersByTime(kActivityWriteFloorMs - 1);
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("keeps writing every floor interval under a steady stream of changes", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    for (let second = 0; second < 16; second++) {
      recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
      jest.advanceTimersByTime(1000);
      await flush();
    }
    expect(mockSet).toHaveBeenCalledTimes(4);
  });

  it("when hidden writes nothing for a change whose save is not confirmed", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    setVisibility("hidden");
    await flush();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("on pagehide writes a change whose save is not confirmed", () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addEntry(doc));
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("on pagehide writes inside the floor of the previous write", async () => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("retries a refused write after the floor and stops after three refusals", async () => {
    mockSet.mockRejectedValue(new Error("permission-denied"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    for (let i = 0; i < 5; i++) {
      await flush();
      jest.advanceTimersByTime(kActivityWriteFloorMs);
    }
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["problem", "7", true], ["planning", "7", true], ["axes", "group_2000_3", true],
    ["axes", "group_1999_3", false], ["personal", "7", false], ["learningLog", "7", false],
    ["axes", "class_cls", false]
  ])("a %s document owned by %s sets the offering key: %s", (type, uid, expected) => {
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument(type, uid);
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect("changed" in mockSet.mock.calls[0][0]).toBe(expected);
  });

  it.each([
    ["demo", "student"], ["qa", "student"], ["dev", "student"], ["test", "student"],
    ["authed", "teacher"], ["authed", "researcher"]
  ])("writes nothing in %s mode for a %s", (appMode, type) => {
    recorder = new ActivityRecorder(makeStores({ appMode: appMode as any }, { type }));
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).not.toHaveBeenCalled();
  });

  it.each(["classHash", "offeringId"])("writes nothing for a student whose launch has no %s", field => {
    recorder = new ActivityRecorder(makeStores({}, { [field]: "" }));
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    window.dispatchEvent(new Event("pagehide"));
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("after stopping, writes again on the next counted change", async () => {
    mockSet.mockRejectedValue(new Error("permission-denied"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    for (let i = 0; i < 5; i++) {
      await flush();
      jest.advanceTimersByTime(kActivityWriteFloorMs);
    }
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(3);
    mockSet.mockResolvedValue(undefined);
    recorder.onLocalEntryUploaded(doc, addSavedEntry(doc));
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(4);
  });

  it("counts only consecutive refusals: a success in between resets the count", async () => {
    const refuse = () => Promise.reject(new Error("permission-denied"));
    mockSet.mockImplementationOnce(refuse).mockImplementationOnce(refuse)
      .mockImplementationOnce(() => Promise.resolve()).mockImplementationOnce(refuse);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    recorder = new ActivityRecorder(makeStores());
    const doc = makeDocument();
    const saved = addSavedEntry(doc);
    const unsaved = addEntry(doc);
    recorder.onLocalEntryUploaded(doc, unsaved);
    recorder.onLocalEntryUploaded(doc, saved);
    for (let i = 0; i < 3; i++) {
      await flush();
      jest.advanceTimersByTime(kActivityWriteFloorMs);
    }
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(3);
    doc.setSavedLastHistoryEntryId(unsaved.id);
    for (let i = 0; i < 3; i++) {
      await flush();
      jest.advanceTimersByTime(kActivityWriteFloorMs);
    }
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(5);
  });

  it("uses the same floor as firestore.rules", () => {
    const rules = fs.readFileSync(path.join(__dirname, "../../../firestore.rules"), "utf8");
    const block = rules.slice(rules.indexOf("match /researcher_dashboard/"));
    const seconds = block.match(/duration\.value\((\d+), "s"\)/)?.[1];
    expect(Number(seconds) * 1000).toBe(kActivityWriteFloorMs);
  });
});
```

`documents.test.ts`, "passes uploaded entries of each document to the activity recorder", with `jest.mock("../history/history-firestore", () => ({ getLastHistoryEntry: jest.fn().mockResolvedValue(undefined), loadHistory: jest.fn(() => jest.fn()) }))` so the concurrent manager's constructor does not reach Firestore: a `DocumentsModel` with `setFirestore` (a mock whose `doc().onSnapshot` reports `exists`), `setUserContextProvider` (`{ userContext: { uid: "1" } }`) and `setActivityRecorder({ onLocalEntryUploaded: jest.fn() } as any)`; `add` a problem document and a concurrent group document; call each document's `treeManagerAPI.historyManager.onLocalEntryUploaded(entry)` and expect the recorder called with that document and entry.

---

### Document the activity documents

**Summary**: The contract R14 asks for, in `docs/firestore-schema.md`, where the old branch's README section would have pointed.

**Files affected**:
- `docs/firestore-schema.md`: a "Researcher dashboard activity" section; `researcher_dashboard` in the top-level collection list.

**Estimated diff size**: ~45 lines

Before "## Top level collections":

```markdown
## Researcher dashboard activity

The top-level `researcher_dashboard` collection holds the portal researcher dashboard's per-learner
activity documents, at `researcher_dashboard/{portal}/activity/{class_hash}/users/{uid}`: `{portal}` is
the portal host with `.` as `_`, `{uid}` the student's portal user id. They have the shape
report-service writes for Activity Player answers, so the dashboard reads both the same way:

- `lastActivityAt`: the server time of the write that recorded the student's most recent change, not
  the time of the change itself, which is earlier.
- `writeCount`: incremented by each write; a change signal, compared only for inequality.
- `changed`: a map from portal offering id to the server time of the write that recorded the student's
  last change in that offering's problem, planning or group documents. Personal, learning log and class
  documents update only the first two fields.

The CLUE app writes the document itself (`src/models/stores/activity-recorder.ts`), only for a student
launched from the portal or standalone (`appMode` `authed`). A change counts once its history entry is
uploaded and a content save covering it has succeeded, or 30 seconds after the upload if no such save
is confirmed; a change still waiting when the page closes is written then. A change whose history
upload fails, or that is rolled back after a conflicting edit in a group or class document, is never
recorded. The steps a running Simulator or DataFlow tile records on its own (`SimulatorTool`
`.../step`, `DataflowProgram` `.../tickAndProcess`) do not count. Writes are at least 5 seconds apart:
the Firestore rule refuses a sooner one, and limits a student to their own document, their own class
and portal, their launch offering's key and the server's clock. Only a researcher token for the class
can read them. Nothing deletes them.

Activity is recorded only for students on a CLUE release that includes the recorder, launched from an
offering that uses the current version: an offering pinned to a `/version/` URL records nothing until it
is repointed. A launch without `firebaseEnv=staging` writes to production Firebase, even from the staging
portal.
```

and "Besides `analysis` and `summaries`, …" becomes "Besides `analysis`, `summaries` and `researcher_dashboard`, …".

## Open Questions

### RESOLVED: Judgment call: reuse `savedLastHistoryEntryId` or add a field for the last saved entry
**Context**: The sketch asks for "a volatile last-saved history entry id". `DocumentModel.savedLastHistoryEntryId` already holds the envelope's id as loaded.
**Options considered**:
- A) A new volatile field beside it.
- B) Keep the existing field current on every save.

**Decision**: B. Both hold "the id stamped on the content now in RTDB"; two fields for one value is what reviewers here flag. The drift check reads its own copy, taken at load (`documents.ts:266`), so updating the field later cannot affect it.

### RESOLVED: Judgment call: create the recorder when R1 holds, or always and gate per entry
**Context**: The sketch says `stores.ts` "creates the recorder when R1 holds".
**Options considered**:
- A) Create it after authentication, only for a launched student.
- B) Create it where `Stores` sets the documents' Firestore, and check R1 on each entry.

**Decision**: B. The user is authenticated and their offering known after the stores exist, and `setAppMode` can change the mode; a per-entry check needs no second hook into authentication and is what the gate tests exercise. The behavior is R1's either way.

### RESOLVED: Judgment call: how the recorder learns an entry failed or was rolled back
**Context**: R4 drops an entry whose upload fails or is rolled back.
**Options considered**:
- A) The managers report completion, upload, failure and rollback; the recorder tracks each.
- B) The managers report only successful uploads; the recorder never hears of the rest.

**Decision**: B. A rolled-back entry is removed from the queue before upload (`firestore-history-manager-concurrent.ts:458-460`) and a failed one never resolves, so neither reaches the callback, with no extra API for Scott to review.

## Self-Review

Roles: commit reviewer, test writer, Senior Engineer, Operator. Each claim below was checked by building the step.

### Commit reviewer

#### RESOLVED: Each step builds on the ones before it
The rules step stands alone; the manager callback and the save-hook steps each compile and pass on their own; the recorder step uses both. Applied in that order, `tsc --noEmit` passes at the end, and nothing in an earlier step names a later one.

#### RESOLVED: The plan touched `chat-tutor-rules.test.ts` for no requirement
An earlier draft rewrote that file's comment to point at the new `learnerAuth`. No requirement asks for it, and its local fixture uses its own ids throughout. Dropped from the plan.

### Test writer

#### RESOLVED: The rule-test bodies pointed at `/tmp`
They were described as the research's cases with substitutions, in a directory emptied at every boot. Replaced with the full file, rebuilt from those cases and run (28 passing).

#### RESOLVED: The wiring test needs `history-firestore` mocked
Without it the concurrent manager's constructor calls the real `getLastHistoryEntry`. Added to the test's description; the test then passes.

### Senior Engineer

#### RESOLVED: A retried older save can move the saved id backwards
The hook retries failed saves (`retry: true`), so an older save can succeed after a newer one and set `savedLastHistoryEntryId` to an earlier entry (the hook's own comment at `:218-220` names this race for the content). For the recorder this only delays: an entry already written is unaffected, and a pending one waits for the next save or the 30 s timeout. No change.

### Operator

No findings. The rules step deploys before the client (rules: before, indexes: before); the emulator accepted the new index override, and the full rules suite passes with the new block.

Second pass: Senior Engineer, QA Engineer, Security Engineer, Performance Engineer. Each finding below was confirmed by a throwaway test before it was written down.

### Senior Engineer, second pass

#### RESOLVED: A retried save stamps older content with a later entry's id
react-query 3.39.2 retries by calling `mutationFn` again with the same variables (`mutation.js:144`), so `transform` reads `latestDocumentHistoryEntry` again and stamps the old snapshot with whatever entry is latest by then. A throwaway hook test (first `update` rejected, entry `e2` added before the retry) showed the retry writing `e2`, which `onSuccess` would hand the recorder as saved. Fixed in the save-hook step: the id is kept per snapshot in a `WeakMap`, so a retry reuses its first attempt's id; the same test then passes, as do the file's other 14.

### QA Engineer, second pass

#### RESOLVED: Four recorder lines no test guarded
Built the plan and mutated the recorder; each of these left the 22 tests green: dropping `!!user.classHash && !!user.offeringId` from `isEnabled`, not clearing `stopped` on a new change, not resetting `refusals` on a successful write, and making `pagehide` wait for the floor. Added a test for each (the gate as an `it.each`), and each now fails exactly its mutation; R12 names them. The recorder has 27 tests.

### Security Engineer, second pass

No findings. Checked that `Firestore.documentRef` takes the path as given (no `authed/{portal}` prefix, `firestore.ts:76-79`), that `user.portal` is `parseUrl(basePortalUrl).host` (`portal.ts:176`), and that the student Firebase JWT carries `class_hash`, `platform_id`, `platform_user_id` and `offering_id` (`portal-types.ts:96-106`).

### Performance Engineer, second pass

No findings. `isSaved` scans the document's history only for pending changes, and a reaction exists only while a document has one; tick entries return before either is created.

Third pass: Research Data Analyst, Browser Platform Engineer, Reliability Engineer, Lifecycle Engineer, Technical Writer, commit reviewer. Each finding was checked against the built plan; the throwaway tests named below were run and deleted.

### Research Data Analyst, third pass

#### RESOLVED: Housekeeping entries made on mount count as activity
Some tiles change the document when they mount, with no student input: `TileModel setDefaultTitle` (a legacy text tile with no title, `text-tile.tsx:150,446`), `TileRow setRowHeightWithoutUndo` (a tile's resize observer requesting a row height, `tile-component.tsx:356`), `DataflowContent setOutputConfig` (mirrors the unit config, `dataflow-tile.tsx:82`) and DataFlow's initial `processAfterProgramChange` (`rete-manager.tsx:346`). A throwaway test showed the first two complete as local, non-empty, non-tick entries, so the recorder writes for them: opening a problem document can set `changed` and trigger an RD-6 re-run. The research driver waited 10 s "to let housekeeping entries settle" before measuring, so this was never measured or decided. All of these are `undoable: false`, as are the ticks, but so are `UndoStore` undo and redo entries and `DataCard setCaseIndex`.
**Options considered**:
- A) Count them, as R3 reads now; add "open a document without editing" to R13 to measure how often it writes.
- B) Skip every non-undoable entry except `UndoStore` undo and redo, which replaces the tick list with one rule but also drops data card navigation and `noUndo` shared-variable edits.
- C) Add these actions to the named list beside the ticks; the next fixup counts again until someone adds it.

**Decision**: A (Doug, 2026-10-22). They are real content changes and mostly one-time: the title backfill is saved, `setOutputConfig` is idempotent and an entry with no patches is dropped (`tree-manager.ts:196`); the 5 s floor folds the rest into about one write per open. R13 now measures it.

### Browser Platform Engineer, third pass

#### RESOLVED: The `visibilitychange` handler did nothing
Deleting the listener left all 27 recorder tests green. It only called `schedule()`, and every upload, save reaction and timer already does, so at the moment a tab hides a landed change is either written or has its floor timer set. Removed the handler and its listener; R5's hidden behavior is unchanged and the hidden test still guards against a flush on hide.

### Reliability Engineer, third pass

#### RESOLVED: R6's stop does not stop a student who keeps editing
A throwaway test (every write refused, a change every 4 s) gave 12 refused writes in 60 s: each counted change clears `stopped` and `refusals`, as R6 says. The requirements' Technical Notes said a token mismatch "would stop the recorder"; reworded there and in the Operator entry to give the rate, one refused write and one warning every 5 s.

No finding on offline use: `docRef.set` and the transaction resolve only on the server's acknowledgment (no persistence is enabled), so an offline entry is reported after reconnecting or not at all, and its 30 s timeout starts then.

### Lifecycle Engineer, third pass

No findings. The save's `onSuccess` comes from the mutation's own options (`react-query/lib/core/mutation.js:104`), so it still records the saved id after a document switch unmounts the hook. `Stores` creates one recorder (the `activityRecorder` guard survives a second `loadUnitAndProblem`), and `documents.ts` reads it when an entry is reported, so documents added before it exist are covered. Only publications are ever removed from `DocumentsModel` (`db-other-docs-listener.ts:121`), and they record no entries.

### Technical Writer, third pass

#### RESOLVED: The schema section gave the write time as the change time
`lastActivityAt` and `changed` carry the server time of the write, which comes after the change (usually once its save has landed), and the section left out dropped entries and the `pagehide` write. Reworded both field lines and added a sentence for each; step size now ~45 lines.

### Commit reviewer, third pass

#### RESOLVED: The rules step named a file the recorder step creates
The rule's comment pointed at `kActivityWriteFloorMs` in `activity-recorder.ts`, which does not exist until the recorder step. The rules step's comment now says only "at most every 5 seconds", and the recorder step adds the pointer. Applied alone on `2c6803b1d`, the manager step and the save-hook step each type-check (`tsc --noEmit` clean).
