# CLUE-731: AI Chats Should Time Out — Implementation Plan

> **Status: built and superseded.** This is the plan as written before implementation, kept for
> the record. Review found three defects in what it specified, so the shipped code differs from it
> in three places: the reply deadline also releases the composer's `sending` state (Task 2); the
> workspace hash is recorded on acknowledgement rather than claimed before the write (Task 3); and
> the AI tile reports only a student-requested failure, under its own `AI_TILE_REQUEST_FAILED`
> event rather than `AI_TOOL_CHANGE` (Tasks 6-7). The design doc is the current description.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No AI surface in CLUE leaves a student watching a progress indicator forever, and no AI failure is invisible to the team. The chat gets a 30s client-side reply deadline, Ideas gets a 45s "taking longer than usual" line ahead of its existing 120s give-up, the AI tile reports a failed request instead of silently restoring its old text, and every one of those failures emits a log event.

**Architecture:** The chat deadline lives in `useChat`, the single place `pending` is derived, so it covers both transports without touching `FirestoreTransport.emitStatus`'s status precedence. The Ideas interim line is a second timer inside `queueRemoteComment`, clearing through the existing `wrappedDispose` so `removePendingComments` stays the only path an entry leaves the queue by. Logging reaches the static `Logger.log`, which queues until the logger initializes, so the chat needs no store access; the comments manager stays free of document/store coupling by taking an `onFailure` callback rather than logging itself. Separately, `FirestoreTransport` stops recording the last-sent workspace hash in completion order.

**Tech Stack:** TypeScript, React 18, MobX / MobX State Tree, Jest + @testing-library/react with fake timers.

**Spec:** `docs/superpowers/specs/2026-10-27-clue-731-ai-chat-timeout-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/chat-tutor/use-chat.ts` *(modify)* | The reply deadline, `timedOut` in the result, the timeout message constant |
| `src/components/chat-tutor/use-chat.test.ts` *(create)* | Deadline fires, restarts per message, clears on a late reply and on transport swap |
| `src/components/chat-tutor/chat.tsx` *(modify)* | Render the timeout row; keep the live region from re-announcing the previous reply |
| `src/components/chat-tutor/chat-timeout.test.tsx` *(create)* | `Chat` renders the timeout row and no typing dots |
| `src/components/chat-tutor/chat-highlights.test.tsx` *(modify)* | Its `chatResult` helper gains `timedOut` |
| `src/components/chat-tutor/firestore-transport.ts` *(modify)* | Record `lastSentRightHash` in send order, with rollback on a failed write |
| `src/components/chat-tutor/firestore-transport.test.ts` *(modify)* | Send-order tests plus the in-flight-edit regression guard |
| `src/models/document/ai-evaluation-messages.ts` *(modify)* | `IDEAS_SLOW_MESSAGE`, `AI_TILE_REQUEST_FAILED_MESSAGE` |
| `src/models/document/document-comments-manager.ts` *(modify)* | `kSlowRemoteCommentMs`, the slow-entry timer and id set |
| `src/models/document/document-comments-manager.test.ts` *(modify)* | Slow set set/cleared on resolve, expiry and dispose |
| `src/models/document/base-document-content.ts` *(modify)* | `isRemoteCommentSlow` view |
| `src/components/chat/waiting-message.tsx` *(modify)* | Pick the interim message when the entry is slow |
| `src/components/chat/waiting-message.test.tsx` *(modify)* | Interim message rendering |
| `src/plugins/ai/ai-tile.tsx` *(modify)* | Write the failure message on a real failure; log it |
| `src/plugins/ai/ai-tile.test.tsx` *(modify)* | Failure writes the message and logs; a superseded run restores and logs nothing |
| `src/lib/logger-types.ts` *(modify)* | `AI_CHAT_MESSAGE_SENT`, `AI_CHAT_TIMEOUT`, `AI_CHAT_UNAVAILABLE`, `IDEAS_REQUEST_FAILED` |
| `src/components/chat-tutor/chat-sidebar.tsx` *(modify)* | Hoist the conversation id out of the transport memo; pass log context to `useChat` |
| `src/components/document/document.tsx` *(modify)* | Log the two client-side Ideas failure paths; supply `onFailure` to the manager |

No Cypress spec, so no `.github/workflows/manual-regression.yml` change. No functions, rules or index changes, so **no Deploy timing callout** on the PR. No authorable config, so no `docs/unit-configuration.md` update.

---

## Task 1: The chat reply deadline

**Files:**
- Modify: `src/components/chat-tutor/use-chat.ts`
- Test: `src/components/chat-tutor/use-chat.test.ts` *(create)*

- [ ] **Step 1: Write the failing tests**

Create `src/components/chat-tutor/use-chat.test.ts`. Drive it with a controllable stub transport
whose `subscribe` captures the emitters so the test can push turns and status at will:

```ts
import { act, renderHook } from "@testing-library/react";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";
import { kReplyDeadlineMs, useChat } from "./use-chat";

function stubTransport() {
  let emitTurns: (turns: ChatTurn[]) => void = () => undefined;
  let emitStatus: (status: ChatStatus) => void = () => undefined;
  const transport: ChatTransport = {
    subscribe(onTurns, onStatus) {
      emitTurns = onTurns;
      emitStatus = onStatus;
      onTurns([]);
      onStatus("idle");
      return () => undefined;
    },
    sendUserMessage: jest.fn(async () => undefined),
  };
  return {
    transport,
    turns: (t: ChatTurn[]) => act(() => emitTurns(t)),
    status: (s: ChatStatus) => act(() => emitStatus(s)),
  };
}

const userTurn = (id: string): ChatTurn => ({ id, sender: "user", text: "help" });
```

Cases to assert:

1. **No timeout while idle** — advance past `kReplyDeadlineMs` with `status: "idle"`;
   `timedOut` stays false.
2. **Fires at the deadline** — emit a user turn and `status: "generating"`, advance
   `kReplyDeadlineMs`; `pending` is false and `timedOut` is true. Also assert `pending` was still
   true one millisecond earlier, so the test pins the boundary rather than just "eventually."
3. **Restarts on a new message** — go pending, advance to just short of the deadline, emit a
   second user turn, advance that far again; `timedOut` is still false (well past one deadline in
   total, but not since the newest message). Express the advances as offsets from
   `kReplyDeadlineMs` rather than literals, so the constant can move without breaking the test.
   This is the case a `waiting`-only dependency list gets wrong.
4. **A late reply clears it** — let it time out, then emit an assistant turn and `status: "idle"`;
   `timedOut` returns to false and the turn is in `turns`.
5. **Transport swap resets** — rerender the hook with a second transport while timed out;
   `timedOut` is false and no timer from the old transport can fire afterwards.

Use `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in `afterEach`, matching
`document-comments-manager.test.ts`'s `expiry` block.

- [ ] **Step 2: Implement**

In `use-chat.ts`, add the constants near the existing message string:

```ts
// How long the client waits for a reply before it stops claiming Ada is working. Nothing on the
// client can tell a dead turn from a slow one — the drain writes its assistant document and its
// cursor in one batch, so a drain that died writes neither — which is why this is a deadline and
// not a smarter reading of status.
//
// 30s is a compromise between a student's patience and a slow but healthy reply. Erring short is
// the cheaper mistake: a late reply still renders and clears the message. AI_CHAT_TIMEOUT over
// AI_CHAT_MESSAGE_SENT gives the rate this should be retuned against.
export const kReplyDeadlineMs = 30_000;

// Deliberately distinct from the status:"error" message below: the backend reporting an error and
// the backend reporting nothing are different failures, and support cannot tell them apart if
// they read the same.
export const kTimeoutMessage = "Ada didn't answer. Please try again.";
```

Add `timedOut: boolean` to `UseChatResult`, then:

```ts
const [timedOut, setTimedOut] = useState(false);

const waiting = status === "generating";
const newestTurnId = turns.length ? turns[turns.length - 1].id : undefined;

// Keyed on the newest turn as well as `waiting`: a second message sent mid-wait must start its own
// clock, not inherit the first one's and be cut off seconds after the student sent it. The id is
// minted client-side by messagesRef().add(), so the optimistic turn and its confirmation share one
// id and this changes exactly once per message.
useEffect(() => {
  setTimedOut(false);
  if (!waiting) return;
  const timer = setTimeout(() => setTimedOut(true), kReplyDeadlineMs);
  return () => clearTimeout(timer);
}, [waiting, newestTurnId]);

const pending = waiting && !timedOut;
```

Return `timedOut` from the hook. The existing re-subscribe effect already resets status and turns,
which drives this effect through both of its dependencies, so a transport swap needs no extra
reset here.

Do **not** fold the timeout into `error`. `error` is also set by send failures; one field carrying
three unrelated causes makes both the component and its tests guess which one it is holding.

- [ ] **Step 3: Verify**

```bash
npm test -- src/components/chat-tutor/use-chat.test.ts
```

---

## Task 2: Render the timeout in the chat

**Files:**
- Modify: `src/components/chat-tutor/chat.tsx`
- Test: `src/components/chat-tutor/chat-timeout.test.tsx` *(create)*
- Modify: `src/components/chat-tutor/chat-highlights.test.tsx`

- [ ] **Step 1: Find every `UseChatResult` literal**

```bash
grep -rn "UseChatResult" --include="*.ts" --include="*.tsx" src
```

Adding `timedOut` makes every object literal typed as `UseChatResult` fail to compile until it is
added. `chat-highlights.test.tsx`'s `chatResult` helper is the known one; confirm there are no
others before editing.

- [ ] **Step 2: Write the failing test**

Create `src/components/chat-tutor/chat-timeout.test.tsx`, following `chat-highlights.test.tsx`'s
pattern of rendering `<Chat>` against a hand-built `UseChatResult` (no timers needed — the hook's
timing is Task 1's subject; this file is about what the component draws):

```ts
const chatResult = (over: Partial<UseChatResult> = {}): UseChatResult => ({
  turns: [], status: "idle", error: null, pending: false, timedOut: false,
  sendMessage: jest.fn(async () => undefined), header: "Doc · 1.1", ...over
});
```

Assert:

1. `timedOut: true` renders `chat-error` containing `kTimeoutMessage`.
2. `timedOut: true` renders **no** `chat-row-typing` — the dots are the thing the ticket is about.
3. `error` wins over `timedOut` when both are set, so a real send failure is never masked by the
   deadline that follows it.
4. **`timedOut: true` leaves `chat-live` empty** even with a previous assistant turn in `turns`.
   This is the regression the change would otherwise introduce — see Step 3.
5. Neither set renders no `chat-error`.

- [ ] **Step 3: Implement**

Destructure `timedOut` from `chat`, import `kTimeoutMessage` from `./use-chat`, and replace the
error row:

```tsx
{(error || timedOut) &&
  <div className="chat-error" role="alert" data-testid="chat-error">{error ?? kTimeoutMessage}</div>}
```

`role="alert"` already announces it, so the timeout needs no live region of its own. Reuses the
existing `.chat-error` rule — no SCSS change.

**Then fix the live region.** It currently reads:

```tsx
{!pending && lastAssistantText ? `Ada said: ${lastAssistantText}` : ""}
```

`pending` going false is what tells it a reply completed. The deadline also flips `pending` false,
so without a guard a timeout would announce the *previous* reply as if it had just arrived —
telling a screen-reader user that Ada answered at the exact moment Ada failed to. Guard it:

```tsx
{!pending && !timedOut && lastAssistantText ? `Ada said: ${lastAssistantText}` : ""}
```

The typing indicator needs no change: it reads `pending`, which already excludes the timeout.

- [ ] **Step 4: Add `timedOut: false` to `chat-highlights.test.tsx`'s `chatResult` helper**

- [ ] **Step 5: Verify**

```bash
npm test -- src/components/chat-tutor
npm run check:types
```

---

## Task 3: Record the workspace hash in send order

**Files:**
- Modify: `src/components/chat-tutor/firestore-transport.ts`
- Test: `src/components/chat-tutor/firestore-transport.test.ts`

- [ ] **Step 1: Write the failing tests**

`fakeFirestore()` in the existing test file resolves `add` immediately, which cannot express
overlap. Add a deferred variant beside it:

```ts
function deferredFirestore() {
  const added: Record<string, unknown>[] = [];
  const resolvers: Array<(v?: unknown) => void> = [];
  const rejecters: Array<(e: unknown) => void> = [];
  const messages = {
    add: (doc: Record<string, unknown>) => {
      added.push(doc);
      return new Promise((resolve, reject) => { resolvers.push(resolve); rejecters.push(reject); });
    }
  };
  const firestore = { collection: () => ({ doc: () => ({ collection: () => messages }) }) };
  return { added, resolvers, rejecters, firestore: firestore as any };
}
```

Build the transport with a mutable summary source so the test controls the hash:

```ts
let summary = { markdown: "W1", hash: "H1" };
// ... getRightSummary: () => summary
```

Cases:

1. **Overlapping sends record in send order.** Send A (hash `H1`), change `summary` to `H2`, send
   B, resolve B's write then A's. A third send with the document still at `H2` must **not**
   re-attach the workspace. Before the fix it does, because A's late resolution overwrote the
   recorded hash with `H1`.
2. **A failed write rolls back.** Send A with `H1`, reject it, catch the rejection, send again
   with the document still at `H1`: the workspace must be attached, because it never reached the
   server.
3. **A superseded failed write does not roll back.** Send A (`H1`), change to `H2`, send B,
   resolve B, then reject A. A third send at `H2` must not re-attach — A's rollback must not undo
   B's successful delivery.
4. **An unchanged send that fails does not clear the record.** With `attachRight` false (document
   unchanged since the last successful send), reject the write and confirm `lastSentRightHash`
   still reflects the earlier delivery. This is the case the rollback guard has to get right: the
   hashes match precisely *because* nothing was attached, so a match alone is not evidence this
   send claimed the slot.

- [ ] **Step 2: Implement**

Replace the tail of `sendUserMessage`:

```ts
// Recorded before the write, not after. Two overlapping sends would otherwise record in
// completion order, leaving the client believing an older workspace was the last one sent and
// re-attaching one the server already has — up to kMaxAttachedWorkspace of document JSON on the
// ForeverLearning path. The composer stays open during a pending reply so a student can escape a
// wedged turn, so overlapping sends are expected, not exotic.
const claimedRight = decision.attachRight && right ? right : undefined;
const previousRightHash = this.lastSentRightHash;
if (claimedRight) {
  this.lastSentRightHash = claimedRight.hash;
}

try {
  await this.messagesRef().add(message);
} catch (e) {
  // The workspace never left the client, so the record has to go back — but only if this send is
  // still the one holding it. `claimedRight` is what distinguishes this from an unchanged send,
  // whose hash matches precisely because it attached nothing.
  if (claimedRight && this.lastSentRightHash === claimedRight.hash) {
    this.lastSentRightHash = previousRightHash;
  }
  throw e;
}
```

Delete the old post-await `if (decision.attachRight && right) { this.lastSentRightHash = right.hash; }`.

- [ ] **Step 3: Verify**

```bash
npm test -- src/components/chat-tutor/firestore-transport.test.ts
```

---

## Task 4: Pin the in-flight-edit guarantee

**Files:**
- Test: `src/components/chat-tutor/firestore-transport.test.ts`

- [ ] **Step 1: Write the regression test**

An edit made while Ada is thinking already cannot reach that turn — `sendUserMessage` computes its
workspace payload before its write. Nothing is being changed here; the test exists so the
guarantee is not quietly lost later.

Using `deferredFirestore()` from Task 3: send a message with the summary at `H1`, mutate the
summary source to `H2` **before** resolving the write, then resolve it. Assert the captured
document still carries `W1`, and that no second document was written. Name it so the intent
survives: something like `"a document edit during an in-flight send does not change what that
message carried"`.

- [ ] **Step 2: Verify**

```bash
npm test -- src/components/chat-tutor/firestore-transport.test.ts
```

---

## Task 5: The Ideas interim message

**Files:**
- Modify: `src/models/document/ai-evaluation-messages.ts`
- Modify: `src/models/document/document-comments-manager.ts`
- Modify: `src/models/document/base-document-content.ts`
- Modify: `src/components/chat/waiting-message.tsx`
- Tests: `src/models/document/document-comments-manager.test.ts`, `src/components/chat/waiting-message.test.tsx`

- [ ] **Step 1: Write the failing manager tests**

Add to the existing `expiry` describe (or a sibling `slow` describe) in
`document-comments-manager.test.ts`, following its `jest.useFakeTimers()` /
`advanceTimersByTimeAsync` style:

1. Not slow before 45s; slow at 45s.
2. An entry resolved by its comment before 45s never becomes slow, and its timer does not fire
   afterwards.
3. An entry that becomes slow and then resolves is no longer slow.
4. The 120s expiry still fires and still shows `IDEAS_REQUEST_FAILED_MESSAGE` — the new timer must
   not disturb it.
5. `dispose()` while slow leaves nothing behind (no slow ids, no pending entries).

- [ ] **Step 2: Implement the manager change**

In `ai-evaluation-messages.ts`:

```ts
export const IDEAS_SLOW_MESSAGE = "Ada is taking longer than usual...";
```

In `document-comments-manager.ts`, beside `kRemoteCommentExpiryMs`:

```ts
// When a pending request stops looking normal and starts looking stuck. Well short of the expiry
// below, which is pinned to the evaluation function's own 120s budget and so cannot be lowered
// without reporting failure on evaluations that are merely slow.
const kSlowRemoteCommentMs = 45_000;
```

Track slowness as a set of pending-entry ids on the manager:

```ts
/** Pending remote entries that have passed kSlowRemoteCommentMs. A set rather than a flag: a flag
 * would only be correct while canRequestIdeas allows one remote entry at a time, and would desync
 * silently the day that gate changes. */
slowRemoteCommentIds = new Set<string>();

get hasSlowRemoteComment() {
  return this.slowRemoteCommentIds.size > 0;
}
```

In `queueRemoteComment`, add a second timer and fold it into `wrappedDispose` so teardown stays in
one place:

```ts
const slowTimer = setTimeout(() => {
  runInAction(() => { this.slowRemoteCommentIds = new Set(this.slowRemoteCommentIds).add(id); });
}, kSlowRemoteCommentMs);

const wrappedDispose = () => {
  clearTimeout(timer);
  clearTimeout(slowTimer);
  dispose?.();
};
```

Replace the set rather than mutating it in place — `makeAutoObservable` does not make a plain
`Set`'s contents observable, so a mutation would not re-render the waiting message.

Clear the id in `removePendingComments` (the single exit path) and in `dispose()`.

- [ ] **Step 3: Expose it on the content model**

In `base-document-content.ts`, beside `isAwaitingRemoteComment`:

```ts
// True once a pending remote comment has been waiting long enough to look stuck rather than slow.
get isRemoteCommentSlow() {
  const doc = getParentWithTypeName(self, "Document");
  return !!doc?.commentsManager?.hasSlowRemoteComment;
}
```

- [ ] **Step 4: Use it in the waiting message**

In `waiting-message.tsx`, add the slow text beside `waitingMessageText` and pick between them:

```tsx
{content?.isAwaitingRemoteComment &&
  <AdaStatusMessage message={content.isRemoteCommentSlow ? IDEAS_SLOW_MESSAGE : waitingMessageText} />}
```

The existing `role="status"` / `aria-live="polite"` region re-announces on the swap, which is the
point: the student is told the wait has become unusual.

- [ ] **Step 5: Test the rendering**

In `waiting-message.test.tsx`, following its existing `{ ... } as any` content stubs: assert the
thinking message when `isRemoteCommentSlow` is false, and `IDEAS_SLOW_MESSAGE` when it is true.

- [ ] **Step 6: Verify**

```bash
npm test -- src/models/document/document-comments-manager.test.ts src/components/chat/waiting-message.test.tsx
```

---

## Task 6: The AI tile failure message

**Files:**
- Modify: `src/models/document/ai-evaluation-messages.ts`
- Modify: `src/plugins/ai/ai-tile.tsx`
- Test: `src/plugins/ai/ai-tile.test.tsx`

- [ ] **Step 1: Read the existing test file first**

`ai-tile.test.tsx` already mounts the tile with a mocked `getAiContent_v2`. Read how it stubs
`useFirebaseFunction` and the stores before writing anything — reuse that harness rather than
building a second one.

- [ ] **Step 2: Write the failing tests**

1. A rejected request writes `AI_TILE_REQUEST_FAILED_MESSAGE` into the tile.
2. A resolved response carrying `data.error` does the same — the function reports server-side
   failure by resolving with a truthy `error`, not by rejecting, and both already route through
   this catch.
3. A **superseded** run still restores the previous text rather than reporting a failure. A newer
   refresh taking over is not a failure and must not look like one. This is the case the change
   can most easily break.

- [ ] **Step 3: Implement**

In `ai-evaluation-messages.ts`:

```ts
export const AI_TILE_REQUEST_FAILED_MESSAGE = "Something went wrong getting tips. Please try again";
```

In the tile's catch, report instead of silently restoring:

```ts
} catch (error) {
  // Restoring the old text looks to the student exactly like a refresh that did nothing, so a
  // current run says what happened. A superseded run is not a failure: the newer run's own
  // restore at the top of the effect handles it, which is why this is gated on isCurrent().
  // Unlike the Ideas status message this is document content, so it persists and syncs — the
  // same tradeoff AI_TILE_EMPTY_MESSAGE already makes above, and a later refresh overwrites it.
  if (isCurrent() && isAlive(content)) {
    content.setText(AI_TILE_REQUEST_FAILED_MESSAGE);
    previousTextRef.current = undefined;
  }
  console.error("Failed to query AI", error);
}
```

`isAlive(content)` stays: writing to a destroyed node throws and would hide the error being
reported. The `previousTextRef.current !== undefined` condition goes — the message should appear
whether or not this run had already blanked the text.

- [ ] **Step 4: Verify**

```bash
npm test -- src/plugins/ai
```

---

## Task 7: Logging

Do this **after** Tasks 1–6, so every failure path it hooks into already exists and is tested.

**Files:**
- Modify: `src/lib/logger-types.ts`
- Modify: `src/components/chat-tutor/use-chat.ts`, `src/components/chat-tutor/chat-sidebar.tsx`
- Modify: `src/models/document/document-comments-manager.ts`, `src/components/document/document.tsx`
- Modify: `src/plugins/ai/ai-tile.tsx`
- Tests: `use-chat.test.ts`, `document-comments-manager.test.ts`, `ai-tile.test.tsx`

**What never goes in a payload:** the student's message text, their authored prompt, any document
content, or the raw server error string. Identifiers and a reason only. These logs reach a research
database and Rollbar.

- [ ] **Step 1: Add the event names**

In `src/lib/logger-types.ts`, add `AI_CHAT_MESSAGE_SENT`, `AI_CHAT_TIMEOUT` and
`AI_CHAT_UNAVAILABLE` near `CHAT_PANEL_HIDE`/`CHAT_PANEL_SHOW`, and `IDEAS_REQUEST_FAILED` beside
`REQUEST_IDEA`.

Insertion mid-enum is safe: `formatAndSend` serializes with `LogEventName[event]`, so the **name**
travels, not the numeric value. Confirm no test pins the enum's length before relying on that.

- [ ] **Step 2: Chat — hoist the conversation id**

`chat-sidebar.tsx` currently computes `conversationDocId(...)` inline inside the transport
`useMemo`. Lift it into its own `useMemo` and pass the result into both the transport and the log
context. `conversationDocId` is pure, so this changes no behavior.

This id is what joins a log row to the Firestore conversation — the ticket links to one specific
wedged document, and that is exactly the lookup it enables. `problemPath` is already on every log
message (`createLogMessage`), so the context needs only `{ conversationId, documentKey }`.

- [ ] **Step 3: Chat — write the failing tests**

In `use-chat.test.ts`, mock the logger (`jest.mock("../../lib/logger", ...)`) and assert:

1. The deadline firing logs `AI_CHAT_TIMEOUT` **exactly once**, including after further renders —
   a log inside a render body rather than the timer callback would fire repeatedly.
2. `status: "error"` logs `AI_CHAT_UNAVAILABLE` once per transition, not once per snapshot. Emit
   `"error"` twice in a row and assert a single call.
3. A successful send logs `AI_CHAT_MESSAGE_SENT`; a send whose transport rejects logs nothing.
4. No payload contains the message text. Send a recognizable string and assert it appears in no
   logged argument.

- [ ] **Step 4: Chat — implement**

Add the optional log context to `UseChatOptions`, log the send in `sendMessage` after the
transport call resolves, log the timeout inside the `setTimeout` callback, and log the unavailable
case in the existing `status === "error"` effect (which already fires once per transition).

Make the context optional so `DebugTransport` callers and the existing tests need not supply it.
Debug dry-run sends being loggable is not a concern in practice: `chatDebug` is a developer URL
param and the logger is inert outside authed mode.

- [ ] **Step 5: Ideas — implement and test**

The manager has no document reference and should keep none. Add an optional
`onFailure?: () => void` to `IQueueRemoteCommentParams`, store it on the pending entry, and call it
from a small private `reportFailure()` alongside the two existing
`showStatusMessage(IDEAS_REQUEST_FAILED_MESSAGE)` calls — the 120s expiry and the `"failed"`
outcome in `applyEvaluationStatus`. `"skipped-empty"` is not a failure and logs nothing.

In `document.tsx`, supply `onFailure` (the document is already in scope there) and log
`IDEAS_REQUEST_FAILED` at the two client-side paths as well: the 15s foreground deadline and
`guardedAttempt`'s catch. Carry a `reason` field distinguishing the four so the data can tell a
dead server from a dead connection.

Test in `document-comments-manager.test.ts` that each in-manager path calls `onFailure` once, and
that an expiry superseded by a newer click calls it **not at all** — matching the existing
"shows nothing when an older request's entry expires after a newer click" case, which is the
precedent for that rule.

- [ ] **Step 6: AI tile — implement and test**

`ai-tile.test.tsx` already mocks `logTileChangeEvent` and asserts against it, so reuse that.

In the tile's catch, beside the failure message from Task 6:

```ts
logAiEvent(content, "requestFailed", {});
```

Inside the same `isCurrent()` guard — a superseded run is not a failure and must log nothing. No
error string in the payload.

- [ ] **Step 7: Verify**

```bash
npm test -- src/components/chat-tutor src/models/document src/plugins/ai src/components/document
```

---

## Task 8: Full verification

- [ ] **Step 1: Types and lint**

```bash
npm run check:types
npm run lint:build
```

`lint:build` rather than `lint` — it also flags unnecessarily disabled rules, and it is what has to
pass before committing.

- [ ] **Step 2: Jest across everything touched**

```bash
npm test -- src/components/chat-tutor src/components/chat src/models/document src/plugins/ai src/components/document
```

Report the actual pass/fail counts. Do not claim completion from a partial run.

- [ ] **Step 2b: Confirm no student text reaches a log payload**

```bash
grep -n "Logger.log\|logAiEvent\|logDocumentEvent" -r src/components/chat-tutor src/components/document/document.tsx src/plugins/ai/ai-tile.tsx
```

Read each payload and confirm it carries identifiers and a reason only — no message text, prompt
text, document content or raw server error string. The tests assert this, but it is worth one
pair of eyes, since a log that leaks student writing is not something a later test catches.

- [ ] **Step 3: Hand-check in the browser**

The deadline is the one behavior worth seeing. Restart `npm start` first and confirm a clean
compile — a long-lived dev server that has seen branch switches serves a stale bundle that looks
current (see CLAUDE.md).

Open the chat and send a message with the network offline (DevTools → Network → Offline) or with
the chat trigger disabled, then watch: the dots stop at 30s and the message appears, the composer
still accepts a message, and sending again restarts the dots.

- [ ] **Step 4: Run `/code-self-review` over the full diff**

Four lenses: comment quality, pattern consistency, copy/paste, and structure that exists only for
tests.

- [ ] **Step 5: Hold for the user before pushing**

Commit locally. Do not push until the user has checked it on localhost or said to go ahead.

---

## Risks

| Risk | Handling |
|---|---|
| 30s cuts off a legitimately slow reply | The reply still renders when it arrives; the message row clears with it. Nothing is discarded. `AI_CHAT_TIMEOUT` over `AI_CHAT_MESSAGE_SENT` is the rate to retune against — the constant is one line, but do not make it authorable without that evidence. |
| The live region announces a stale reply on timeout | Explicitly covered: Task 2 Step 3 guards it, Task 2 Step 2 case 4 tests it. |
| The slow-entry set desyncs from `pendingComments` | Both the 45s and 120s timers clear through `wrappedDispose`, and `removePendingComments` stays the single exit path. Task 5 Step 1 case 5 tests `dispose()` while slow. |
| The AI tile failure message persists in document content | Stated and accepted in the spec; follows `AI_TILE_EMPTY_MESSAGE`'s existing precedent. Revisit only if a student reports a stuck error in a saved document. |
| The hash rollback fires on a send that attached nothing | `claimedRight` distinguishes the two; Task 3 Step 1 case 4 is exactly this. |
| A failure event logs on every render instead of once | Every log sits in a timer callback, a transition-keyed effect, or a resolved promise — never a render body. Task 7 Step 3 cases 1 and 2 assert the counts rather than just the calls. |
| Student-written text reaches the research logs | Payloads are identifiers and a reason only. Task 7 Step 3 case 4 asserts it, Task 8 Step 2b re-reads every call site by hand. |
| Chat failure counts have no denominator | `AI_CHAT_MESSAGE_SENT` ships in the same change, so a rate is computable from day one rather than after a follow-up. |
