# FL integration reference: current context and durable delivery

Local cumulative reference against upstream `0d9e556026018f9f44e44ed0ac58d1b08b22f17a`.
This is a reviewable implementation, not a deployment instruction or classroom release.

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
The JSON-schema companion is `clue_context_packet_v2_capabilities_v1.schema.json`, supplied with
the FL qualification package; the original v2 schema remains an earlier contract checkpoint.

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
body, intended endpoint/solution/user, and successful parent state to apply. It contains no API key.
The source message and snapshot are hashed; source mutation, corrupt storage, changed target or
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

Old successfully established sessions retain their trace and next-turn numbering. This change
cannot reconstruct identities for requests dispatched by older code before reservation existed.
Failed pending records must remain until their outcomes are reconciled; any customer erasure workflow must
also remove the corresponding private record. Do not delete one simply to force another request.

## Delivery recovery

Before dispatch, the parent and private reservation also record an awaiting-confirmation receipt.
The browser shows waiting, then offers a check after its 30-second display deadline. This deadline
does not cancel the request or prove failure. The existing five-minute stale-lock interval still
exceeds the function timeout; a check cannot interrupt a running lock owner.

| Confirmed delivery state | Offered action | Backend transition |
| --- | --- | --- |
| 401, 403 or 429 rejection | Retry saved message | Reuse the exact reserved body and identity |
| Network/stream loss, pending/uncertain or other unclassified failure | Check for reply | Same exact request; no skip or new session |
| HTTP 422 with `CLUE_TURN_FAILED` | Continue conversation | Consume the failed sequence/cursor and drain queued genuine work |
| Conflicting identity or damaged reservation | Support required | No client bypass |
| Completed response with `session_ended` | Start a new conversation | Clear session/trace/turn and resume queued work under a fresh identity |

FL errors may arrive as SSE on non-2xx responses. An execution error in an SSE stream, even with
`done`, does not prove that the admission ledger persisted terminal failure. Check the same key
to obtain its authoritative outcome. A generic 422 or 503 is not terminal proof. In particular,
older closed-session failures that surface as generic storage errors remain fenced; Concord does
not infer closure from prose. `/end` without a confirmed session fails locally before HTTP rather
than inventing a closeout. Continue can then move on from that explicit local failure.

Recovery buttons write immutable `kind: recovery` controls with an action and server-issued
recovery id. They are not learner prompts and never reach the model. Rules limit their shape;
server transactions validate ownership, current receipt, source integrity and allowed transition.
Admin-only consumption markers and changing recovery ids make duplicate or delayed clicks stale.
Unknown work cannot be bypassed with a new user message. Delivery notices remain in the transcript
as system notices, including in copied text. A failed answer is never an assistant success.

Continue atomically applies the reserved trace/turn and current workspace snapshot, advances the
cursor, resolves the notice and deletes the pending reservation. A successful response likewise
commits the reply/state/cursor/deletion together. Lost local commit acknowledgements are checked
against the cursor before recording failure. A published failure is not written again by the
outer trigger, which could otherwise overwrite a new recovery invocation. Completed closeout
stops the queue until the explicit new-conversation action; history remains visible.

## Checks and deployment compatibility

Run focused browser/shared tests and backend tests serially (`--runInBand --watch=false`).
`chat-fl-durability-emulator.test.ts` uses project `demo-clue-item3`, real Firestore transactions,
the actual drain/router/provider/HTTP client and a loopback HTTP fixture. It checks crashes before
send, lost accepted responses, failed local commits, concurrent reservations, duplicate drains,
changed source/target, legacy sessions, terminal/uncertain statuses, corruption and snapshot size.
It makes no model calls. `chat-drain-emulator.test.ts` uses an isolated project and a path outside
the deployed trigger pattern, so it is safe with the full local emulator stack. Rules tests verify
that clients cannot read, write or delete pending reservations, forge recovery receipts or mutate
recovery controls. Item 4 also exercises these transitions through the real local browser,
Firestore and Functions with a deterministic loopback endpoint. These are delivery tests, not
proof of hosted FL reconciliation or new teaching behavior.

Recommended eventual deployment order: rules and indexes, backend, then browser (or one coordinated
deployment). Old clients remain compatible with the optional context fields, but cannot operate the
new recovery controls; a failed conversation may require the updated browser. A new browser against
old rules cannot create recovery controls, and an old backend ignores them. Coordinate the rollout
and verify the exact hosted combination before classroom use. Before rolling back
the durable backend, reconcile pending requests and keep new work from dispatching: old code cannot
honor these saved identities or fences. Preserve recovery state and history; disabling the UI alone
does not reconcile pending work. Keep the deployed classroom identity/configuration and hosted replay
qualification separate from this local reference. No full teaching regression is implied.
