# Evict oldest tiles when copy/paste exceeds `maxTiles`

Date: 2026-06-18
Branch: clue-546-copy-singleton-tile

## Problem

A unit's `settings.<tileType>.maxTiles` limit currently only disables the
toolbar's "create tile" button once the limit is reached
([toolbar.tsx:162-172](../../src/components/toolbar.tsx#L162-L172)). The limit is
not enforced on the other paths that add tiles, so a user can exceed it by
copying or duplicating tiles.

## Goal

When adding tiles via copy/duplicate/paste, always allow the action, but then
remove the oldest tiles of any over-limit type until the count equals
`maxTiles`. The add + eviction must be a single undoable action. Eviction is
silent (no toast or confirmation).

## Decisions

- **Scope:** all three copy paths evict — drag-to-copy, copy-to-workspace/document,
  and duplicate-in-same-doc. (Originally drag/copy-paste only; duplicate added.)
- **Over-limit paste:** end state is exactly `maxTiles` of the type. Newly added
  tiles are the newest and are kept; if the pasted batch alone exceeds the limit,
  only the newest of the batch survive.
- **"Oldest":** document order, top-first. `getTilesOfType` already returns IDs
  in document order. No timestamp needed.
- **Notification:** none — silent eviction (singleton "newest replaces old" model).

## Architecture

All three callers route through the single `copyTiles` action in
[document-content.ts:272](../../src/models/document/document-content.ts#L272):

- `handleDragCopyTiles` (drag-copy) → `copyTiles` (line 488)
- `duplicateTiles` → `copyTiles` (line 512)
- `applyCopySpec` (copy-to-workspace/document) → `copyTiles` (line 589)

`copyTiles` is one MST action and `deleteTile` is an action on the same model,
so eviction performed inside `copyTiles` is automatically part of one undoable
entry. Because all three callers should evict, no opt-in param is needed —
eviction always runs at the end of `copyTiles`.

## Components

### 1. `getMaxTilesOfType(type)` view — base-document-content.ts

Reads the limit via `getAppConfig(self)?.getSetting("maxTiles", <group>)`,
reproducing the lower/camelCase key fallback the toolbar uses today
(`"IframeInteractive"` → `iframeinteractive` / `iframeInteractive`). Returns
`number | undefined`. `getAppConfig` is already imported and used in this file
([line 932](../../src/models/document/base-document-content.ts#L932)).

The toolbar's inline settings logic is refactored to call this view, so there is
a single source of truth for the limit.

### 2. `evictTilesOverLimit(newTileIds)` action — base-document-content.ts

For each tile type present among `newTileIds`:

- look up `getMaxTilesOfType(type)`; skip if undefined
- `current = getTilesOfType(type)` (document-ordered, top-level)
- while `current.length > max`: choose the eviction target — the oldest
  pre-existing tile first (earliest in `current` not in `newTileIds`); only once
  all pre-existing tiles are gone, sacrifice the oldest of the pasted batch. Call
  `deleteTile(targetId)` and remove it from the working list.

Eviction targets top-level tiles only, never embedded children of a just-pasted
container (e.g. a Question tile), to avoid corrupting the container.

### 3. Wire into `copyTiles` — document-content.ts

After the insertion block (~line 404) and the shared-model/annotation fix-ups,
call `self.evictTilesOverLimit(updatedTiles.map(t => t.newTileId))`.

## Testing

Unit tests in `src/models/document/document-content-tests/`:

- pasting over the limit evicts the pre-existing oldest tile(s)
- pasting a batch larger than the limit keeps only the newest of the batch
- a single undo restores both the evicted tiles and the paste
- duplicate path also evicts (new behavior)
- no `maxTiles` set → no change

## Edge cases

- No `maxTiles` for the type → current behavior preserved.
- Embedded tiles inside a pasted container are not eviction targets.
- Shared models / annotations attached to an evicted tile are cleaned up via the
  existing `deleteTile` → `willRemoveFromDocument` path.
