# CLUE-504 Portal-Authenticated Class Summaries — Follow-Up Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the remaining CLUE-504 follow-ups (items 2–4 from [docs/specs/portal-authenticated-class-summaries.md](../../specs/portal-authenticated-class-summaries.md)): add regression tests for `generateClassData_v2`, add an empty-query guard in `updateSingleClassDataDoc`, and remove dead `portal`/`demo` fields from the client call. Item 1 (firestore.rules) shipped in hot-fix commit `a6aeab287`.

**Architecture:** Work extends three areas already exercised by the hot fix.
- Tests: emulator-based Jest suite in `functions-v2/test/`, following the pattern of `update-class-data-docs.test.ts` + `post-document-comment-emulator.test.ts`. Uses `@firebase/rules-unit-testing` Firestore + RTDB emulators on `127.0.0.1:8088` / `9000`.
- Cloud function: `updateSingleClassDataDoc` / `updateClassDataDoc` in `shared/update-class-data-docs.ts` — placeholder written when class has zero qualifying docs.
- Client: `ai-summary.tsx` stops sending dead fields; `IGenerateAiSummaryParams` simplified accordingly.

**Tech Stack:** TypeScript 4.9/5.9, Jest 29, firebase-admin 12, firebase-functions 5, firebase-functions-test 3, `@firebase/rules-unit-testing` 4, React 17, MobX.

---

## Scope Check

Three independent pieces of work, all small. Bundling in one plan because they all land in the same PR that closes CLUE-504. Each task produces a self-contained commit.

## File Structure

Files created or modified:

- **Modify** `functions-v2/test/test-utils.ts` — extend `setupTestDocuments` to support an authed realm (portal-based paths) in addition to the existing demo realm.
- **Create** `functions-v2/test/generate-class-data-emulator.test.ts` — new emulator test file for the `generateClassData` callable. Exercises (a) authed realm with stray `demoName` does not route into demo paths, and (b) a class with zero documents writes a placeholder instead of crashing.
- **Modify** `shared/update-class-data-docs.ts` — add empty-query guard in `updateSingleClassDataDoc`; write a placeholder class data doc (`userCount: 0, documentCount: 0, teacherContent: "", studentContent: "", summary: null, summaryCreatedAt: <server timestamp>`) when `classData[contextId]` is undefined.
- **Modify** `src/components/navigation/ai-summary.tsx` — drop `portal` and `demo` from the `generateClassData` call payload; remove `portal`/`demo` from the component dependencies and destructuring.
- **Modify** `shared/shared.ts` — simplify `IGenerateAiSummaryParams` to drop the now-unused top-level `portal`, `demo`, and `classHash` fields.
- **Modify** `docs/specs/portal-authenticated-class-summaries.md` — update status line and check off the completed remaining-work items.

---

## Task 1: Remove Dead Client Fields and Simplify Shared Interface

**Files:**
- Modify: [src/components/navigation/ai-summary.tsx:49-66](../../../src/components/navigation/ai-summary.tsx#L49-L66)
- Modify: [shared/shared.ts:266-273](../../../shared/shared.ts#L266-L273)

**Context:** The server was updated in the hot fix to derive the Firestore realm from `context.appMode`; it now ignores top-level `portal` and `demo`. The client still sends them, and the shared interface still declares them. `classHash` was never read from the top level — it has always been read from `context.classHash` — so it can go too. Result should match the shape used by `getAiContent_v2` and other callables: `{ context, unit }`.

- [ ] **Step 1: Simplify `IGenerateAiSummaryParams` in `shared/shared.ts`**

Replace the interface so only `unit` remains alongside the base `context`:

```ts
export interface IGenerateAiSummaryParams extends IFirebaseFunctionBaseParams {
  unit: string;
}
```

Exact edit — replace:

```ts
export interface IGenerateAiSummaryParams extends IFirebaseFunctionBaseParams {
  portal: string;
  demo: string;
  unit: string;
  classHash: string;
}
```

with:

```ts
export interface IGenerateAiSummaryParams extends IFirebaseFunctionBaseParams {
  unit: string;
}
```

- [ ] **Step 2: Drop `portal` / `demo` from the `summarize()` call and its deps in `src/components/navigation/ai-summary.tsx`**

Exact edit — replace the current body of `AISummaryContent`'s destructuring and `summarize()`:

```ts
  const { firestore } = useDBStore();
  const { unit, portal, demo } = useStores();
  const userContext = useUserContext();
  const generateClassData = useFirebaseFunction("generateClassData_v2");
  const [summaryData, setSummaryData] = useState<SummaryData>({});
  const [status, setStatus] = useState<Status>("checking");
  const lastSummaryCreatedAtRef = useRef<CreatedAt|undefined>();

  const summarize = useCallback(() => {
    const portalHost = portal.portalHost;
    const demoName = demo.name;
    generateClassData({
      context: userContext,
      portal: portalHost,
      demo: demoName,
      unit: unit.code,
    });
  }, [portal, unit.code, userContext, demo.name, generateClassData]);
```

with:

```ts
  const { firestore } = useDBStore();
  const { unit } = useStores();
  const userContext = useUserContext();
  const generateClassData = useFirebaseFunction("generateClassData_v2");
  const [summaryData, setSummaryData] = useState<SummaryData>({});
  const [status, setStatus] = useState<Status>("checking");
  const lastSummaryCreatedAtRef = useRef<CreatedAt|undefined>();

  const summarize = useCallback(() => {
    generateClassData({
      context: userContext,
      unit: unit.code,
    });
  }, [unit.code, userContext, generateClassData]);
```

- [ ] **Step 3: Type-check and lint**

Run from the repo root:

```bash
npm run check:types
npm run lint -- src/components/navigation/ai-summary.tsx shared/shared.ts
```

Expected: both commands exit 0, no errors. If the type checker reports references to the removed fields elsewhere, surface them — there should be none (the client uses `useFirebaseFunction` without a generic so the call site is untyped, and `generate-class-data.ts` already destructures only `context` and `unit`).

- [ ] **Step 4: Commit**

```bash
git add src/components/navigation/ai-summary.tsx shared/shared.ts
git commit -m "$(cat <<'EOF'
CLUE-504: drop dead portal/demo fields from generateClassData call

The server-side callable now ignores top-level portal/demo (derives from
context.appMode). classHash was always read from context. Simplify the
payload to { context, unit } to match getAiContent_v2 and remove the
stale demoName leak vector.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Empty-Query Guard in `updateSingleClassDataDoc`

**Files:**
- Modify: [shared/update-class-data-docs.ts:162-193](../../../shared/update-class-data-docs.ts#L162-L193)

**Context:** When a class legitimately has zero documents for a unit, `getClassDocumentData` returns an empty map and `classData[contextId]` is `undefined`. `updateClassDataDoc` then crashes on `data.documents`. The fix is to detect the empty case in `updateSingleClassDataDoc` and write a placeholder doc. The scheduled bulk path (`updateClassDataDocsForRealm`) iterates classes returned by the query, so it's naturally protected — we only guard the on-demand single-class path.

Placeholder shape (mirrors the shape `updateClassDataDoc` writes, with empty content). `summaryCreatedAt` is set so the client (which waits for that field to populate) renders the empty-state UI instead of spinning indefinitely.

- [ ] **Step 1: Write the failing test — empty-class case in the new emulator test file**

_This step is interleaved with Task 3 because the test file is new. The test itself is authored in Task 3 Step 3; skip this sub-step and come back after Task 3 lands the file. If Task 3 has already landed, add the following test immediately after the "writes aicontent into authed realm when context has a stray demoName" test:_

```ts
  test("writes placeholder class data doc when class has zero documents", async () => {
    // No documents set up — class exists but is empty for this unit.
    const wrapped = fft.wrap(generateClassData);
    await wrapped({
      data: {
        context: specUserContext({appMode: "authed", portal: kPortal}),
        unit: "qa-config-subtabs",
      },
      auth: authWithTeacherClaims,
    } as any);

    const dataDocPath = `authed/${kCanonicalPortal}/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const classDataDoc = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc.exists).toBe(true);
    expect(classDataDoc.data()).toEqual({
      userCount: 0,
      documentCount: 0,
      teacherContent: "",
      studentContent: "",
      summary: null,
      summaryCreatedAt: expect.anything(),
    });
  });
```

Skip this step for now — proceed to Step 2.

- [ ] **Step 2: Modify `updateSingleClassDataDoc` to write a placeholder when `classData[contextId]` is undefined**

Exact edit in [shared/update-class-data-docs.ts](../../../shared/update-class-data-docs.ts). Replace:

```ts
export async function updateSingleClassDataDoc(portal: string|undefined, demo: string|undefined, unit: string,
    contextId: string, logger: Logger) {
  const classData = await getClassDocumentData(portal, demo, unit, logger, contextId);
  const data = classData[contextId];
  await updateClassDataDoc(portal, demo, unit, contextId, data, logger);
}
```

with:

```ts
export async function updateSingleClassDataDoc(portal: string|undefined, demo: string|undefined, unit: string,
    contextId: string, logger: Logger) {
  const classData = await getClassDocumentData(portal, demo, unit, logger, contextId);
  const data = classData[contextId];
  if (!data) {
    logger.info(`No documents found for ${unit} ${contextId}; writing empty placeholder class data doc`);
    await getClassDataDoc(portal, demo, unit, contextId).set({
      userCount: 0,
      documentCount: 0,
      teacherContent: "",
      studentContent: "",
      summary: null,
      summaryCreatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  await updateClassDataDoc(portal, demo, unit, contextId, data, logger);
}
```

At the top of [shared/update-class-data-docs.ts](../../../shared/update-class-data-docs.ts), add `FieldValue` to the existing firestore import. Replace:

```ts
import { getFirestore } from "firebase-admin/firestore";
```

with:

```ts
import { FieldValue, getFirestore } from "firebase-admin/firestore";
```

- [ ] **Step 3: Verify the empty-state guard passes the type checker**

Run from the repo root:

```bash
npm run check:types
```

Expected: exit 0. If `FieldValue` is not exported from `firebase-admin/firestore` in this version (it is, per existing usage of `getFirestore` — but confirm if unsure), fall back to `admin.firestore.FieldValue.serverTimestamp()` by adding `import * as admin from "firebase-admin";` and using `admin.firestore.FieldValue.serverTimestamp()` at the call site.

- [ ] **Step 4: Run the existing bulk test to confirm no regression**

Start the functions-v2 emulators in a separate terminal first:

```bash
cd functions-v2 && npm run test:emulator
```

Then, in the repo root:

```bash
cd functions-v2 && npx jest test/update-class-data-docs.test.ts --runInBand
```

Expected: both existing tests (`runs without error on empty database`, `creates and updates class data doc`) pass. The empty-database test is particularly relevant — it already covers the bulk path, and adding the guard in the *single*-class path should not affect it.

- [ ] **Step 5: Verify the client renders the empty state when `teacherContent` / `studentContent` are empty strings**

Open [src/components/navigation/ai-summary.tsx:119-125](../../../src/components/navigation/ai-summary.tsx#L119-L125):

```tsx
<Markdown>{summaryData.teacherSummary ?? "No teacher summary available"}</Markdown>
...
<Markdown>{summaryData.studentSummary ?? "No student summary available" }</Markdown>
```

Note: the placeholder doc writes `teacherContent: ""` / `studentContent: ""`, but the client reads `result.studentSummary` / `result.teacherSummary` from the snapshot (not `studentContent` / `teacherContent`). Those fields are populated downstream by the summarizer (`on-class-data-doc-written`), not by this function. So the placeholder writes content strings but not summary strings — meaning `summaryData.teacherSummary` will be `undefined` and the `??` fallback will render. No client change is required.

Document this finding as a one-line comment in `updateSingleClassDataDoc` above the guard, replacing the `logger.info(...)` call with:

```ts
    // Empty-class guard: write an empty placeholder so the client shows
    // "No teacher/student summary available" instead of spinning on
    // "Generating summary...". teacherSummary/studentSummary stay undefined;
    // the client's ?? fallback handles rendering.
    logger.info(`No documents found for ${unit} ${contextId}; writing empty placeholder class data doc`);
```

- [ ] **Step 6: Commit**

```bash
git add shared/update-class-data-docs.ts
git commit -m "$(cat <<'EOF'
CLUE-504: guard zero-document case in updateSingleClassDataDoc

Classes that legitimately have no documents for a unit were crashing in
updateClassDataDoc on data.documents. Write an empty placeholder doc so
the client renders its "No ... summary available" empty-state instead of
hanging on "Generating summary..."

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Emulator Regression Tests for `generateClassData_v2`

**Files:**
- Modify: [functions-v2/test/test-utils.ts](../../../functions-v2/test/test-utils.ts)
- Create: `functions-v2/test/generate-class-data-emulator.test.ts`

**Context:** The authed-realm routing bug shipped uncaught because the only existing test file covers the scheduled bulk path in the demo realm. We need an emulator test that invokes the callable with `context.appMode === "authed"` and a stray `context.demoName`, and asserts the output lands in `authed/<portal>/aicontent/...`, not `demo/<demoName>/aicontent/...`. The test will also cover the empty-class placeholder from Task 2 and the demo path (regression-smoke for the happy case that already worked).

Follow the pattern of [functions-v2/test/update-class-data-docs.test.ts](../../../functions-v2/test/update-class-data-docs.test.ts) (emulator) combined with [functions-v2/test/post-document-comment-emulator.test.ts](../../../functions-v2/test/post-document-comment-emulator.test.ts) (callable invocation with `fft.wrap`).

- [ ] **Step 1: Extend `setupTestDocuments` in `functions-v2/test/test-utils.ts` to support an authed realm**

The existing helper hardcodes `demo/AITEST/...` paths. Generalize it so a caller can pick an authed realm by passing `portal`. `portal` and `demo` are mutually exclusive; if `portal` is provided, paths use `authed/<canonical-portal>/...` + `/authed/portals/<canonical-portal>/classes/...`.

Exact edit in [functions-v2/test/test-utils.ts:221-269](../../../functions-v2/test/test-utils.ts#L221-L269). Replace:

```ts
export const setupTestDocuments = async (options: {
  demo?: string;
  unit?: string;
  documentId?: string;
  classId?: string;
  uid?: string;
  lastEditedAt?: number;
}) => {
  const {
    demo = "AITEST",
    unit = "qa-config-subtabs",
    documentId = kDocumentKey,
    classId = kClassHash,
    uid = kUserId,
    lastEditedAt = new Date().getDate(),
  } = options;

  // Set up Firestore document metadata
  const firestoreMetadataPath = `demo/${demo}/documents/${documentId}`;
  await getFirestore().doc(firestoreMetadataPath).set({
    unit,
    context_id: classId,
    uid,
    key: documentId,
  });

  // Set up Firebase Realtime Database document metadata
  const firebaseMetadataPath =
    `/demo/${demo}/portals/demo/classes/${classId}/users/${uid}/documentMetadata/${documentId}`;
  await getDatabase().ref(firebaseMetadataPath).set({
    lastEditedAt,
  });

  const firebaseDocPath =
    `/demo/${demo}/portals/demo/classes/${classId}/users/${uid}/documents/${documentId}`;
  await getDatabase().ref(firebaseDocPath).set({
    content: JSON.stringify(specDocumentContent()),
  });

  return {
    demo,
    unit,
    documentId,
    classId,
    uid,
    studentDocMetadataPath: firestoreMetadataPath,
    studentDocPath: firebaseMetadataPath,
  };
};
```

with:

```ts
export const setupTestDocuments = async (options: {
  demo?: string;
  portal?: string;
  unit?: string;
  documentId?: string;
  classId?: string;
  uid?: string;
  lastEditedAt?: number;
}) => {
  const {
    portal,
    unit = "qa-config-subtabs",
    documentId = kDocumentKey,
    classId = kClassHash,
    uid = kUserId,
    lastEditedAt = new Date().getDate(),
  } = options;
  // Demo realm is the default; callers opt into authed by passing `portal`.
  const demo = portal ? undefined : options.demo ?? "AITEST";
  const canonicalPortal = portal ? portal.replace(/\./g, "_") : undefined;
  const firestoreBase = portal ? `authed/${canonicalPortal}` : `demo/${demo}`;
  const firebaseBase = portal
    ? `/authed/portals/${canonicalPortal}`
    : `/demo/${demo}/portals/demo`;

  // Set up Firestore document metadata
  const firestoreMetadataPath = `${firestoreBase}/documents/${documentId}`;
  await getFirestore().doc(firestoreMetadataPath).set({
    unit,
    context_id: classId,
    uid,
    key: documentId,
  });

  // Set up Firebase Realtime Database document metadata
  const firebaseMetadataPath =
    `${firebaseBase}/classes/${classId}/users/${uid}/documentMetadata/${documentId}`;
  await getDatabase().ref(firebaseMetadataPath).set({
    lastEditedAt,
  });

  const firebaseDocPath =
    `${firebaseBase}/classes/${classId}/users/${uid}/documents/${documentId}`;
  await getDatabase().ref(firebaseDocPath).set({
    content: JSON.stringify(specDocumentContent()),
  });

  return {
    demo,
    portal,
    unit,
    documentId,
    classId,
    uid,
    studentDocMetadataPath: firestoreMetadataPath,
    studentDocPath: firebaseMetadataPath,
  };
};
```

Verify the existing `update-class-data-docs.test.ts` still uses the default `demo` realm (it does — it calls `setupTestDocuments({documentId: ...})` with no `portal`, so the branch above keeps `demo = "AITEST"`).

- [ ] **Step 2: Type-check the shared util change**

```bash
cd functions-v2 && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Create `functions-v2/test/generate-class-data-emulator.test.ts` with three tests**

The test file mirrors the shape of [update-class-data-docs.test.ts](../../../functions-v2/test/update-class-data-docs.test.ts) but invokes the callable via `fft.wrap(generateClassData)` and passes an explicit `auth` context. The three tests: (1) authed routing with stray demoName does not leak into demo paths, (2) empty class writes a placeholder, (3) demo path still works.

Write the full file:

```ts
import * as admin from "firebase-admin";
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {getDatabase} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {initialize, projectConfig} from "./initialize";
import {generateClassData} from "../src/generate-class-data";
import {
  authWithNoClaims,
  authWithTeacherClaims,
  kCanonicalPortal,
  kClassHash,
  kDemoName,
  kPortal,
  setupTestDocuments,
  specUserContext,
} from "./test-utils";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

describe("generateClassData", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref().set(null);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanup();
  });

  test("warm-up returns version", async () => {
    const wrapped = fft.wrap(generateClassData);
    const result = await wrapped({data: {warmUp: true}} as any);
    expect(result).toEqual({version: "1.0.1"});
  });

  test("writes aicontent into authed realm when context has a stray demoName", async () => {
    // Set up documents in the authed realm only. No data in demo/<demoName>/...
    await setupTestDocuments({portal: kPortal, documentId: "auth-doc-1"});
    await setupTestDocuments({portal: kPortal, documentId: "auth-doc-2", uid: "other-user"});

    const wrapped = fft.wrap(generateClassData);
    await wrapped({
      data: {
        // authed mode + stray demoName simulates a client that visited a demo
        // URL (which sets clue-demo-name in localStorage) and then logged in
        // through the portal.
        context: specUserContext({
          appMode: "authed",
          portal: kPortal,
          demoName: "ScottGroupDocTests",
        }),
        unit: "qa-config-subtabs",
      },
      auth: authWithTeacherClaims,
    } as any);

    // Aicontent landed in the authed realm — the fix under test.
    const authedDataDocPath =
      `authed/${kCanonicalPortal}/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const authedDoc = await getFirestore().doc(authedDataDocPath).get();
    expect(authedDoc.exists).toBe(true);
    expect(authedDoc.data()).toMatchObject({
      userCount: 2,
      documentCount: 2,
    });

    // And nothing leaked into the stray demo realm.
    const demoDataDocPath =
      "demo/ScottGroupDocTests/aicontent/qa-config-subtabs/classes/" + kClassHash;
    const demoDoc = await getFirestore().doc(demoDataDocPath).get();
    expect(demoDoc.exists).toBe(false);
  });

  test("writes placeholder class data doc when authed class has zero documents", async () => {
    const wrapped = fft.wrap(generateClassData);
    await wrapped({
      data: {
        context: specUserContext({appMode: "authed", portal: kPortal}),
        unit: "qa-config-subtabs",
      },
      auth: authWithTeacherClaims,
    } as any);

    const dataDocPath =
      `authed/${kCanonicalPortal}/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const classDataDoc = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc.exists).toBe(true);
    expect(classDataDoc.data()).toEqual({
      userCount: 0,
      documentCount: 0,
      teacherContent: "",
      studentContent: "",
      summary: null,
      summaryCreatedAt: expect.anything(),
    });
  });

  test("writes aicontent into demo realm for demo-mode callers", async () => {
    await setupTestDocuments({demo: kDemoName, documentId: "demo-doc-1"});
    await setupTestDocuments({demo: kDemoName, documentId: "demo-doc-2", uid: "other-user"});

    const wrapped = fft.wrap(generateClassData);
    await wrapped({
      data: {
        context: specUserContext({appMode: "demo", demoName: kDemoName}),
        unit: "qa-config-subtabs",
      },
      auth: authWithNoClaims,
    } as any);

    const dataDocPath =
      `demo/${kDemoName}/aicontent/qa-config-subtabs/classes/${kClassHash}`;
    const classDataDoc = await getFirestore().doc(dataDocPath).get();
    expect(classDataDoc.exists).toBe(true);
    expect(classDataDoc.data()).toMatchObject({
      userCount: 2,
      documentCount: 2,
    });
  });
});
```

Note: `kPortal` is `"test.portal"` (from test-utils), and `kCanonicalPortal` is `"test_portal"`. `authWithTeacherClaims` has matching `platform_id: "https://test.portal"` and `class_hash: kClassHash`, so `validateUserContext` returns `isValid: true` for an authed context with `portal: kPortal` and `classHash: kClassHash`.

- [ ] **Step 4: Ensure the firestore emulator is running, then run the new test**

In a separate terminal:

```bash
cd functions-v2 && npm run test:emulator
```

Then, from the repo root:

```bash
cd functions-v2 && npx jest test/generate-class-data-emulator.test.ts --runInBand
```

Expected: four tests pass (warm-up, authed with stray demoName, empty-class placeholder, demo). If the authed-realm test fails because `validateUserContext` reports invalid, re-inspect: `kClaimPortal` is `"https://test.portal"` and `specAuth`'s token uses `platform_id: overrides.token.platform_id || kPortal` — meaning the default `authWithTeacherClaims` sets `platform_id: "test.portal"` (no protocol), which `canonicalizePortal` normalizes to `"test_portal"`, matching `canonicalizePortal(kPortal)` `"test_portal"`. If `platform_id` in `authWithTeacherClaims` resolves to `kClaimPortal` instead (check with a console.log), adjust `specUserContext` to pass `portal: kClaimPortal`, which canonicalizes identically. Do not skip this check.

- [ ] **Step 5: Run all functions-v2 tests to confirm no regression**

```bash
cd functions-v2 && npx jest --runInBand
```

Expected: every test in the `functions-v2/test/` directory passes, including the existing `update-class-data-docs.test.ts` (which relies on the default-demo branch of the generalized `setupTestDocuments`).

- [ ] **Step 6: Lint**

```bash
cd functions-v2 && npm run lint
```

Expected: exit 0. Fix any style issues (unused imports, semicolons, trailing whitespace) reported.

- [ ] **Step 7: Commit**

```bash
git add functions-v2/test/test-utils.ts functions-v2/test/generate-class-data-emulator.test.ts
git commit -m "$(cat <<'EOF'
CLUE-504: emulator regression tests for generateClassData

The routing-into-wrong-realm bug shipped uncaught because no test covered
the callable. Add emulator tests that:

- assert an authed-mode context with a stray demoName writes aicontent
  into authed/<portal>/... (the fix under test)
- assert nothing leaks into demo/<demoName>/...
- cover the zero-documents placeholder path added alongside
- smoke-test the demo path to guard against regression

Generalize setupTestDocuments to accept a portal for authed paths while
keeping demo as the default for existing callers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update Spec Document

**Files:**
- Modify: [docs/specs/portal-authenticated-class-summaries.md:5-9](../../specs/portal-authenticated-class-summaries.md#L5-L9) and the "Remaining Work" section.

**Context:** The spec's status line still says "repo sync + follow-ups in progress" and all four items are still listed as remaining. After Tasks 1–3 land, update status and mark completed items with a checked-off note pointing to the commit SHAs.

- [ ] **Step 1: Update the status line**

Exact edit — replace:

```
Status: *Hot fix deployed to production on 2026-04-18; repo sync + follow-ups in progress*
```

with:

```
Status: *Hot fix deployed to production on 2026-04-18; repo sync (a6aeab287) and follow-ups complete*
```

- [ ] **Step 2: Mark completed items in the "Remaining Work" section**

After the items are implemented, replace each item's heading with the item followed by `(completed)` and add a one-line pointer noting the commit. For example, replace:

```
### 1. Commit the Firestore rule (this PR)
```

with:

```
### 1. Commit the Firestore rule (completed: a6aeab287)
```

Apply the same pattern to items 2, 3, and 4, using the commit SHAs produced by Tasks 1–3. (Run `git log --oneline -5` to pick up the SHAs.)

- [ ] **Step 3: Commit**

```bash
git add docs/specs/portal-authenticated-class-summaries.md
git commit -m "$(cat <<'EOF'
CLUE-504: mark portal-authenticated class summary follow-ups complete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage**: Item 1 (firestore.rules) — shipped in `a6aeab287`, referenced by Task 4. Item 2 (regression tests) — Task 3. Item 3 (empty-query guard) — Task 2. Item 4 (dead client fields) — Task 1. All four items covered.
- **Acceptance criteria**:
  - `firestore.rules` reconciled — done in hot fix.
  - Automated test covers authed path with stray demoName — Task 3 Step 3, test "writes aicontent into authed realm when context has a stray demoName".
  - Zero-documents class produces placeholder + clear empty-state — Task 2 (placeholder) + Task 2 Step 5 (documents that the existing `??` fallback handles rendering).
  - `ai-summary.tsx` no longer sends dead fields — Task 1 Step 2.
  - User sees either summary or clear empty state, never "Error loading…" or infinite spinner — guaranteed by Tasks 1 + 2 + the hot-fixed rule.
- **Type consistency**: `updateSingleClassDataDoc` signature unchanged (keeps existing `portal|undefined, demo|undefined` since the scheduled bulk path still calls it). `IGenerateAiSummaryParams` shrinks; `generate-class-data.ts` already destructures only `context` and `unit` so nothing on the server side needs to change. Client drops matching fields.
