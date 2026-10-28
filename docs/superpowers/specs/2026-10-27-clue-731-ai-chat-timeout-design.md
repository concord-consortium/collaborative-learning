# CLUE-731: AI Chats Should Time Out — Design

**Jira:** CLUE-731 (epic CLUE-606, "Collaboration AI vs. Assist AI")

## Goal

No AI surface in CLUE may leave a student staring at a progress indicator forever. Every place
that shows "Ada is working" gets a client-side deadline after which the indicator stops and the
student is told what happened, so a request that died server-side is visible rather than silent.

And it is visible to more than the student: every AI failure emits a log event, so the team can
answer "how often does Ada fail?" from data rather than from complaints.

## Why

A student cannot distinguish "the tutor is thinking" from "the tutor is never going to answer."
The chat's typing dots have no client-side deadline at all: if the drain function dies before
writing its assistant document, the dots run until the student reloads. The ticket's repro
(`?appMode=demo&demoName=CLUE&fakeClass=1&fakeUser=student:5&problem=0.1&unit=vibe`) is a
conversation wedged exactly this way. There is an escape — sending another message — but nothing
tells the student it exists.

## Correcting the ticket's analysis

The ticket says the stuck indicator is "the client reading status: `generating` on the parent," so
a stale parent flag wedges the spinner. **That is no longer true.** `FirestoreTransport.emitStatus`
already ignores a stale parent `generating`:

```ts
const effective: ChatStatus =
  this.parentStatus === "error" ? "error"
    : this.awaitingReply ? "generating" : "idle";
```

Only `awaitingReply` — newest `user` document newer than newest `assistant` document, computed
from the raw document stream — drives the dots. A stale parent flag on its own is already inert on
the client.

What actually wedges the dots is the case underneath that observation: **a user message for which
no assistant document is ever written**, because the drain died before its batch commit. The
client cannot tell that apart from a slow reply by reading any state, which is precisely why the
fix is a deadline rather than better status reading.

The server-side half (`STALE_LOCK_MS`, the 5-minute lock reclaim) is correct as written and is not
touched here. It governs whether a *later* trigger may re-enter a conversation; it has never
governed what this student sees now.

## Scope

**In**

- A 30-second client-side reply deadline for the Ada chat sidebar, with a visible message.
- Send-order (not completion-order) bookkeeping of the last-sent workspace hash in
  `FirestoreTransport`.
- A regression test pinning the existing guarantee that a document edit cannot reach an in-flight
  chat turn.
- A 45-second "taking longer than usual" interim line for the Ideas / document-evaluation waiting
  message, with the existing 120s hard expiry unchanged. Deliberately not the chat's 30s: an Ideas
  request is normally slower (Shutterbug alone is allowed 45s), so calling it unusual at 30s would
  be false.
- A visible failure message in the AI tile when its request fails.
- A log event for every AI failure: chat timeout, chat unavailable, Ideas failure, AI tile
  failure — plus a chat "message sent" event, so a failure count has a denominator.

**Out**

- **Lowering the Ideas 120s expiry.** It is pinned to a real server budget — the evaluation
  function sets `functionTimeoutSeconds = 120` and allows Shutterbug 45s inside it
  (`functions-v2/src/on-analysis-document-pending.ts`). A shorter client expiry reports failure on
  healthy-but-slow evaluations, and the real comment then lands behind the failure message.
- **Any change to `STALE_LOCK_MS` or the drain.** See "Correcting the ticket's analysis."
- **A Retry button in the chat.** The composer is already enabled during a pending reply, so
  retrying costs a retype, not a dead end. A real retry button has to decide what happens when the
  first turn lands late, which is a bigger question than this story.
- **Making the chat timeout authorable per unit.** One constant until the timeout rate shows it is
  wrong for some unit.
- **The teacher-facing AI class summary** (`src/components/navigation/ai-summary.tsx`). It has its
  own `checking`/`generating` status machine and no reported wedge. Separate story if it needs one.
- **Cross-posting a failure from one surface into another.** The AI tile's failure does not raise
  a comments-panel message, and neither the tile nor Ideas writes into the chat. See "Each surface
  reports its own failure."
- **Full chat event coverage** — replies received, panel open/close, highlight use. Only what a
  failure rate needs goes in here; instrumenting the chat properly is its own story.

## Design

### 1. Chat reply deadline

**Where.** [`src/components/chat-tutor/use-chat.ts`](../../../src/components/chat-tutor/use-chat.ts)
— the single place `pending` is derived. Putting it here covers `FirestoreTransport` and
`DebugTransport` alike and leaves the transport's status logic untouched.

**Why not in the transport.** The transport reports what the backend says. "How long a student
should be made to wait" is a UI judgment, and `emitStatus`'s three-way precedence is subtle enough
that threading a fourth state through it would cost more than it buys.

**Restart condition.** The timer restarts when the hook starts waiting **and whenever the newest
turn changes** — not on `waiting` alone. A student who sends a second message late in the wait
would otherwise inherit the first message's clock and be told "Ada didn't answer" seconds later,
about a message sent moments ago. Keying on the newest turn's id works because the id comes from
`messagesRef().add()`, which mints it client-side; the optimistic snapshot and the confirmed one
carry the same id, so the id changes exactly once per message.

**Value.** 30 seconds, between the ticket's 20s and the 45s first proposed here. 45s was argued
from an estimate of reply latency, not a measurement, and 45s is a long time to a student.

Erring short is the cheaper mistake: a late reply still renders and clears the message, so a
too-tight deadline costs a confusing moment rather than an answer. And this is the one number in
the story that the logging makes empirically revisable — `AI_CHAT_TIMEOUT` over
`AI_CHAT_MESSAGE_SENT` is the timeout rate, so a week of classroom use settles whether 30s cuts
off healthy replies.

**On expiry.** `pending` goes false — the dots stop and the "Ada is typing" live region clears.
A message row appears reading *"Ada didn't answer. Please try again."* The composer needs no
change; it is already enabled during a pending reply.

**Wording.** Deliberately distinct from the existing `status:"error"` line ("Ada is currently
unavailable. Please try again."). Those are different failures — one is the backend reporting an
error, one is the backend reporting nothing — and support cannot tell them apart if they read the
same.

**Clearing.** The timed-out state clears when the reply finally lands, when the student sends
again, and when the transport swaps (the existing re-subscribe effect already resets status,
turns and error). **A late reply is never discarded** — it renders normally when it arrives, and
the message row goes away with it.

**Surface.** `useChat` returns a `timedOut: boolean` alongside `error` rather than folding the
timeout into `error`. `error` is also set by send failures; one field carrying three unrelated
causes makes both the component and its tests guess. `chat.tsx` renders one message row, choosing
`error` first and the timeout message otherwise.

### 2. In-flight history

**The guarantee already holds.** An edit made while Ada is thinking cannot reach that turn:
`sendUserMessage` computes its workspace payload before its write, so what a turn carries is
frozen at send time, and the drain reads only what is on the message documents. This is pinned
with a regression test rather than changed.

**The real defect beside it.** `lastSentRightHash` is assigned *after* the `await`:

```ts
await this.messagesRef().add(message);
if (decision.attachRight && right) {
  this.lastSentRightHash = right.hash;
}
```

Two overlapping sends therefore record in completion order, not send order. Send A (hash `H1`)
and send B (`H2`) can resolve B-then-A, leaving the client believing `H1` was last sent when the
server has `H2`. The next message re-attaches a workspace the server already has — on the
ForeverLearning path that is up to 900 KB of document JSON per message. Overlapping sends are not
hypothetical: the composer is open during a pending reply precisely so a student can escape a
wedged turn.

**Fix.** Assign in send order, before the await. On a failed write, restore the previous value
unless a newer send has already superseded it — otherwise a failed send would mark a workspace as
delivered that never left the client, and the student's retry would omit it.

### 3. Ideas interim line

`queueRemoteComment` gains a second timer at 45s that marks its pending entry slow.
`WaitingMessage` then shows *"Ada is taking longer than usual..."* in place of *"Ada is thinking
about it..."*. The 120s expiry and its failure message are unchanged.

Slowness is tracked as a set of pending-entry ids on the manager, not a bare boolean. Today
`canRequestIdeas` allows only one remote `"ai"` entry at a time, so a boolean would work — but it
would be a boolean whose correctness depends on a gate in a different file, and it desyncs
silently the day that gate changes. The set cannot.

Both timers clear through the existing `wrappedDispose`, so `removePendingComments` remains the
single path by which an entry leaves the queue and nothing is left dangling.

### 4. AI tile failure

The tile's catch currently restores the previous text and only `console.error`s, so a failed
refresh looks to the student like a refresh that did nothing. It will write a failure message into
the tile instead, keeping the existing restore as the superseded-run path (a newer run taking over
is not a failure and must not report one).

**Tradeoff, stated.** The tile's text *is* document content, so this message persists and syncs —
unlike the Ideas status message, which is deliberately client-only. This follows the precedent
`AI_TILE_EMPTY_MESSAGE` already sets two lines away in the same function, and a message the
student can see is worth more than one that vanishes on reload. A later refresh overwrites it
normally.

### 5. Each surface reports its own failure

The tile reports in the tile, the chat reports in the chat, Ideas reports in the comments panel.
No failure is copied into another surface.

Two reasons, one per candidate. The **chat transcript is persisted in Firestore and fed back to
the model as conversation history**, so an injected "something went wrong" turn would become part
of what the model reads on the next turn — a client-only row avoids that but is still a message in
a conversation the student may never have opened. The **comments panel cannot say which tile
failed**; a document may hold several AI tiles with different prompts, and the panel's status line
has no tile to name.

The general point: cross-posting puts an error in front of people who were not there. A student
who clicked Update on a tile is looking at that tile. The audience that needs the cross-surface
view is the team, and logging serves them better than a duplicated message does.

### 6. Logging

**Why this is load-bearing, not an afterthought.** The chat emits **no log events at all** today —
not sends, not replies, not errors. "How often does Ada fail to answer?" is currently unanswerable.
Ideas logs `REQUEST_IDEA` on the click and nothing about the outcome, so attempts are countable
and failures are not. And a caught error that reaches only `console.error` goes nowhere: Rollbar
captures uncaught errors, while CLUE log events reach both the research log database and Rollbar
as info (`Logger.registerLogListener` in `src/lib/misc.ts`). The console.error in the AI tile's
catch today is, in practice, writing to nowhere.

**The denominator.** A failure event on its own yields a number nobody can interpret — forty chat
timeouts is a crisis out of two hundred and a rounding error out of forty thousand. Since the chat
logs nothing, a successful-send event goes in alongside the timeout so a rate can be computed.
This is the only non-failure event in scope.

**Reaching the logger.** `Logger.log` is static and queues messages until the logger initializes,
so the chat can call it without holding stores. It serializes the event by **name**
(`LogEventName[event]` in `formatAndSend`), not by its numeric enum value, so inserting new entries
mid-enum does not renumber anything downstream.

**What is logged, and what is not.** Identifiers and a reason: document key, problem path,
conversation id, tile id, and which failure it was. **Never the student's message text, their
authored prompt, or any document content.** These logs go to a research database and to Rollbar;
student-written text does not belong in either, and a failure rate does not need it. The raw
server error string is also left out — it can be long and can echo request content.

**Event names.** The chat gets three new ones, since it has none to reuse. Ideas gets one. The AI
tile reuses its existing `AI_TOOL_CHANGE` with `operation: "requestFailed"`, matching the
convention already in `ai-content.ts` (`requestRefresh` is logged the same way) rather than
introducing a fourth name for researchers to learn.

## Constants

| Constant | Value | Home |
|---|---|---|
| `kReplyDeadlineMs` | `30_000` | `src/components/chat-tutor/use-chat.ts` |
| `kTimeoutMessage` | "Ada didn't answer. Please try again." | `src/components/chat-tutor/use-chat.ts` |
| `kSlowRemoteCommentMs` | `45_000` | `src/models/document/document-comments-manager.ts` |
| `IDEAS_SLOW_MESSAGE` | "Ada is taking longer than usual..." | `src/models/document/ai-evaluation-messages.ts` |
| `AI_TILE_REQUEST_FAILED_MESSAGE` | "Something went wrong getting tips. Please try again" | `src/models/document/ai-evaluation-messages.ts` |

The two chat values sit beside the existing "Ada is currently unavailable" message in `use-chat.ts`
rather than moving to `ai-evaluation-messages.ts`: that module is about AI *evaluation* of a
document (Ideas and the AI tile), and the chat is a different feature with a different message
already living in the hook.

## Log events

| Event | Fires when | Payload |
|---|---|---|
| `AI_CHAT_MESSAGE_SENT` | a user message reaches Firestore | conversation id, document key, problem path |
| `AI_CHAT_TIMEOUT` | the reply deadline fires | conversation id, document key, problem path |
| `AI_CHAT_UNAVAILABLE` | the transport reports `status: "error"` | conversation id, document key, problem path |
| `IDEAS_REQUEST_FAILED` | the 15s foreground deadline, the 120s expiry, or a `"failed"` server outcome | document key, problem path, request id, which of the three |
| `AI_TOOL_CHANGE` *(existing)* | the AI tile's request fails | tile id, `operation: "requestFailed"` |

`AI_CHAT_MESSAGE_SENT` is the denominator for the two chat failure events. No event carries
message text, prompt text, document content or the raw server error string.

## Testing

| Test | Covers |
|---|---|
| `use-chat.test.ts` *(new)* | Deadline fires at `kReplyDeadlineMs`; `pending` goes false; `timedOut` set. Timer restarts on a new turn. Late reply clears the timeout and renders. Transport swap resets. No timeout while idle. |
| `firestore-transport.test.ts` | Overlapping sends record the hash in send order; a failed write restores the prior hash; a failed write superseded by a newer send does not. |
| `firestore-transport.test.ts` | Regression: a document mutated between send and write resolution does not change what that message carried. |
| `document-comments-manager.test.ts` | Slow set populated at 45s, cleared on resolve, on expiry, and on `dispose`. |
| `waiting-message.test.tsx` | Interim message replaces the thinking message when the entry is slow. |
| `ai-tile.test.tsx` | Failure writes the message; a superseded run restores instead. |
| `use-chat.test.ts` | Timeout and unavailable each log once per episode, not once per render. A successful send logs; a failed send does not. |
| `document-comments-manager.test.ts` | Each of the three Ideas failure paths logs, and an expiry superseded by a newer click does not. |
| `ai-tile.test.tsx` | A failed request logs `requestFailed`; a superseded run logs nothing. |
| all of the above | No logged payload contains message text, prompt text or document content. |

No Cypress work: all four behaviors are timer-driven and are exercised honestly with Jest fake
timers. A Cypress spec would have to wait the real deadline out to prove anything.

## Delivery

- **No Deploy timing callout.** Nothing under `functions-v1/`, `functions-v2/`, `authoring-api/`,
  `shared/`, `firestore.rules`, `database.rules.json` or `firestore.indexes.json` is touched.
- **No `docs/unit-configuration.md` update.** No authorable `config` property is added or changed.
