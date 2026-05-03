# Collaborative Text-Tile Editing Design

**Status**: No concrete design yet
**Date**: 2026-05-02
**Author**: Scott Cytacki (with Claude)
**Related**: [group-docs-plan.md § GD-21](group-docs-plan.md#gd-21-collaborative-text-tile-editing), [test-scripts/text-tile.md](test-scripts/text-tile.md)

## Problem

The text tile currently stores its content as a single serialized string field. Every keystroke batch generates a JSON patch that replaces the whole field, with three downstream costs:

- **History inflates** — every keystroke records the full text rather than the delta.
- **Merging is impossible** — any concurrent edit looks like a whole-content conflict, so [GD-14: Intra-Tile Merging](group-docs-plan.md#gd-14-intra-tile-merging) for the text tile is gated on this.
- **Remote updates disrupt the local user's UI** — when a remote change arrives, Slate re-syncs from the regenerated MST string, which resets cursor position, drops in-progress selection, and overwrites uncommitted keystrokes. Reproduction cases in [test-scripts/text-tile.md](test-scripts/text-tile.md).

The third point shapes the implementation: it's not enough to update MST and let Slate re-derive. We need the remote user's intention (insert at offset N, delete range [M, N], etc.) so we can apply the change to Slate's editor state directly without disturbing the local user's cursor and selection. Whichever fine-grained representation we land on has to carry enough intent for a Slate-aware applier to translate it into a Slate operation.

## Approaches under consideration

Three approaches under consideration, each with tradeoffs.

### Approach 1: MST-ify Slate's structure

Turn paragraphs and spans into MST nodes so JSON patches naturally target the changed node. Keeps the existing patch format (JSON Patch); the history scrubber, replay tools, and any future external tooling don't need to know anything special.

Cost: non-trivial mapping between Slate's document model and an MST tree, possible per-keystroke MST overhead at scale. Patches still need a Slate-aware applier on top to preserve cursor/selection.

### Approach 2: Custom text-specific patches

Insert/delete operations with offsets (and possibly context markers), matching what the user actually did. Smallest representational overhead, ideal for collaborative-edit semantics, and the patch format already encodes the intent the Slate applier needs.

Cost: any consumer that applies patches needs to know the custom format. Acceptable only if the format is documented and stable. CODAP uses custom patches in places but doesn't serialize history, so it doesn't face this constraint; CLUE does, so this is a real cost.

### Approach 3: Yjs + slate-yjs in an MST field

Use a [Yjs](https://github.com/yjs/yjs) document as the underlying CRDT representation of the text content, with [slate-yjs](https://github.com/BitPhinix/slate-yjs) bridging Slate to Yjs. Hold the Yjs document inside an MST field on the tile.

**Serialization.** When the MST field is serialized (for snapshots, save, replay), use Yjs's built-in compaction to emit the full document state as a single binary blob. Loading reverses this: deserialize the blob back into a Yjs document inside the MST field.

**Edit flow.** Local user edits land in Slate; slate-yjs converts each Slate operation into a Yjs transaction, which the Yjs document applies and then notifies its registered change listeners. The MST integration registers a listener on the Yjs document and:

- **If the change is happening inside an MST action**, wait for the Yjs transaction to finish, then attach the Yjs changeset (the binary update Yjs would normally send to a peer) as a new patch type on the current history entry.
- **If the change is happening outside an MST action**, throw an error — initially. We may need to relax this later to avoid forking slate-yjs; the alternative is to wrap such Yjs operations in a synthetic MST action so they always have a history entry to attach to.

**Remote update flow.** When a remote history entry arrives carrying a Yjs-changeset patch, the patch is applied by feeding the binary update back into the local Yjs document. Yjs merges using its CRDT semantics; slate-yjs propagates the merge into Slate's editor state, which preserves the local user's cursor and selection. No Slate re-derivation from MST is needed.

**Conflict detection.** Conflict detection is inherited from the existing scope-based merge (GD-9): because every Yjs change is captured inside an MST action, the action as a whole goes through the standard conflict check. If the same MST action also touches non-text state — e.g., the text editor removes a variable chip in response to another tile deleting that variable — and that other change conflicts with a remote entry, the entire action (including the Yjs changeset) is rolled back as a unit. The Yjs side doesn't need its own conflict-detection layer.

**Rollback and inverses.** Rolling back the Yjs changeset requires applying an inverse Yjs update to the local Y.Doc. The forward update doesn't literally contain its own inverse: it records new items (with IDs) and tombstones for deletes, and Yjs's GC runs at the end of every transaction by default — dropping the original content of tombstoned items unless an UndoManager keeps them alive. So we can't reliably compute the inverse from the post-update document state alone. Three viable strategies:

- **Capture an inverse at write time** using Yjs's UndoManager (or equivalent) and store it alongside the forward changeset on the patch. Bulletproof; roughly doubles the patch size for that change.
- **Disable GC** on tile-level Y.Docs (`gc: false`). Keeps deleted content available indefinitely so the inverse can be computed on demand from the document. Cost: the doc's internal storage grows; plausible if per-tile text stays small.
- **Compute the inverse synchronously** inside the same Yjs transaction that applies the forward update. Cheapest in storage but ties our merge logic to Yjs's transaction lifecycle.

Capturing the inverse at write time is probably the safest default; the others are optimizations to consider if patch size becomes a problem.

**Cost.** New dependency stack (Yjs + slate-yjs) and a new patch type that the history scrubber, replay tools, and any external consumers need to understand. Yjs updates are binary, so anything that inspects history textually loses visibility. The MST-action-boundary detection has corner cases — slate-yjs may emit changes outside any obvious MST action — that need careful handling.

**Upside.** Collaborative-text semantics, including conflict-free concurrent edits at the same offset, come essentially for free; CRDT merge is what Yjs is built for. Approaches 1 and 2 need additional merge logic on top of the patch representation. Cursor and selection preservation is also handled directly by slate-yjs.

### Note on other CRDT/OT libraries

Yjs is one specific way to integrate a CRDT into the Slate + MST stack. Other libraries (Automerge, ShareDB) could be considered if Yjs proves unworkable. They would face similar tradeoffs to Approach 3.

## Payoff and applicability

This work pays off before any collaboration lands: single-user history size shrinks and undo entries get cheaper. For collaborative text editing it's a sibling enabler of [GD-17: Type-Aware Merge Delegation](group-docs-plan.md#gd-17-type-aware-merge-delegation) — GD-17 is the mechanism for tile-specific merge logic; without GD-21 the text tile has no useful sub-paths to merge over, so GD-14 for the text tile is gated on this.

The patch-size and merging benefits likely apply elsewhere that embedded text is stored in serialized form (e.g., Drawing tile text-on-object, Question tile prompts, Geometry labels) — worth a quick survey when this lands. The cursor-preservation work is text-tile specific (Slate); other consumers would get only the patch-size and merging wins.
