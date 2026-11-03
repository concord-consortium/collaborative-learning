# CLUE-664: AI Ideas/Tile only refresh with new data — design

**Status:** approved design, not yet planned
**Ticket:** https://concord-consortium.atlassian.net/browse/CLUE-664

## Goal

Stop paying for AI evaluations of documents that have not changed since the last one, and tell a
student who asks for a second opinion on unchanged work that they need to change something first.

## Scope

The ticket lists four surfaces. This story covers three:

| | Requirement | Where |
|---|---|---|
| 1 | Skip the session-end evaluation when the document is unchanged | `functions-v2/` |
| 2 | Ideas button: no request, nudge the student instead | `src/` |
| 3 | AI tile: no refresh when unchanged | `src/` |

**Requirement 4 (the class summary) is deferred to its own story.** It runs from a different
trigger, aggregates across documents rather than reading one, and needs a teacher-facing message
with no existing precedent to copy.

Requirement 1 needs **no new unit flag**. `aiEvaluateOnSessionEnd` already exists and is already
documented with this story's motivation — "unrequested evaluations cost real money"
(`docs/unit-configuration.md`). The session-end path only runs for units that set it; this adds
"and only when the document changed".

## The signal

A document's history entries carry a monotonic `index`. **Changed since the last evaluation = the
newest entry's index differs from the index recorded at that evaluation.**

No hashing and no summarizer run. `getLastHistoryEntry(firestore, documentPath)` in
`src/models/history/history-firestore.ts` already does the read: one indexed query against
`${documentPath}/history`, ordered by `index` descending, limited to one. `firestore-history-manager`
uses it today.

### Why not hash the summary

The alternative was hashing `documentSummarizer` output, as the chat tutor does via
`summarizeRight()` and `shared/hash-string.ts`. Rejected: it costs a summarizer run on the client
for every Ideas click, which that path does not do today, and the history index is both cheaper and
already persisted.

The cost is precision. A history entry is created by **any** document change, so moving a tile,
resizing one, or undoing will permit a call whose input the AI sees as identical. This story cuts
the obvious waste — asking twice in a row — not all of it. That direction is deliberate: erring
toward spending a call beats blocking a student who did real work.

Two consequences worth knowing:

- **Background entries are not implemented.** `asBackground` exists only as a draft design
  (CLUE-515), so every dataflow tick during a recording creates an ordinary entry. Harmless here —
  a recording genuinely does add data — but it means the index moves quickly for those documents.
- **An undo advances the index.** Undoing back to the exact content that was last evaluated still
  reads as changed. Accepted, for the same reason as above.

## Architecture

### The server owns the gate

`on-analyzable-doc-written.ts` records the history index it evaluated at, **after** a successful
evaluation. The clients only read it.

This matters: if a client wrote the gate when it *started* a request, a failed or timed-out
evaluation would leave the gate advanced and the next attempt wrongly blocked. With the server as
the single writer, a failure simply leaves the gate where it was.

The server already has everything it needs. The handler computes
`firestoreDocumentPath = ${firestoreRoot}/documents/${docId}`, and history lives at
`${firestoreDocumentPath}/history` — the same collection, field and ordering the client queries.

### The gate goes beside the evaluation node, not under it

`on-analyzable-doc-written` triggers on writes to:

```
{realm}/{realmId}/portals/{portalId}/classes/{classId}/users/{userId}/documentMetadata/{docId}/evaluation/{evaluator}
```

Storing the index under that path would re-trigger the function on its own write — an evaluation
loop costing exactly the money this story saves. The gate is a sibling:

```
.../documentMetadata/{docId}/evaluationGate/{evaluator}
```

which the trigger pattern does not match.

### Who reads and writes what

| Surface | Reads | Writes | Purpose |
|---|---|---|---|
| Ideas button (`document.tsx`) | `evaluationGate` | — | immediate feedback to the student |
| Session end (`use-document-sync-to-firebase`) | — | — | unchanged; the server decides |
| Server evaluation (`on-analyzable-doc-written`) | `evaluationGate`, history | `evaluationGate` | the actual cost control |
| AI tile (`ai-tile.tsx`) | tile model prop | tile model prop | separate flow, own gate |

The AI tile keeps its own gate on its content model, beside `refreshCount`. It does not go through
the comments evaluation at all, so putting it in `evaluationGate` would couple two unrelated flows.
Per-tile also means two AI tiles in one document gate independently, which is what their separate
prompts imply.

**The client gate is for feedback; the server gate is for cost.** The server sits at the one choke
point every evaluation passes through, so it catches the session-end rerun and backstops the Ideas
press regardless of which client asked or whether that client gated correctly.

### What goes in `shared/`

The comparison, and the path and field names. `functions-v2` already imports four modules from
`shared/` (`clean-firebase-roots`, `update-class-data-docs`, and two chat-tutor modules), so the
precedent is set.

The Firestore query itself cannot be shared: the client uses the web SDK and the functions use
firebase-admin. Sharing the shape without the query is the honest split.

## What the student sees

Both client surfaces already have the pattern — a guard that skips the request and shows a message.
This adds a second guard beside the existing empty-document one:

```ts
const isEmpty = !document.content || !documentHasStudentWork(getSnapshot(document.content));
const skipEmptyDocument = isEmpty && aiEnabled;
// new: unchanged since the gate
if (skipEmptyDocument) { commentsManager.showStatusMessage(IDEAS_EMPTY_MESSAGE); return; }
if (isUnchanged)       { commentsManager.showStatusMessage(IDEAS_UNCHANGED_MESSAGE); return; }
```

Wording, matching the ticket's "try something new first":

> **Try adding or changing something, then ask again.**

The AI tile gets the equivalent beside `AI_TILE_EMPTY_MESSAGE`.

Order matters: the empty check runs first, so a student with an empty document is told it is empty
rather than that nothing has changed.

## Testing

**Shared** — the comparison itself: unchanged, advanced, and no gate recorded yet (first ever
evaluation must proceed).

**Client** — each surface shows its message and makes no request when the index is unchanged, and
does request when it moved. The AI tile additionally records its gate only after a successful
refresh.

**Server** — the handler skips when unchanged and evaluates when changed; the gate advances only on
success; and the gate write does not re-trigger the handler.

Every assertion is mutation-tested: revert the behavior, confirm the test fails, restore.

Cypress is the real check for the Ideas path, as it was for CLUE-740 — three bugs there reached
the branch through passing unit tests and were caught only by the specs.

## Risks

- **The server side cannot be verified on localhost.** Its feedback loop is a deploy, so the
  emulator tests in `functions-v2/test/` carry more weight than usual.
- **A first evaluation has no gate.** Absent must mean "evaluate", never "skip", or a document
  would never get its first evaluation. Pinned by a test.
- **The gate is per evaluator.** A unit that changes its `aiEvaluation` value starts fresh, which
  is correct — a different evaluator has not seen this document.
