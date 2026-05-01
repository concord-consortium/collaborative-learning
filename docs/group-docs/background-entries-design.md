# Background Entries Design

**Status**: Draft for review
**Date**: 2026-04-30
**Author**: Scott Cytacki (with Claude)
**Related**: [group-docs-plan.md](group-docs-plan.md), [group-docs-brainstorm.md](group-docs-brainstorm.md), CLUE-379, [transaction-free-history-design.md](transaction-free-history-design.md)

**Prerequisite**: [transaction-free-history-design.md](transaction-free-history-design.md). This design assumes the multi-parent DAG model and the receive-side state machine described there.

## Summary

CLUE's dataflow tile generates document changes on every simulation tick (default 1 Hz, up to 20 Hz). Today these changes flow through the regular history/undo system. That breaks several things at once: the undo stack fills with non-user changes, the history scrubber drowns in tick entries, and in group documents with multiple users editing the same document, conflict chances increase with all of these entries.

This spec proposes that **producer-emitted entries are ordinary history entries with a `background: true` flag**, plus:

- A producer-side **runner lock** (one runner per producer source) so a given producer source only emits from one client at a time.
- An **asymmetric conflict-resolution rule**: in scope-overlap conflicts between a user entry and a background entry, the user entry always wins regardless of `(serverTimestamp, id)`.
- A **producer notification hook** invoked when a background entry the producer emitted is reverted, so the producer can stop, heal, or ignore.
- **Skip-by-default scrubber and undo-exclusion** for background entries.
- A separate **`producedAt`** timestamp on each background entry for replay-fidelity playback (distinct from the canonical-ordering `serverTimestamp`).

The first consumer is the dataflow tile. The framework is reusable for any future tile whose state is driven by timers or external services.

## Goals

1. Allow group documents containing a dataflow tile to function correctly while the tile is running, without continuously rolling back other users' edits.
2. Keep tick-level changes out of the undo stack and visually distinguish them in the history scrubber.
3. Preserve durability and replay: teachers and researchers can scrub through both user and background entries at original timing.
4. Provide a reusable mechanism for any tile that produces non-user document changes, including non-deterministic external-data tiles in the future.
5. Preserve consumer contracts. Tiles that read from `SharedDataSet` or `SharedVariables` (tables, graphs, diagram viewers) should not need to know about the background flag — they read the same model paths they read today.

## Non-goals

- **Separate Firestore collection or transport.** Background entries live in the same collection and flow through the same listener and state machine as user entries. A future RTDB upgrade for live tick delivery is an optimization, not part of MVP.
- **Multiple simultaneous runners for the same producer source.** One client runs a given producer source at a time. Multiple users running *different* sources — different tiles, or different sub-producers within the same tile — is fine.
- **Local prediction on watchers.** Game-engine-style local-simulate-and-reconcile is not required.
- **Tile-locking.** This design assumes the current plan direction (no per-tile locks) — [GD-8: Tile Locking](group-docs-plan.md#gd-8-tile-locking-held-in-reserve) is held in reserve, with [GD-11: Tile Hardening](group-docs-plan.md#gd-11-tile-hardening-as-needed) as the active path.

## Scope

The spec is two-tier:

- **Concrete**: dataflow tile. Names, paths, model surfaces, and migration are specified for dataflow.
- **Conceptual**: a general-purpose background-entry mechanism that any tile with non-user document changes can use. Other tiles' integrations are noted as future stories that would reuse the same machinery; this spec does not design them in detail.

## Background and motivation

The full context for group documents lives in [group-docs-brainstorm.md](group-docs-brainstorm.md) and [group-docs-plan.md](group-docs-plan.md). Briefly:

- [GD-20: Background Entries (DataFlow)](group-docs-plan.md#gd-20-background-entries-dataflow) is the plan slot for this work. It frames dataflow's tick-rate history entries as the blocker for group documents containing a running dataflow tile.
- [CLUE-379](https://concord-consortium.atlassian.net/browse/CLUE-379) is the SPIKE ticket allocated for "Run-time state for History/Group Synch": separate runtime state from setup state. This spec is the design that work informed.

Even outside group documents, dataflow's current design has issues this spec addresses:

- Tick changes are wrapped with `withoutUndo()` in some places but still appear in the history scrubber as if they were user actions.
- Changes are recorded patch-by-patch into the chain, contributing to history-entry bloat for documents that have run dataflow for any length of time.

### Why a runner lock is necessary

Even though transaction-free history lets concurrent writers append without contention, a single-runner model is still needed for any tile that produces high-frequency state. If every client running the same dataflow tile emitted its own tick stream:

- Write rate would scale by N clients (each producing 1–20 entries/sec).
- All N streams would touch the same scopes (same node's recent-values, same dataset cases), producing continuous scope-overlap conflicts the receive-side state machine has to resolve every tick.
- The "winner" picked by `(serverTimestamp, id)` would be whichever client's clock-write happened to land first — semantically arbitrary, since the streams represent the same intent.

The lock collapses this to a single authoritative emitter per producer source: one stream, no spurious conflicts, and a single client that the notification hook (§ 5) can address when something needs to stop or heal.

## Concept

### One channel, two flavors

The transaction-free history design provides:

- A multi-parent DAG of entries with `parents` field.
- Append-only writes; canonical order via `(serverTimestamp, id)`.
- Scope-overlap conflict detection against the `concurrent(e)` set.
- Loser entries marked with `reverted: true`; winners apply.

A background entry is just a history entry with `background: true`. It uses the same DAG, the same canonical ordering, the same conflict detection, and the same Firestore collection. The flag triggers four behavioral differences:

| | User entry | Background entry |
|---|---|---|
| Undoable | Yes | No |
| Conflict rule vs. user entry | Standard `(timestamp, id)` | **User always wins** |
| Scrubber | Primary track | Skip-by-default; play-through at original timing |
| Producer | Any client | Exactly one runner per producer source |
| Replay timing | Canonical order | `producedAt` deltas during play-through |

Because background entries participate in the DAG with `parents` like any other entry, **causality between channels is encoded by `parents` directly** — no separate causality-token mechanism is needed. A tick emitted while the runner has applied user entries U1 and U2 lists those (or their descendants) in its `parents`, and the receive-side state machine handles ordering naturally.

### Terminology

- **User entry**: a history entry produced by direct user activation. `background: false` (or absent).
- **Background entry**: a history entry produced by code (timer, external service). `background: true`. The user-vs-background distinction parallels the browser DOM's [`Event.isTrusted`](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted) flag, which is `true` on events dispatched by direct user activation (a real click, keypress, etc.) and `false` on events synthesized by code (`element.click()`, `dispatchEvent()`). Same idea here: the flag distinguishes "this came from a person" from "this came from code running on a person's behalf."
- **Producer source**: an identifiable unit that produces background entries, scoped as `(producerTileId, producerId)`. A simple tile has one source per tile (with `producerId === null`). A tile that decomposes into independent producers — e.g., a dataflow tile with a sensor port and a simulation engine — has one source per producer. Each source has its own runner lock.
- **Runner**: the client currently holding the lock for a particular producer source. Only the runner emits background entries for that source. A single client can be runner for some sources and watcher for others, even within the same tile.
- **Watcher**: any other client. Consumes background entries via the same Firestore listener it uses for user entries.

### Qualification rules

A patch belongs to a background entry if and only if **both** of:

1. It's produced inside an MST action whose author marked it `asBackground()`.
2. The producing client currently holds the runner lock for the `(producerTileId, producerId)` passed to `asBackground()`.

**If condition 1 fails** (the action is unmarked), the patch is an ordinary user-channel patch. This is normal and not an error — most actions in the codebase don't produce background changes.

**If condition 2 fails** (the action *is* marked but the calling client doesn't hold the lock, or the `producerTileId` doesn't resolve), this is a developer bug. The framework throws and surfaces a visible dev error rather than silently routing the patches to the user channel. Silent fallback hides bugs that would otherwise show up as a tile producing data into the wrong stream or a producer running without authority. See § 1 for details on the error behavior.

**Path scoping is not enforced at MVP.** A producer could in principle modify any model path; the framework doesn't validate that the patches stay within "the producer's tile" or related shared models. This is intentional: producers legitimately cause cascading patches via reactions in other tiles (e.g., an auto-axis update on a linked graph that fires as part of a tick action), and a clean enforcement rule would have to follow those reactive chains. A future declarative `backgroundPaths` mechanism (see § Open problems) is the better long-term shape; we don't ship a half-measure first.

### What maps to what for dataflow

- **Background entries**: per-node recent-values updates; appended cases to `SharedDataSet` while `isRecording` is true; output-variable updates pushed to `SharedVariables` during a tick; auto-axis updates on linked graphs that happen as part of the tick action.
- **User entries**: program graph edits (add/remove/connect nodes); `programDataRate` changes; digital-twin control changes; toggling `isRecording`; `resetRecording`; manual axis drags; tile addition/deletion; everything else.

## Detailed design

### 1. Tagging actions as background-producing

Add a function parallel to `withoutUndo()`. Unlike `withoutUndo()`, it requires arguments identifying the producer:

```ts
// In any MST action that produces background changes:
asBackground({
  producerTileId: string,             // required — which tile owns this action
  producerId?: string | null,         // optional — sub-producer within the tile; null/omitted = the tile's single producer
});
```

`producerTileId` is required because the tree-monitor cannot otherwise determine which tile (and therefore which runner-lock and which producer) the action belongs to — actions are written against the model tree, which doesn't carry that affiliation back to the call site.

`producerId` is optional. Most tiles have a single logical producer per tile and can omit it; the framework normalizes omission to `null` and the tile holds one `(producerTileId, null)` lock. Tiles that decompose into independent producers — e.g., a dataflow tile whose sensor port reads hardware on one client while its simulation engine runs on another — pass distinct `producerId` strings, and each producer holds its own lock (§ 3).

`null` (rather than `undefined` or a literal `"default"` string) is the canonical "no sub-producer" value because:

- Firestore rejects `undefined` field values.
- A literal `"default"` string would collide with any tile that wants to use that name for a real sub-producer.
- MST's `types.maybeNull(types.string)` matches this directly and is already conventional in the codebase.

Calling this in an action body:

1. Sets `CallEnv.background = true` (new flag alongside `undoable`).
2. Records `producerTileId` and `producerId` (normalized to `null` if omitted) in `CallEnv` for the tree-monitor to read.
3. Implies `undoable = false` — background entries are never in the undo stack by definition; authors don't call both.

Same child-action handling as `withoutUndo()`: warn by default if called from a child action; accept `asBackground({ producerTileId, unlessChildAction: true })` to ignore the tag in that case.

#### Qualification errors

At the moment of the call, the tree-monitor verifies that:

- `producerTileId` resolves to an actual tile in the current document.
- The calling client currently holds the runner lock for `(producerTileId, producerId)`.

If either check fails, this is a developer bug — the producing code is not where it claims to be. The framework throws a `BackgroundQualificationError` describing which check failed and from which call site, and surfaces it via the same dev-mode UI used for other developer errors (e.g., a console error plus a visible banner in dev/qa builds). The action rolls back; the patches do not flow to either channel.

Why throw rather than silent fallback to the user channel: silent fallback would route producer-emitted patches into the user-channel stream, where they'd be undoable, would participate in conflict resolution as if the user authored them, and would show up in the scrubber as user actions. That kind of silent misrouting is the exact class of bug the producer separation exists to prevent. A loud failure surfaces it during development; in production, the rolled-back action surfaces as visibly broken tile behavior, which is also a useful signal.

Path scoping is not enforced (see § Concept — Qualification rules). Producers can write to any path the marked action reaches; tile-author convention is the de facto rule until a declarative `backgroundPaths` mechanism is designed (§ Open problems).

### 2. Tree-monitor: minimal changes

Today the tree-monitor builds one entry per root action. With transaction-free history that already produces multi-parent entries with `serverTimestamp` and `uid` (user id). For background entries the tree-monitor adds:

- `background: true`.
- `producedAt` (a `Date.now()` value from the runner) — distinct from `serverTimestamp`. Used for replay-fidelity playback.
- `producerTileId` — read from `CallEnv` (set by the `asBackground({ producerTileId })` call). Identifies the tile that produced the entry.
- `producerId` — read from `CallEnv`. Always present on the entry (never `undefined`); `null` when the tile has only one producer; a string when the entry is from a named sub-producer.
- `runnerSessionId` — the runner's session id at the moment of emission. The tree-monitor looks this up from the local lock state for `producerTileId`. Matches the `sessionId` field on the runner-lock document (§ 3).

It also skips the undo and redo stacks for background entries.

Everything else — `parents`, append-only Firestore write, the receive-side state machine on watchers — is unchanged from the user-channel path.

#### Why these identification fields

`uid` alone isn't sufficient to identify the producer instance on the runner client because:

- A single user can open the same group document in multiple windows/tabs. Same `uid`, different runner sessions. `runnerSessionId` disambiguates these.
- A single client can run multiple producer tiles (multiple dataflow tiles in the same document). Same `runnerSessionId`, different tiles. `producerTileId` disambiguates these.
- A single tile can have multiple sub-producers running in parallel (rare; tile-specific). `producerId` disambiguates these when non-null.

The tuple `(uid, runnerSessionId, producerTileId, producerId)` uniquely identifies a producer instance and is what the notification hook (§ 5) uses to route reverts back to the right producer. It's also useful for replay fidelity (distinguishing "user A's run" from "user B's run" when the same tile was run sequentially) and for debugging (correlating entries to lock acquisitions in RTDB).

#### Are these used in conflict resolution?

No — conflict resolution remains scope-overlap-based with the asymmetric user-wins rule (§ 4). The identification fields are not consulted by the receive-side state machine when picking a winner.

There are policy choices these fields *could* enable in the future (e.g., "drop entries from a runner session that no longer holds the lock") but those would be apply-time filters, not conflict-resolution rules, and are not part of MVP. If a future need surfaces, the fields are already on the entry.

### 3. Producer authority — the runner lock

#### Lock scope

One lock per `(producerTileId, producerId)` pair within a document. Tiles that don't decompose into sub-producers hold a single lock at `(producerTileId, null)` and behave as if there's just one lock per tile. Tiles that decompose into multiple producers — e.g., a sensor producer (physically tied to whichever client has the hardware attached) and a simulation-engine producer (compute-only, runnable on any client) — hold one lock per producer, and those locks may be held by different clients.

This lets the framework support deployments like "client A's sensor feeds into client B's simulation engine" without prescribing how the tile's UI exposes that split. Note: this deployment also depends on a future cross-tile-merging framework feature; see § Open problems.

#### Producer registration

Each producer the tile uses is registered with the framework so its lock can be acquired and managed. Registration happens at three points in a tile's lifecycle:

1. **Document load** — when the tile is hydrated from saved state, its declared producers register based on the model's existing configuration (e.g., a dataflow tile with one engine producer plus one producer per configured sensor port).
2. **Tile addition** — when a new tile is created in the document, its producers register as part of the tile's mount path.
3. **Dynamic addition** — when the user changes tile configuration during a session in a way that adds a producer (e.g., adding a sensor port to a running dataflow tile), the new producer registers and attempts to acquire its lock at that moment.

Symmetrically, producers unregister when removed (sensor port removed, tile deleted) and their locks are released.

Each registered producer attempts to acquire its lock independently. Lock acquisition does not block document load or tile rendering; producers fall back to watcher behavior until they hold the lock.

#### Lock storage

Firebase RTDB. RTDB is the right tool here because:
- Presence/disconnect handling is built in (`onDisconnect()` clears the lock).
- Fast acquisition and release.
- Concurrent transactions on a single child are well-supported.

A lock document has shape:

```
/group-docs/<documentId>/runner-locks/<producerTileId>/<producerIdPathSegment>
  {
    runnerId: string,         // client/session id
    runnerUserId: string,     // user account id
    acquiredAt: number,       // epoch ms
    sessionId: string,        // monotonic per acquisition
  }
```

`<producerIdPathSegment>` is the producerId string when non-null. RTDB paths require non-empty string segments, so when `producerId` is `null` (single-producer tiles) the framework uses a reserved sentinel path segment for storage. The reserved name should be one no real producer can collide with — e.g., a leading-underscore form like `_default_` — and is an internal storage-layer detail. The entry itself stores `producerId: null` regardless.

#### Acquisition

Each registered producer on each client, if not in pure-read mode, attempts to acquire its lock via RTDB transaction:
- If the lock is empty, write our id and proceed as runner for that producer.
- If the lock is held by another live client, become a watcher for that producer — receive background entries from it via the normal Firestore listener, do not run that producer locally.

A single client can simultaneously be runner for some of a tile's producers and watcher for others.

**Pure-read mode** here means a client viewing the document without producer authority — for example, a teacher reviewing a group's work read-only, or any client whose user role doesn't permit live editing. Pure-read clients do not attempt lock acquisition for any producer; they consume the entry stream as watchers regardless of lock state.

#### Implicit transfer on disconnect

When a runner disconnects, RTDB's `onDisconnect()` clears the runner's locks. Other clients each retry acquisition periodically (also triggered by RTDB notification on the lock node clearing). First retry to win becomes the new runner. Each producer's lock transfers independently — losing the engine producer doesn't affect who runs the sensor producer.

#### Recording across handoffs

`isRecording` is a user-action flag in the document model (not in the lock). When a runner changes mid-recording, the new runner observes `isRecording === true` on its existing model state and continues appending cases. Recording is a session at the document level, not at the runner level; handoff is transparent to recording.

#### Edge case: brief overlap

Between disconnect detection and lock release, a runner might still be emitting in-flight ticks that get persisted. The new runner for that producer starts emitting concurrently. Watchers receive both. With `producedAt` ordering for replay and the asymmetric conflict rule for live state, brief overlap settles at the next tick.

#### UI/UX is a tile-design concern

How a tile exposes "who's running which producer" to the user, and what controls like "stop dataflow" mean for split-producer tiles, are tile-design choices outside this spec. The framework supports the split; the tile decides how to surface it.

### 4. Asymmetric conflict resolution: user always wins

The transaction-free design's standard conflict rule is: lower `(serverTimestamp, id)` wins, loser gets `reverted: true`.

For conflicts between a user entry and a background entry, this design overrides the standard rule: **the user entry always wins, regardless of timestamps**. The background entry is the loser.

Why: a runner could emit a tick referencing some node milliseconds before the user deletes that node. Both writes succeed; canonical timestamps could go either way depending on Firestore latency. Without the asymmetric rule, the tick could win and revert the user's deliberate delete. The asymmetric rule encodes "user intent obsoletes producer state" as a structural property.

Implementation: in the conflict-resolution step of the receive-side state machine, when comparing `e` and `c` for a winner:

- If `e.background !== c.background`: the user-entry one wins.
- Else (both user, or both background): fall back to lower `(serverTimestamp, id)`.

Background-vs-background conflicts fall back to standard timestamp ordering. These can arise in two ways: two runners on entirely separate sources whose scopes happen to overlap (rare), or two sub-producers within the *same* tile whose scopes overlap (more likely once split-producer tiles exist — e.g., a sensor producer and an engine producer in the same dataflow tile both writing to a `SharedVariable`). The latter case is exactly what [GD-14: Intra-Tile Merging](group-docs-plan.md) addresses; until that lands, split-producer deployments will see one of the two writers' entries reverted on every overlap.

### 5. Producer notification hook

When a background entry is determined to be a loser (typically because of an asymmetric loss to a user entry), the receive-side state machine consults the entry's `(uid, runnerSessionId, producerTileId, producerId)` tuple to decide whether to fire a notification locally:

- If `(uid, runnerSessionId)` matches the current client's user/session and a producer for `(producerTileId, producerId)` is registered locally, invoke that producer's hook.
- Otherwise, no local action — watchers don't fire the hook for entries they didn't produce.

The hook signature:

```ts
producer.onBackgroundEntryReverted({
  entryId,
  scope,
  conflictingUserEntry,
});
```

The producer decides:

- **Stop** — e.g., "the program node I was updating no longer exists, halt this stream."
- **Heal** — e.g., "re-create the structure I depend on, then continue."
- **Ignore** — e.g., "that recent-value tick was wrong; the next tick will overwrite it anyway."

This is a per-producer policy hook, not framework logic.

#### Handoff edge case

If the runner that emitted entry `E` disconnected before the conflict was resolved, the new runner now holds the lock. `E.runnerSessionId` no longer matches the current session, so the new runner does NOT receive the hook for `E`. This is intentional — the new runner re-evaluates state from scratch on acquiring the lock and produces its own forward-going entries; it doesn't need to "heal" something the previous session emitted. If the structure `E` referenced is genuinely missing, the new runner's first emission will conflict the same way and trigger the hook then.

### 6. Best-effort patch apply (defense-in-depth)

With proper scope-overlap conflict detection, a "patch target missing" case usually shows up first as a conflict — the entry that removed the target had overlapping scope and resolution proceeded normally. The remaining cases for missing-target are runner bugs and the brief overlap window during runner handoff.

For background entries, the patch-apply step should still skip-on-failure rather than throw:

- For each patch in a background entry being applied, attempt `applyPatch`.
- If the patch's path doesn't resolve, log at dev level and continue with the next patch.

This is a safety net, not the primary mechanism. User-entry apply remains strictly consistent (any apply failure is a real bug).

### 7. Cross-channel interaction — sequential overlap

User edits a background-produced field, runner overwrites it on the next tick. Last-writer-wins via standard canonical order (no scope conflict because the runner's tick has the user's edit in its `parents`). Documented as expected behavior — live producer data reflects the producer.

### 8. Reactive derivations (per-tile audit, not framework)

Tiles that store derived state and update it via reactions (e.g., a stored auto-axis range that recomputes on dataset change) need per-tile fixes:

1. **Preferred**: convert the derived field to a computed view. Manual overrides become a separate `axisMode: "auto" | "manual"` + `manualAxisValue` pair.
2. **Fallback**: if storage is unavoidable, gate the reaction's action to fire only on the runner.

Either fix avoids every client emitting a duplicate derivation entry.

This is a per-tile hardening item, scheduled alongside [GD-11](group-docs-plan.md). Catalogue the affected tiles during that phase; fix on the path the design uncovers.

### 9. Persistence, cost, and future transport

Background entries live in the same Firestore collection as user entries:

```
firestore: users/<userId>/documents/<docId>/historyEntries
```

(Or, for group docs, the analogous group-doc paths.) The `background: true` field distinguishes them at query/filter time.

**Cost envelope**: at the default 1 Hz, one running dataflow generates ~3,600 entries/hour. At 20 Hz worst case, ~72k/hour per running tile, ~1M/hour for a class of 15. Firestore can handle this. Cost at $0.18/100k writes is bounded around $1.80/hour at absolute worst; in realistic usage (mostly 1 Hz, partial classroom running concurrently) much lower. Acceptable for MVP.

**Future transport upgrade**: if write rate, listener latency, or Firestore cost becomes a problem, a future story can split background entries to RTDB for live + Firestore for durable. Because the entry shape and DAG semantics are unchanged, the upgrade is purely transport-level. Out of scope for this design.

**Compaction**: append-only entries grow over time. The current `kMaxRecordedValues` cap on dataset cases (10000) and bounded node recent-values arrays bound the most disk-hungry data. Long-term compaction (snapshots + truncation, retention policies) is a future story.

### 10. Cross-tile data flow (digital twin, sensors)

A digital twin tile sends inputs into a dataflow program through `SharedVariables`, and reads outputs from the same. For group documents:

- A digital-twin user interaction (control change, slider drag) is a **user entry** (no `asBackground()` tag). The engine producer observes the variable change via normal MST reactivity and integrates it into the next tick.
- Outputs from the dataflow tile (variable updates produced inside a tick) are **background entries** emitted by the engine producer. Watchers see the values update via the same Firestore listener that delivers user entries.

The digital twin itself doesn't hold a producer lock — its user interactions are user entries from whichever client made them. Latency on user→engine is governed by user-entry commit latency; latency on engine→watcher is governed by listener latency. Both are tens to hundreds of milliseconds in normal Firestore conditions.

**Sensors are themselves background producers**, not sources of user entries. A sensor reading is generated by code (a polling timer reading hardware), not direct user activation, so it qualifies as a background change. With per-`(producerTileId, producerId)` lock granularity (§ 3), a sensor port is its own producer with its own lock — held by whichever client has the hardware attached. The engine producer for the same tile may be on the same client or a different one, and reads sensor data via normal MST reactivity over the model state the sensor producer's entries update.

Concretely, in a dataflow tile with one sensor and one engine:
- `(producerTileId, "sensor-port-1")` lock — held by the client with the sensor attached. That client's polling code calls `asBackground({ producerTileId, producerId: "sensor-port-1" })` to emit each reading.
- `(producerTileId, "engine")` lock — held by whichever client became runner. That client's tick code calls `asBackground({ producerTileId, producerId: "engine" })`.

Watchers (and the engine client, if different from the sensor client) receive the sensor's background entries via the Firestore listener and see them as ordinary model updates.

> **Caveat — split deployment requires GD-14.** With sensor and engine on *different* clients, their entries can overlap in scope (e.g., both writing to a `SharedVariable` representing the sensor reading and the engine's downstream computation). Under the current asymmetric conflict rule, background-vs-background overlap falls back to `(serverTimestamp, id)` and one writer's entry gets reverted — exactly the wrong behavior for legitimately concurrent producers updating different fields of the same model. [GD-14: Intra-Tile Merging](group-docs-plan.md) is the framework feature that resolves this. Until it lands, split-producer dataflow is a useful conceptual case to design against, but should be expected to misbehave when sensor and engine are split across clients.

## UX

### History scrubber

- **Default**: scrubber jumps between user entries. Background entries are not represented as scrubber stops by default.
- **Replay button**: when the user clicks Play between two user-entry markers, the scrubber traverses any background entries in that interval at their original timing (`producedAt` deltas). A speed control offers 0.5×/1×/2×/4× playback.
- **Scrub mode**: dragging the scrubber within the interval scrubs through background entries at index level (drag corresponds to position-in-interval, not real time).
- **Optional show-runtime view**: a toggle reveals background entries inline as densely-packed marks between user entries, useful for diagnosis.
- **Reverted entries**: the scrubber respects `reverted: true` for background entries the same way it does for user entries (skip apply; optionally show a marker).

The scrubber UI is not architected in this spec; it is a UX work item with these behaviors as requirements.

## Generalization to other tiles

The framework is reusable. A future tile (e.g., one that streams data from an external service) integrates by:

1. Tagging its producing actions with `asBackground({ producerTileId, producerId? })`.
2. Registering its producer source(s) so each can acquire its own runner lock.
3. Implementing `onBackgroundEntryReverted` to handle stop/heal/ignore.
4. Ensuring any reactive-derivation actions are runner-gated or converted to computed views.

The general framework does not require determinism. Non-deterministic producers (real-time external data) work the same way: only one client is the runner; that client decides what to emit; watchers receive the stream.

## Open problems

### Cascade depth on user-revert-of-background

When a user entry reverts a background entry, the transaction-free cascade rule says any later-applied entry whose scope overlaps and whose ancestry transitively includes the loser is also reverted. For dataflow ticks that all touch the same node's `recentValues`, every later tick descends from earlier ticks via `parents` AND has overlapping scope — so a single user delete could cascade-revert a long chain of dependent ticks.

In practice, the producer's `onBackgroundEntryReverted` hook stops emission once the conflict is observed, bounding cascade depth. But cascade work plus `reverted` flag writes for many entries needs measurement under load. May need a per-source cascade-depth limit if this becomes a performance issue.

### Same-runner tick ordering under timestamp ties

Same-runner ticks shouldn't conflict with each other — each tick's `parents` includes the prior tick, so they're not in each other's `concurrent()` set. This holds as long as same-runner timestamps are strictly monotonic, which is the case under transaction-free-history's per-client serial upload requirement combined with Firestore's `serverTimestamp`-ordered listener delivery.

The residual edge case is **timestamp ties**: two same-runner entries committing within the resolution of `serverTimestamp`, or sharing a single timestamp under future batched uploads. In a tie, the `(timestamp, id)` tiebreaker falls to the entry id, which today is a random UUID — same-runner tick N+1 could end up ordered before tick N by id hash. That breaks the "later ticks supersede earlier ticks" invariant.

Mitigation when this becomes practical: switch to sortable entry ids (ULID / KSUID) or add explicit per-session sequence fields, as already discussed in transaction-free-history's "future optimization: batching" section. The fix is at the user-channel framework level, not specific to background entries — but tick rate makes background entries the most likely place to first hit this.

### Declarative `backgroundPaths` enforcement

A future safeguard is to declare on each MST model the set of paths that may be modified by background actions, and have the tree-monitor enforce that constraint in dev mode. This would catch regressions where a refactor accidentally extends a background action's reach. Skipped for MVP because the per-tile audit and convention give us the needed discipline; revisit if regressions surface.

### Per-tile reactive-derivation audit

Stored derived state that updates via reactions causes duplicate emissions across all clients. This is a per-tile design problem (not addressable generically) that should be folded into [GD-11 Tile Hardening](group-docs-plan.md). Scope: catalogue affected tiles and choose computed-view or runner-gating per case.

### Cross-client split-producer requires GD-14 (Intra-Tile Merging)

The split-producer deployment model (§ 10 — sensor on one client, engine on another) is conceptually supported by per-`(producerTileId, producerId)` lock granularity, but the conflict-resolution machinery isn't yet ready for it. When two background producers within the same tile produce entries with overlapping scope (e.g., a `SharedVariable` written by both the sensor producer and the engine producer), the standard `(serverTimestamp, id)` rule reverts one of them — even when the changes are to different fields and could legitimately coexist.

The fix is [GD-14: Intra-Tile Merging](group-docs-plan.md), which extends GD-10's shared-model merging machinery to cover non-shared tile content. Until that feature lands:

- Single-client split-producer (sensor and engine both on the same client) works fine — no concurrent-write overlap, just normal MST reactivity within one process.
- Cross-client split-producer (sensor on A, engine on B) is conceptually expressible in the framework but should be expected to lose entries on every overlap.

This spec does not block on GD-14 for MVP; the only consumer at MVP is dataflow-on-one-client, and the producerId/lock machinery is in place so that cross-client deployment becomes possible the moment GD-14 lands.

### `producedAt` drift across runner handoff

`producedAt` is `Date.now()` from the runner's clock. When a producer hands off to a new runner mid-recording, the new runner's `producedAt` values come from a different client clock and could jump backward or forward in absolute time relative to the previous runner's last emissions. Replay timing within an interval mostly relies on deltas between consecutive entries from the same runner, so the within-runner experience is fine; the question is what happens at the handoff boundary.

Punted for MVP: implement the simple case (use `producedAt` as-is, accept the discontinuity at handoff), measure during initial implementation, and revisit if scrubber playback behavior is bad enough to warrant smoothing logic (e.g., normalizing per-runner segments, or using `serverTimestamp` to order across handoffs and `producedAt` only within a runner segment).

## Migration and backward compatibility

### Existing dataflow documents

Existing documents have node recent-values, recorded dataset cases, and tick-related changes recorded as ordinary history entries (no `background` flag). These existing documents must continue to load and replay.

Migration approach:

- The shape of `DataflowContentModel` does not change. Recent-values and recorded cases stay where they are.
- Tagging is action-level. Untagged historical actions remain as user entries; newly-emitted tick actions get `background: true`.
- The history scrubber retains the ability to play back full history including historical tick entries from before the migration (they appear as user entries because they were untagged at the time).
- Existing documents get the benefit of cleaner undo/scrubber behavior only for *new* runs after the migration.

No data migration of existing entries is required.

### Tile authoring

Existing dataflow tile code that calls `withoutUndo()` inside tick actions migrates to `asBackground()`. The tree-monitor and runner-lock integration is a code change in the dataflow tile, not a model migration.

### Other tiles

No other tile's behavior changes. Tiles that read `SharedDataSet.cases` or `SharedVariables` see the same model state they see today; the source of changes (user vs. background) is invisible to them.

## Testing

### Unit and integration

- `asBackground({ producerTileId, producerId? })` correctly tags actions; tree-monitor stamps `background: true`, `producedAt`, `producerTileId`, `producerId`, `runnerSessionId`; child-action behavior matches `withoutUndo()`'s.
- Qualification errors throw and surface via dev UI when `producerTileId` doesn't resolve or the lock isn't held.
- Asymmetric conflict resolution: user wins regardless of `(timestamp, id)`; background-vs-background falls back to standard rule.
- Producer notification hook fires when a runner-emitted entry is reverted.
- Best-effort patch apply: per-patch skip on missing target, no rollback, dev-mode logging.
- Runner-lock acquisition, transfer on disconnect, brief-overlap convergence.
- Producer registration on document load, on tile addition, and on dynamic addition (sensor port added at runtime).

### Multi-client integration

- Two-client tests in the document editor using the existing GD-3 pause/resume tooling.
- User typing in text tile while another is running dataflow → text typing is responsive (no fork-detection rollback storm; no chain contention because of transaction-free history).
- User adds notes to a background-produced case; another user deletes the dataset; convergence holds and producer is notified to stop.

### Stress

- 20 Hz tick rate × multi-client with active user editing.
- Cascade-depth measurement: how many background entries get reverted when a user removes a structure mid-stream.
- Auto-revert stress mode (GD-13) extended to runner-lock handoff and asymmetric-conflict edge cases.

### Replay

- Scrub through a recorded session with mixed user and background entries.
- Speed-control playback (0.5× / 1× / 2× / 4×) using `producedAt` deltas.
- Reverted background entries are skipped during playback, matching live behavior.
- Initial-load case: open a document with reverted-but-not-yet-flag-written background entries from a previous session, verify the receive-side state machine writes the flag and converges to the correct state.

## Implementation phasing

Suggested phasing:

1. **Phase 1: Tagging + tree-monitor flag** — `asBackground({ producerTileId, producerId? })` API, tree-monitor stamps `background`/`producedAt`/`producerTileId`/`producerId`/`runnerSessionId`. Single-client tests verify tagged entries are flagged correctly, and that calls failing qualification (unresolved `producerTileId`, no lock held) throw `BackgroundQualificationError` rather than silently routing to the user channel.
2. **Phase 2: Asymmetric conflict resolution** — extend the receive-side state machine's conflict rule. Multi-client tests verify user always wins vs. background.
3. **Phase 3: Runner lock** — RTDB lock acquisition, transfer, watcher-mode gating. Multi-client running stops being broken (only one runner emits per source).
4. **Phase 4: Producer notification hook** — `onBackgroundEntryReverted` callback wired into dataflow; dataflow's policy implemented (stop / heal / ignore per case).
5. **Phase 5: Best-effort apply** — per-patch skip in the apply path for background entries. Production code in the dataflow tile defended against missing targets.
6. **Phase 6: Scrubber UX** — skip-by-default, real-time playback within interval, speed control, reverted-entry handling.
7. **Phase 7: Migration shake-out** — verify existing documents load and replay; verify newly-emitted entries are properly flagged. End-to-end stress with GD-13 auto-revert.

The implementation plan derived from this spec will detail each phase.

## Relation to existing GD-* work

- **Transaction-free history design** — prerequisite. This design is unimplementable without that one.
- **Settled-state doc saves design** — prerequisite of transaction-free history; transitively required.
- **GD-9 / GD-10 (Document and Shared Model Merging)** — independent at MVP; share scope-overlap analysis with transaction-free history.
- **GD-14 (Intra-Tile Merging)** — prerequisite for cross-client split-producer deployments. Not needed for MVP (dataflow on a single client); the producerId machinery is in place so cross-client deployment becomes viable the moment GD-14 lands.
- **GD-11 (Tile Hardening)** — this spec's per-tile reactive-derivation audit feeds into GD-11.
- **GD-12 (Debug Re-render Controls)** — useful when shaking out background-entry render bugs.
- **GD-13 (Auto-Revert Stress Mode)** — should be extended to also stress the runner-lock handoff and asymmetric-conflict edge cases.
- **CLUE-379** — this spec is the design for that ticket. The implementation plan derived from this spec is the work CLUE-379 represents.
