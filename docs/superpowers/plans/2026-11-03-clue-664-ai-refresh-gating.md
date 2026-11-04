# CLUE-664 AI Refresh Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop paying for AI evaluations of documents that have not changed since the last one, and tell a student who asks again about unchanged work to change something first.

**Architecture:** A document's Firestore history entries carry a monotonic `index`. The server records the index it last evaluated a document at, in a Realtime Database node beside the evaluation metadata; the Ideas button and the AI tile compare against it and skip. No hashing and no summarizer run.

**Tech Stack:** TypeScript, React, MobX State Tree, Firebase Realtime Database + Firestore, Jest, Cypress, Firebase Functions v2.

**Design:** `docs/superpowers/specs/2026-11-03-clue-664-ai-refresh-gating-design.md`

---

## Background an engineer new to this code needs

**Two databases.** Document *content* and *history* live in Firestore. Document *metadata* —
including the evaluation trigger — lives in the Realtime Database. This story touches both.

**The evaluation is queued, not performed, at the trigger.** `on-analyzable-doc-written` fires on a
Realtime Database write and writes an `AnalysisQueueDocument` to Firestore. Two functions later,
`on-analysis-document-imaged` writes the AI's comment. "After a successful evaluation" means there,
not at the trigger.

**Never store the gate under the trigger path.** `on-analyzable-doc-written` triggers on writes to
`.../documentMetadata/{docId}/evaluation/{evaluator}`. Writing the gate there would re-trigger the
function on its own write — an evaluation loop costing exactly the money this story saves. The gate
is a *sibling* node, `evaluationGate`.

**Requested vs unrequested.** `setLastEditedNow` writes the evaluation node from two places: the
Ideas button, passing a `requestId`, and `use-document-sync-to-firebase` on unmount, passing none.
The server may only skip when there is **no** `requestId` — skipping a requested evaluation would
leave the Ideas client waiting for a comment that never arrives, and it would eventually show its
failure message.

**Absent gate means evaluate.** A document with no gate recorded has never been evaluated. If
absent read as "unchanged", it would never get a first evaluation.

**Mutation-test every new assertion.** Revert the behavior, confirm the test fails, restore. A
previous story in this codebase produced four tests that passed with and without the fix.

## File structure

| File | Responsibility | Change |
|---|---|---|
| `shared/ai-evaluation-gate.ts` | the comparison and the node name, used by both ends | **Create** |
| `shared/ai-evaluation-gate.test.ts` | its tests | **Create** |
| `src/models/document/ai-evaluation-messages.ts` | student-facing strings | Modify |
| `src/lib/firebase.ts` | gate path + read, beside the existing evaluation path helpers | Modify |
| `src/components/document/document.tsx` | Ideas button guard | Modify |
| `src/plugins/ai/ai-content.ts` | AI tile's own gate property | Modify |
| `src/plugins/ai/ai-tile.tsx` | AI tile guard | Modify |
| `functions-v2/src/on-analyzable-doc-written.ts` | capture the index; skip unrequested + unchanged | Modify |
| `functions-v2/src/on-analysis-document-imaged.ts` | advance the gate on success | Modify |
| `docs/unit-configuration.md` | document the new behavior of `aiEvaluateOnSessionEnd` | Modify |

---

## Task 1: The shared comparison

**Files:**
- Create: `shared/ai-evaluation-gate.ts`
- Create: `shared/ai-evaluation-gate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `shared/ai-evaluation-gate.test.ts`:

```ts
import { hasChangedSinceEvaluation, kEvaluationGateKey } from "./ai-evaluation-gate";

describe("hasChangedSinceEvaluation", () => {
  it("is changed when the index has moved", () => {
    expect(hasChangedSinceEvaluation(52, 47)).toBe(true);
  });

  it("is unchanged when the index matches", () => {
    expect(hasChangedSinceEvaluation(47, 47)).toBe(false);
  });

  // Absent must never read as unchanged, or a document would never get its first evaluation.
  it("is changed when nothing has been evaluated yet", () => {
    expect(hasChangedSinceEvaluation(47, undefined)).toBe(true);
  });

  // A document with no history to read is not evidence that nothing changed.
  it("is changed when the latest index cannot be read", () => {
    expect(hasChangedSinceEvaluation(undefined, 47)).toBe(true);
  });

  // The only case the explicit guard covers: everything else falls out of the comparison.
  it("is changed when neither index is known", () => {
    expect(hasChangedSinceEvaluation(undefined, undefined)).toBe(true);
  });
});

describe("kEvaluationGateKey", () => {
  // The function triggers on writes under `evaluation`; a gate stored there would re-trigger it.
  it("is not the evaluation node", () => {
    expect(kEvaluationGateKey).not.toBe("evaluation");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest shared/ai-evaluation-gate.test.ts
```

Expected: FAIL — cannot resolve `./ai-evaluation-gate`.

- [ ] **Step 3: Write the module**

Create `shared/ai-evaluation-gate.ts`:

```ts
/**
 * The Realtime Database node, a sibling of `evaluation`, where the server records the history
 * index it last evaluated a document at.
 *
 * Deliberately NOT under `evaluation`: on-analyzable-doc-written triggers on writes there, so a
 * gate stored under it would re-trigger the function on its own write -- an evaluation loop
 * costing exactly what this gate saves.
 */
export const kEvaluationGateKey = "evaluationGate";

/**
 * Whether a document has changed since the evaluation its gate records.
 *
 * Either value being absent reads as changed. A missing gate means nothing has been evaluated yet,
 * and a missing latest index means the history could not be read -- neither is evidence that the
 * document is unchanged.
 */
export function hasChangedSinceEvaluation(
  latestIndex: number | undefined, gateIndex: number | undefined
): boolean {
  // A number is never equal to undefined, so an unrecorded gate already reads as changed through
  // the comparison below. This guard is for the case where neither index is known, which must not
  // read as unchanged -- that would withhold evaluations from a document we know nothing about.
  if (latestIndex === undefined) return true;
  return latestIndex !== gateIndex;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest shared/ai-evaluation-gate.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Mutation-test**

Delete the line `if (latestIndex === undefined) return true;` and rerun. Expected: "is changed when
neither index is known" FAILS — every other case falls out of the comparison, which is why the
guard is one line rather than two. Restore and confirm all six pass. **Report the verbatim
output**; if it does not fail, say so rather than claiming a kill.

- [ ] **Step 6: Commit**

```bash
git add shared/ai-evaluation-gate.ts shared/ai-evaluation-gate.test.ts
git commit -m "CLUE-664: add the shared evaluation-gate comparison"
```

---

## Task 2: The gate path and read on the client

**Files:**
- Modify: `src/lib/firebase.ts` (beside `getEvaluationMetadataPath`, around line 203)

- [ ] **Step 1: Add the path helper and the read**

Add after `getEvaluationStatusPath`:

```ts
  /**
   * Where the server records the history index it last evaluated this document at. A sibling of
   * the `evaluation` node rather than a child, so writing it cannot re-trigger the evaluation
   * function -- see kEvaluationGateKey.
   */
  public getEvaluationGatePath(user: UserModelType, documentKey: string, userId?: string) {
    const evaluation = this.db.stores.appConfig.aiEvaluation;
    if (!evaluation) return undefined;
    const metadataPath = this.getUserDocumentMetadataPath(user, documentKey, userId);
    return `${metadataPath}/${kEvaluationGateKey}/${evaluation}`;
  }

  /** The recorded index, or undefined when the document has never been evaluated. */
  public async getEvaluationGateIndex(user: UserModelType, documentKey: string, userId?: string) {
    const path = this.getEvaluationGatePath(user, documentKey, userId);
    if (!path) return undefined;
    const snapshot = await this.ref(path).once("value");
    const value = snapshot.val();
    return typeof value === "number" ? value : undefined;
  }
```

Add the import at the top of the file:

```ts
import { kEvaluationGateKey } from "../../shared/ai-evaluation-gate";
```

- [ ] **Step 2: Verify types**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase.ts
git commit -m "CLUE-664: read the evaluation gate from the client"
```

---

## Task 3: The student-facing messages

**Files:**
- Modify: `src/models/document/ai-evaluation-messages.ts`

- [ ] **Step 1: Add the two strings**

Append to that file:

```ts
export const IDEAS_UNCHANGED_MESSAGE = "Try adding or changing something, then ask again";
export const AI_TILE_UNCHANGED_MESSAGE = "Try adding or changing something to get new tips";
```

- [ ] **Step 2: Commit**

```bash
git add src/models/document/ai-evaluation-messages.ts
git commit -m "CLUE-664: add the unchanged-document messages"
```

---

## Task 4: Gate the Ideas button

**Files:**
- Modify: `src/components/document/document.tsx` (`handleIdeasButtonClick`, around line 561)
- Test: `src/components/document/document.test.tsx`

### Why the ordering changes

The handler currently mints a `requestId` and calls `setLatestIdeasRequestId` before any `await`.
The gate check needs two reads, so it must happen **before** the id is minted — otherwise a click
that turns out to be gated has already registered an id that a later status could match. The
existing comment "Must be recorded before any await below" stays true: it refers to awaits after
that call, and the new awaits are before it.

- [ ] **Step 1: Write the failing test**

`src/components/document/document.test.tsx` already covers this handler and renders through
`renderDocument(document, stores)`. Follow that setup; `renderDocumentWithIdeas` and
`clickIdeasButton` below stand in for the file's own idioms, not functions to create. The reads to
stub are `firebase.getEvaluationGateIndex` and `getLastHistoryEntry`.

Add:

```tsx
it("nudges instead of requesting when the document has not changed", async () => {
  const { firebase, commentsManager } = renderDocumentWithIdeas();   // the file's existing helper
  firebase.getEvaluationGateIndex.mockResolvedValue(47);
  mockGetLastHistoryEntry.mockResolvedValue({ index: 47, id: "entry-47" });

  await clickIdeasButton();

  expect(commentsManager.showStatusMessage).toHaveBeenCalledWith(IDEAS_UNCHANGED_MESSAGE);
  expect(firebase.setLastEditedNow).not.toHaveBeenCalled();
});

it("requests when the document has changed since the last evaluation", async () => {
  const { firebase } = renderDocumentWithIdeas();
  firebase.getEvaluationGateIndex.mockResolvedValue(47);
  mockGetLastHistoryEntry.mockResolvedValue({ index: 52, id: "entry-52" });

  await clickIdeasButton();

  expect(firebase.setLastEditedNow).toHaveBeenCalled();
});
```

Keep the assertions; adapt the setup to the file's existing helpers rather than renaming them.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx jest src/components/document/document.test.tsx -t "has not changed"
```

Expected: FAIL — the request is made anyway.

- [ ] **Step 3: Add the guard**

In `handleIdeasButtonClick`, replace the block from `const isEmpty = ...` through the
`if (skipEmptyDocument)` early return with:

```ts
    const isEmpty = !document.content || !documentHasStudentWork(getSnapshot(document.content));
    const skipEmptyDocument = isEmpty && aiEnabled;

    // Before any request id is minted: a click that turns out to be gated must not leave an id
    // registered that a later status could match.
    let isUnchanged = false;
    if (aiEnabled && !isEmpty) {
      const [gateIndex, lastEntry] = await Promise.all([
        firebase.getEvaluationGateIndex(user, document.key, document.uid),
        getLastHistoryEntry(this.stores.db.firestore, getSimpleDocumentPath(document.key))
      ]);
      isUnchanged = !hasChangedSinceEvaluation(lastEntry?.index, gateIndex);
    }

    const requestId = (!isEmpty && !isUnchanged && aiEnabled) ? nanoid() : null;
    // Must be recorded before any await below, so a status for this click can never find a stale id.
    commentsManager.setLatestIdeasRequestId(requestId);

    // Unselect all tiles, so that the whole-document comments are shown
    ui.clearSelectedTiles();
    persistentUI.openResourceDocument(document, appConfig, user, this.stores.sortedDocuments);
    persistentUI.toggleShowChatPanel(true);

    if (skipEmptyDocument) {
      commentsManager.showStatusMessage(IDEAS_EMPTY_MESSAGE);
      return;
    }

    // The empty check runs first, so an empty document is told it is empty rather than unchanged.
    if (isUnchanged) {
      commentsManager.showStatusMessage(IDEAS_UNCHANGED_MESSAGE);
      return;
    }
```

Add the imports:

```ts
import { getLastHistoryEntry } from "../../models/history/history-firestore";
import { getSimpleDocumentPath } from "../../../shared/shared";
import { hasChangedSinceEvaluation } from "../../../shared/ai-evaluation-gate";
import { IDEAS_UNCHANGED_MESSAGE } from "../../models/document/ai-evaluation-messages";
```

`getSimpleDocumentPath(document.key)` is what `history-firestore` itself uses: it returns a path
relative to the Firestore root, which is what the client wrapper expects.

- [ ] **Step 4: Run the tests**

```bash
npx jest src/components/document/document.test.tsx
npx tsc --noEmit -p tsconfig.json
```

Expected: PASS, no type errors. The file's existing Ideas tests must still pass — if one now fails
because it did not stub the new reads, add the stub rather than weakening the assertion.

- [ ] **Step 5: Mutation-test**

Change `isUnchanged = !hasChangedSinceEvaluation(...)` to `isUnchanged = false` and rerun.
Expected: "nudges instead of requesting" FAILS. Report the verbatim output, then restore.

- [ ] **Step 6: Commit**

```bash
git add src/components/document/document.tsx src/components/document/document.test.tsx
git commit -m "CLUE-664: nudge instead of requesting Ideas for unchanged work"
```

---

## Task 5: Gate the AI tile

> **Learn from Task 4 before starting.** Inserting the gate's awaits ahead of the handler's
> in-progress flag let two rapid clicks both through, double-billing an evaluation — the exact
> thing this story exists to prevent. A pre-existing test caught it. Check how this surface dedups
> overlapping refreshes (`requestGenerationRef` / `isCurrent()` in `ai-tile.tsx`) and make sure the
> new `await` cannot slip past it. Also wrap the gate reads in a try/catch that fails *open*:
> `getLastHistoryEntry` throws by design on a malformed index, and an unhandled throw here would
> leave the tile stuck.

**Files:**
- Modify: `src/plugins/ai/ai-content.ts`
- Modify: `src/plugins/ai/ai-tile.tsx`
- Test: `src/plugins/ai/ai-tile.test.tsx`

- [ ] **Step 1: Add the property and its setter**

In `src/plugins/ai/ai-content.ts`, add to `.props({...})` beside `refreshCount`:

```ts
    /**
     * The document history index this tile's text was generated from. Its own property rather than
     * the shared evaluationGate node: the AI tile does not go through the comments evaluation at
     * all, and two AI tiles in one document gate independently, as their separate prompts imply.
     */
    evaluatedHistoryIndex: types.maybe(types.number)
```

and an action in the same model:

```ts
    setEvaluatedHistoryIndex(index: number | undefined) {
      self.evaluatedHistoryIndex = index;
    },
```

- [ ] **Step 2: Write the failing test**

Add to `src/plugins/ai/ai-tile.test.tsx`, following that file's existing render setup —
`renderAiTile` below stands in for it, not a function to create:

```tsx
it("shows a nudge and makes no request when the document has not changed", async () => {
  const { content, getAiContent } = renderAiTile();      // the file's existing helper
  content.setEvaluatedHistoryIndex(47);
  mockGetLastHistoryEntry.mockResolvedValue({ index: 47, id: "entry-47" });

  await waitFor(() => expect(content.text).toBe(AI_TILE_UNCHANGED_MESSAGE));
  expect(getAiContent).not.toHaveBeenCalled();
});

it("records the index it evaluated at after a successful refresh", async () => {
  const { content } = renderAiTile();
  mockGetLastHistoryEntry.mockResolvedValue({ index: 52, id: "entry-52" });

  await waitFor(() => expect(content.evaluatedHistoryIndex).toBe(52));
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
npx jest src/plugins/ai/ai-tile.test.tsx -t "has not changed"
```

Expected: FAIL — the request is made anyway.

- [ ] **Step 4: Add the guard**

In `src/plugins/ai/ai-tile.tsx`, inside `queryAI`, directly after the existing empty-document guard
(`if (!documentHasStudentWork(...)) { content.setText(AI_TILE_EMPTY_MESSAGE); return; }`):

```ts
          const lastEntry = await getLastHistoryEntry(firestore, getSimpleDocumentPath(documentId));
          if (!isCurrent()) return;
          if (!hasChangedSinceEvaluation(lastEntry?.index, content.evaluatedHistoryIndex)) {
            content.setText(AI_TILE_UNCHANGED_MESSAGE);
            return;
          }
```

and after the refresh succeeds — at the same place the component already writes the new text —
record what it evaluated:

```ts
          content.setEvaluatedHistoryIndex(lastEntry?.index);
```

`isCurrent()` already exists in that effect and guards against a superseded run; the new `await`
needs the same check after it, exactly as the existing awaits do.

`firestore` comes from the stores; use the same accessor the rest of the file uses for store
values, and add it to the effect's dependency array.

- [ ] **Step 5: Run the tests**

```bash
npx jest src/plugins/ai/
npx tsc --noEmit -p tsconfig.json
```

Expected: PASS, no type errors.

- [ ] **Step 6: Mutation-test**

Delete the `content.setEvaluatedHistoryIndex(lastEntry?.index);` line and rerun. Expected: "records
the index it evaluated at" FAILS. Restore. Then change the guard's condition to `if (false)` and
rerun: "shows a nudge" FAILS. Restore. Report both verbatim.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/ai/
git commit -m "CLUE-664: gate the AI tile on the document having changed"
```

---

## Task 6: Skip unrequested server evaluations

**Files:**
- Modify: `functions-v2/src/on-analyzable-doc-written.ts` (`handleUpdate`, around line 117)
- Test: `functions-v2/test/on-analyzable-doc-written.test.ts` (exists)

- [ ] **Step 1: Write the failing tests**

```ts
describe("handleUpdate gating", () => {
  it("does not enqueue an unrequested evaluation of an unchanged document", async () => {
    setGate(47);                      // .../documentMetadata/doc1/evaluationGate/custom
    setLastHistoryIndex(47);
    await writeEvaluation({ requestId: undefined });
    expect(await queueDocExists("doc1")).toBe(false);
  });

  it("enqueues an unrequested evaluation when the document has changed", async () => {
    setGate(47);
    setLastHistoryIndex(52);
    await writeEvaluation({ requestId: undefined });
    expect(await queueDocExists("doc1")).toBe(true);
  });

  // Skipping a requested evaluation would leave the Ideas client waiting for a comment that never
  // arrives, and it would eventually show its failure message.
  it("always enqueues a requested evaluation, even when unchanged", async () => {
    setGate(47);
    setLastHistoryIndex(47);
    await writeEvaluation({ requestId: "req-1" });
    expect(await queueDocExists("doc1")).toBe(true);
  });

  it("enqueues when the document has never been evaluated", async () => {
    setGate(undefined);
    setLastHistoryIndex(47);
    await writeEvaluation({ requestId: undefined });
    expect(await queueDocExists("doc1")).toBe(true);
  });
});
```

**Use the harness this file already has.** It calls `initialize()` from `./initialize`, wraps the
function with `fft.wrap(onAnalyzableTestDocWritten)`, builds the trigger with `makeDataSnapshot` and
`makeChange`, clears state with `clearFirestoreData(projectConfig)` and `getDatabase().ref("demo")`,
and reads results through `admin.firestore()`. The existing
`describe("on-analyzable-doc-written with a requestId")` block is the closest precedent — model the
requested/unrequested cases on it. `setGate`, `setLastHistoryIndex`, `writeEvaluation` and
`queueDocExists` above are placeholders for that file's own idioms, not functions to create.

- [ ] **Step 2: You cannot run them here — say so and move on**

**There is no Firebase emulator on this machine** (no `firebase` CLI, no Java), so
`npm test -- on-analyzable-doc-written` cannot run and neither can the usual red-green cycle or any
mutation test for this task.

CI runs these tests for real, via
`firebase emulators:exec --only firestore,database --project demo-test "npm test"` in
`.github/workflows/functions-v2.yml`, so they are genuine coverage — just not coverage you can
confirm before pushing. Write them carefully, state in your report that they are unverified, and do
not claim a red-green cycle you did not observe.

What you *can* check locally:

```bash
cd functions-v2 && npx tsc --noEmit -p tsconfig.json && npm run lint
```

- [ ] **Step 3: Add the gate check and capture the index**

In `handleUpdate`, after `const firestore = admin.firestore();`:

```ts
  // Only unrequested (session-end) evaluations are skipped. Skipping a requested one would leave
  // the Ideas client waiting for a comment that never arrives.
  const lastEntry = await getLastHistoryEntryAdmin(firestore, firestoreDocumentPath);
  if (!requestId) {
    const gateSnapshot = await admin.database()
      .ref(`${metadataPath}/${kEvaluationGateKey}/${evaluator}`).once("value");
    const gateValue = gateSnapshot.val();
    const gateIndex = typeof gateValue === "number" ? gateValue : undefined;
    if (!hasChangedSinceEvaluation(lastEntry?.index, gateIndex)) {
      logger.info(`Skipping unchanged document ${documentPath} for ${evaluator}`);
      return;
    }
  }
```

and carry the index on the queue document, so the gate records what was actually evaluated rather
than whatever the document looks like when the comment lands:

```ts
  const newDocument: AnalysisQueueDocument = {
    metadataPath,
    documentPath,
    commentsPath,
    docUpdated: timestamp,
    evaluator,
    firestoreDocumentPath,
    historyIndex: lastEntry?.index,
  };
```

Add `historyIndex?: number;` to the `AnalysisQueueDocument` interface in the same file, with:

```ts
  /** The document history index this evaluation was enqueued at; written to the gate on success. */
```

`getLastHistoryEntryAdmin` is a small admin-SDK equivalent of the client's `getLastHistoryEntry`.
Add it in this file:

```ts
/** The client's getLastHistoryEntry, against the admin SDK. The query is identical; the SDKs are
 *  not, which is why this is not shared. */
async function getLastHistoryEntryAdmin(firestore: admin.firestore.Firestore, documentPath: string) {
  const query = await firestore.collection(`${documentPath}/history`)
    .orderBy("index", "desc").limit(1).get();
  if (query.empty) return undefined;
  const index = query.docs[0].get("index");
  return typeof index === "number" ? { index, id: query.docs[0].id } : undefined;
}
```

Import the shared pieces:

```ts
import {hasChangedSinceEvaluation, kEvaluationGateKey} from "../../shared/ai-evaluation-gate";
```

- [ ] **Step 4: Verify what can be verified**

```bash
cd functions-v2 && npx tsc --noEmit -p tsconfig.json && npm run lint
```

Expected: no errors. The tests themselves run on CI, not here.

- [ ] **Step 5: Reason through the mutations instead of running them**

No emulator means no mutation testing for this task. Instead, state in your report what each test
would catch and why: which assertion fails if `if (!requestId)` becomes `if (true)`, and which
fails if the gate block is deleted. If you cannot name a failing assertion for either, the test is
not pinning the behavior and needs rewriting before it reaches CI.

- [ ] **Step 6: Commit**

```bash
git add functions-v2/src/on-analyzable-doc-written.ts functions-v2/test/
git commit -m "CLUE-664: skip unrequested evaluations of unchanged documents"
```

---

## Task 7: Advance the gate when the comment lands

**Files:**
- Modify: `functions-v2/src/on-analysis-document-imaged.ts` (around line 262, where `commentRef.set` runs)

- [ ] **Step 1: Write the failing test**

Add to `functions-v2/test/on-analysis-document-imaged.test.ts`, which exists and uses the same
`firebase-functions-test` harness as Task 6. The helper names below stand in for that file's own
idioms:

```ts
it("records the evaluated history index once the comment is written", async () => {
  await runImagedWith({ historyIndex: 52, metadataPath: "...doc1", evaluator: "custom" });
  expect(await readGate("doc1", "custom")).toBe(52);
});

// A failed evaluation must leave the gate where it was, so the next attempt is not blocked.
it("leaves the gate alone when the analysis fails", async () => {
  await setGate("doc1", "custom", 47);
  await runImagedFailing({ historyIndex: 52 });
  expect(await readGate("doc1", "custom")).toBe(47);
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd functions-v2 && npm test -- on-analysis-document-imaged
```

Expected: FAIL — no gate is written.

- [ ] **Step 3: Write the gate after the comment**

Immediately after the `await commentRef.set({...})` that writes the AI's comment:

```ts
      // Only now: the gate must advance on success alone, so a failed evaluation leaves it where
      // it was and the next attempt is not blocked.
      if (typeof queueDoc.historyIndex === "number") {
        await admin.database()
          .ref(`${queueDoc.metadataPath}/${kEvaluationGateKey}/${queueDoc.evaluator}`)
          .set(queueDoc.historyIndex);
      }
```

Import:

```ts
import {kEvaluationGateKey} from "../../shared/ai-evaluation-gate";
```

- [ ] **Step 4: Verify what can be verified**

```bash
cd functions-v2 && npx tsc --noEmit -p tsconfig.json && npm run lint
```

Expected: no errors. As in Task 6, the tests run on CI rather than here.

- [ ] **Step 5: Reason through the mutation instead of running it**

Name the assertion that fails if the gate write is moved ahead of `commentRef.set`, and say why. If
you cannot, the test is not pinning "advances on success alone".

- [ ] **Step 6: Commit**

```bash
git add functions-v2/src/on-analysis-document-imaged.ts functions-v2/test/
git commit -m "CLUE-664: advance the evaluation gate when the comment lands"
```

---

## Task 8: Document the behavior

**Files:**
- Modify: `docs/unit-configuration.md` (the `aiEvaluateOnSessionEnd` entry, around line 130)

- [ ] **Step 1: Extend the flag's description**

Append to that entry:

```
A session-end evaluation is skipped when the document has not changed since the last one was
evaluated, so a student who opens and closes a document without editing it costs nothing. An
evaluation the student asks for with the Ideas button always runs.
```

- [ ] **Step 2: Commit**

```bash
git add docs/unit-configuration.md
git commit -m "CLUE-664: document that unchanged documents are not re-evaluated"
```

---

## Task 9: Finish the branch

- [ ] **Step 1: Full verification**

```bash
npx tsc --noEmit -p tsconfig.json
npx jest
npm run lint:build
cd functions-v2 && npx tsc --noEmit -p tsconfig.json && npm run lint && cd ..
```

Expected: 0 errors throughout. `functions-v2`'s own tests cannot run here — CI runs them.

- [ ] **Step 2: Run the four lenses**

Use the `code-self-review` skill over `git diff master...HEAD`. Pay particular attention to Lens 4:
`shared/ai-evaluation-gate.ts` is a new file holding two small exports — judge whether the two
codebases needing the same definition justifies it, or whether it is test-driven surface.

- [ ] **Step 3: Check it by hand on localhost**

```bash
npm start > /tmp/clue-664-dev.log 2>&1 &
until grep -q "compiled successfully" /tmp/clue-664-dev.log; do sleep 3; done
```

In a unit with `aiEvaluation` set: press Ideas and let it complete; press Ideas again without
editing and confirm the nudge with no request; edit a tile and confirm Ideas requests again. Repeat
for an AI tile's Update button.

The server side cannot be checked this way. Its evidence arrives in two stages: the CI
functions-v2 job runs the emulator tests on push, and staging is where the behavior itself is
confirmed.

- [ ] **Step 4: Open the PR**

Do not push until the hand-check passes and the user has okayed it. Take the branch name from the
**Create branch** field on https://concord-consortium.atlassian.net/browse/CLUE-664 verbatim.

Tick **run regression** only if the user asks. Request a Copilot review on the first push.

---

## Risks

- **The server side has no localhost loop and no local emulator** (no `firebase` CLI, no Java).
  Tasks 6 and 7 ship tests that are unverified until CI runs them, and no mutation testing is
  possible for them here. Staging is where the behavior gets confirmed. Treat the CI functions-v2
  job on the first push as the real red-green moment.
- **Two awaits were added to the Ideas click.** They run before the request id is minted, so a
  double click during them is handled by the existing `canRequestIdeas` gate — verify that holds.
- **`getSimpleDocumentPath(documentKey)`** returns a path *relative* to the Firestore root
  (`documents/<escapedKey>`), which is what the client wrapper expects. The server builds its own
  absolute `${firestoreRoot}/documents/${docId}` instead. Verified; do not "fix" one to match the
  other.
