# FL integration reference: context, ownership and durable delivery

How CLUE's tutor conversations are owned, what each ForeverLearning (FL) turn carries beyond the
workspace, how FL requests are made durable, and how a failed turn is recovered.

## Conversation ownership from the first message

New conversations use an owner-bound id containing the full platform uid, its length, the class
and the existing workspace/problem/provider identity (`ownedConversationId` in
`shared/chat-ownership.ts`). This includes network-based workspaces; sharing a network/document
never grants access to another learner's tutor history. Rules compare the literal owner prefix with
the authenticated claim and reject all client parent creation: only the trigger creates a parent.
Recovery cannot establish a missing parent. Subsequent messages and controls must match the
parent's immutable uid, class and problem.

On opening the tutor, the client checks the canonical parent on the server, then the legacy
parent. An existing legacy conversation is reused only when all three owner fields match.
Its history, session, request numbering and recovery fence remain in place. A foreign, missing
or differently scoped legacy parent is not reused. A network/offline lookup failure is an error,
not permission to fork a fresh conversation; the lookup runs again on the next send, which then
attaches the listeners. No transcript migration or bulk rewrite is needed.

The backend checks ownership before taking the lock and again before provider dispatch. A queued
message whose owner fields differ from its parent's, with no reservation, is marked rejected, with
a generic owner-visible notice, and consumed without a provider call. A mismatched message that
already has a private reservation stops the drain ("Reserved message ownership mismatch"): external
work or expense may exist and must not be erased or skipped automatically.

A client must use owner-bound ids to start a conversation; existing conversations under their
legacy ids keep working. The ownership checks apply to both tutor providers. Anonymous demo and
permissive QA/dev modes remain test modes, not classroom isolation.

Ownership tests cover concurrent first writes, parent pre-claims, literal/Unicode ids, established
uid/network histories, class/problem mismatches, recovery, provider non-dispatch and reserved-work
fencing.

## Current lesson and capabilities

Every ForeverLearning message snapshots the selected student-visible task in `activityContext`
and resolved application capabilities in `capabilityContext`, independently of workspace dirty
tracking. The backend maps these to optional `activity_context` and `capability_context` in
`clue.context_packet.v2`. Missing context is omitted; the previous message's value is never reused.
The OpenAI context installation path is unchanged.

Capability context has this versioned shape:

```json
{
  "schema_version": "clue.capability_context.v1",
  "dataflow": {
    "creation_tool_configured": true,
    "node_palette": ["Sensor", "Number", "Waves", "Math", "Compare", "Transform", "Hold", "Demo Device", "Live Device"],
    "demo_device_options": ["Light Bulb", "Gripper", "Advanced Gripper", "Fan", "Humidifier", "Servo"],
    "outputConfig": {
      "servoInputMode": "proportion",
      "allowedOutputTypes": ["Servo", "Grabber", "Gripper 2.0"]
    }
  }
}
```

This example shows VIBE's settings, not universal defaults. The builder imports the actual node
palette, Demo output catalog and Live output resolver. Palette and Demo lists use UI labels;
`allowedOutputTypes` uses the product's internal names. Known absent/malformed unit settings follow
the actual product defaults. An unavailable application configuration is unknown and omitted.
`shared/fl-packet/schema-conformance.test.ts` checks these fields against FL's capabilities schema,
`clue_context_packet_v2_capabilities_v1.schema.json`, when `FL_SCHEMA_DIR` holds it; an earlier v2
schema rejects them.

`creation_tool_configured` means the application toolbar includes Dataflow. It does not assert
edit permission, remaining tile capacity, connected hardware, a selected device or a successful
run. The node palette describes choices available when editing a Dataflow tile; it does not
describe placed nodes. Timer is absent from this build's palette but saved Timer nodes still load.
The Live output restriction does not erase an existing saved selection outside that restriction.
Both Demo and Live Servo use the application mode: proportion input 0..1, degrees input 0..180.
Stored tile `content.outputConfig` mirrors are preserved where valid, separately from current
application configuration. No synthetic tile is created for availability.

Shared validation limits capability data to 4096 UTF-8 bytes, 20 unique names per list and 80
characters per name. Firestore rules enforce the FL-only shape and list lengths; the browser
and backend validate element content. Full context remains within 24576 bytes. Oversized workspace
omission preserves task, capabilities and protection declarations. These facts carry no policy
override or teaching-action authority.

## Durable FL requests

The drain supplies server-owned persistence tied to the exact source Firestore message path.
Before HTTP dispatch, a transaction reserves an immutable versioned snapshot in
`chatTutorPendingRequests/{sha256(messagePath)}`. It includes the request identity, exact serialized
body, intended endpoint/solution/user, and the turn and trace to apply on success. It contains no
API key and no raw workspace: that is read again from the source message (or the parent's copy)
once the reply arrives, so a workspace near the browser's attachment limit still fits. The source
message and snapshot are hashed; source mutation, corrupt storage, changed target or
body/argument disagreement fails before dispatch. Transaction retries may prepare more than once,
but only the committed snapshot can be sent.

The collection is outside client-writable QA/dev trees; existing deny-by-default rules deny all
client access. `snapshotJson` is exempt from indexing. The bounded snapshot must fit before any
external call. A failed attempt retains it. A retry uses the exact body and an `Idempotency-Key`
matching `context.envelope.trace.request_id`, even for an opening that has not returned a session
id. The FL service decides whether to replay, reject or fence that identity. Concord does not
create a replacement identity to bypass an error and does not interpret teaching semantics.

The accepted assistant message records `sourceMessageId` and `providerRequestId`. The assistant,
session/turn update, cursor and pending-record deletion commit in one Firestore batch. A crash
before commit leaves a replayable request; a duplicate after commit is skipped by the cursor.
OpenAI does not reserve a request and incurs no pending-record write/delete.

Established sessions keep their trace and next-turn numbering. Requests dispatched before
reservation existed have no saved identity to reconstruct. Failed pending records must remain until
their outcomes are reconciled; any customer erasure workflow must also remove the corresponding
private record. Do not delete one simply to force another request.

## Delivery recovery

Before dispatch, the parent and private reservation also record an awaiting-confirmation receipt.
The browser shows waiting, then offers a check after its 30-second display deadline. This deadline
does not cancel the request or prove failure. The existing five-minute stale-lock interval still
exceeds the function timeout; a check cannot interrupt a running lock owner. A check made while
that owner holds the lock is not queued: the running invocation's own outcome normally settles the
delivery, and if the invocation dies instead, the next check after the lock goes stale is processed.

| Confirmed delivery state | Offered action | Backend transition |
| --- | --- | --- |
| 401, 403 or 429 rejection | Retry saved message | Reuse the exact reserved body and identity |
| `FL_NOT_DISPATCHED`: a failure before anything reached FL (no reservation) | Retry saved message | Build and reserve the request again; nothing was sent |
| Network/stream loss, pending/uncertain or other unclassified failure | Check for reply | Same exact request; no skip or new session |
| HTTP 422 with `CLUE_TURN_FAILED` | Continue conversation | Consume the failed sequence/cursor and drain queued genuine work |
| Conflicting identity, damaged reservation or a request the reservation refuses | Support required | No client bypass; see below |
| Completed response with `session_ended` | Start a new conversation | Clear session/trace/turn and resume queued work under a fresh identity |

FL errors may arrive as SSE on non-2xx responses. An execution error in an SSE stream, even with
`done`, does not prove that the admission ledger persisted terminal failure. Check the same key
to obtain its authoritative outcome. A generic 422 or 503 is not terminal proof. In particular,
closed-session failures that surface as generic storage errors remain fenced; Concord does not
infer closure from prose. `/end` without a confirmed session fails locally before HTTP rather
than inventing a closeout. Continue can then move on from that explicit local failure.

Recovery buttons write immutable `kind: recovery` controls with an action and server-issued
recovery id. They are not learner prompts and never reach the model. Rules limit their shape;
server transactions validate ownership, current receipt, source integrity and allowed transition.
Admin-only consumption markers and changing recovery ids make duplicate or delayed clicks stale.
Unknown work cannot be bypassed with a new user message. Delivery notices remain in the transcript
as system notices, including in copied text. A failed answer is never an assistant success.

Continue atomically applies the reserved trace/turn and the source message's workspace, advances
the cursor, resolves the notice and deletes the pending reservation. A successful response likewise
commits the reply/state/cursor/deletion together. Lost local commit acknowledgements are checked
against the cursor before recording failure. A published failure is not written again by the
outer trigger, which could otherwise overwrite a new recovery invocation. Completed closeout
stops the queue until the explicit new-conversation action; history remains visible.

## Clearing a delivery that needs support

This covers a `blocked` delivery, and a `retryable` `FL_NOT_DISPATCHED` delivery that fails the same
way on every retry (an oversized packet or a missing tutor user id). It is the "continue" transition
in `prepareRecovery` (`functions-v2/src/chat/delivery-recovery.ts`), done by hand.

1. Read `chatTutorPendingRequests/{sha256(source message path)}`, where the source message is the
   one the parent's `delivery.messageId` names.
   - **If it does not exist**, nothing reached FL: no FL check is needed, and `flTurn` must not
     change.
   - **If it exists**, take the request id from its `snapshotJson`
     (`request.context.envelope.trace.request_id`) or from the parent's `delivery.requestId`, ask
     FL whether that request was answered, and note the snapshot's `parentUpdate` if it parses.
2. Only while no drain holds the lock: in one admin transaction that re-reads the parent and the
   reservation and aborts if the parent's `status` is `"generating"`, its `delivery.id` changed, or
   the reservation's existence differs from step 1:
   - on the parent, delete `delivery` and `error`, set `status: "idle"`, and set
     `lastProcessedMessageId` and `lastProcessedCreatedAt` to the source message;
   - when a reservation existed, set `flTurn` and `flTraceId` from its `parentUpdate` (or, if that
     is missing, `flTurn` to the parent's value plus one), set `flContent` from the source message's
     `rightContent` when it is a non-empty string, and delete the reservation;
   - merge `{resolved: true, resolution: "continued"}` into `messages/delivery-<messageId>`.

Advancing the turn after a dispatched request keeps the next request from reusing its
`Idempotency-Key` (`<trace>-t<turn>`).

One case is outside this procedure: a message with a reservation whose owner fields do not match
its parent stops the drain with "Reserved message ownership mismatch" and records no delivery. It
needs an engineer, since the reservation may represent FL work billed to another learner.

## Checks

Run focused browser/shared tests and backend tests serially (`--runInBand --watch=false`).
`chat-fl-durability-emulator.test.ts` uses project `demo-clue-fl-durability`, real Firestore
transactions, the actual drain/router/provider/HTTP client and a loopback HTTP fixture. It checks
crashes before send, lost accepted responses, failed local commits, concurrent reservations,
duplicate drains, changed source/target, legacy sessions, terminal/uncertain statuses, failures
before dispatch, corruption, snapshot size and large workspaces. It makes no model calls.
`chat-drain-emulator.test.ts` uses an isolated project and a path outside the deployed trigger
pattern, so it is safe with the full local emulator stack. Rules tests verify that clients cannot
read, write or delete pending reservations, forge recovery receipts or mutate recovery controls.
These are delivery tests, not proof of hosted FL reconciliation or new teaching behavior.

Rolling back the durable backend needs care: old code cannot honor saved request identities or
recovery fences, so reconcile pending requests and keep new work from dispatching first. Preserve
recovery state and history; disabling the UI alone does not reconcile pending work.
