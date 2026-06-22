# Evict Oldest Tiles on Copy/Paste Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When copying, duplicating, or pasting tiles would exceed a unit's `maxTiles` limit for a tile type, allow the action but silently remove the oldest tiles of that type (document order, top-first) until the count equals `maxTiles`, all as a single undoable action.

**Architecture:** All three copy paths (`handleDragCopyTiles`, `duplicateTiles`, `applyCopySpec`) route through the single `copyTiles` action in `document-content.ts`. We add eviction at the end of `copyTiles`, so it is always part of that one MST action (one undo entry). The limit is read from `appConfig` settings via a new shared view, replacing the toolbar's inline logic.

**Tech Stack:** TypeScript, MobX State Tree, Jest. Run jest with `--no-watchman` on this machine.

**Design doc:** `docs/plans/2026-06-18-evict-oldest-tiles-on-copy-design.md`

---

## Background for the implementer

- `getTilesOfType(type)` in [base-document-content.ts:379](../../src/models/document/base-document-content.ts#L379) returns tile IDs in document order (top-first). The earliest entry is the "oldest" tile.
- The current limit lookup lives inline in the toolbar [toolbar.tsx:162-172](../../src/components/toolbar.tsx#L162-L172). It reads `settings[lowerCaseId]` or `settings[camelCaseId]`, then `.maxTiles`. We move this into a model view.
- `getAppConfig(self)` is already imported in base-document-content.ts (used at line 932). `AppConfigModel.getSetting(key, group)` ([app-config-model.ts:139](../../src/models/stores/app-config-model.ts#L139)) returns `settings[group][key] ?? settings[key]`.
- `deleteTile(tileId)` ([base-document-content.ts:942](../../src/models/document/base-document-content.ts#L942)) is an action on the same model; it also removes embedded tiles and cleans up via `willRemoveFromDocument`.
- `copyTiles` returns `updatedTiles: IDropTileItem[]`, each having `newTileId` — the IDs of the just-added tiles.
- Tests in `src/models/document/document-content-tests/` use `setupDocumentContent(srcContent)` from `dc-test-utils.ts`, which currently creates the model with **no environment**. For settings-based tests we must pass an `appConfig` environment built with `specAppConfig` from [spec-app-config.ts](../../src/models/stores/spec-app-config.ts).

---

## Task 1: Test helper to create document content with an appConfig

**Files:**
- Modify: `src/models/document/document-content-tests/dc-test-utils.ts` (the `setupDocumentContent` function, ~line 120)

**Step 1: Add an optional appConfig argument to `setupDocumentContent`**

Replace the function body so callers can supply settings:

```typescript
import { specAppConfig } from "../../stores/spec-app-config";
import { UnitConfiguration } from "../../stores/unit-configuration";
// ... existing imports ...

export function setupDocumentContent(
  srcContent: DocumentContentSnapshotType,
  settings?: UnitConfiguration["settings"]
) {
  const appConfig = settings ? specAppConfig({ config: { settings } }) : undefined;
  const documentContent = DocumentContentModel.create(srcContent, { appConfig });

  return {
    documentContent,
    getRowLayout() {
      return getRowLayout(documentContent);
    }
  };
}
```

**Step 2: Run the existing copy tests to confirm no regression**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/dc-tile-move-copy.test.ts`
Expected: PASS (all existing tests still green; the new optional arg defaults to no env).

**Step 3: Commit**

```bash
git add src/models/document/document-content-tests/dc-test-utils.ts
git commit -m "test: allow setupDocumentContent to supply appConfig settings"
```

---

## Task 2: `getMaxTilesOfType` view on the document content model

**Files:**
- Modify: `src/models/document/base-document-content.ts` (add a view near `getTilesOfType`, ~line 379)
- Test: `src/models/document/document-content-tests/dc-max-tiles.test.ts` (new)

**Step 1: Write the failing test**

Create `src/models/document/document-content-tests/dc-max-tiles.test.ts`:

```typescript
import { mockUniqueId, setupDocumentContent } from "./dc-test-utils";
import { DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import multipleTilesExamples from "./multiple-tiles-example.json";

describe("DocumentContentModel -- maxTiles --", () => {
  const srcContent: DocumentContentSnapshotType = multipleTilesExamples.content;

  beforeEach(() => mockUniqueId());

  it("reads maxTiles from settings, case-insensitively, and is undefined when unset", () => {
    const { documentContent } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 2 }
    });
    expect(documentContent.getMaxTilesOfType("Drawing")).toBe(2);
    expect(documentContent.getMaxTilesOfType("drawing")).toBe(2);
    expect(documentContent.getMaxTilesOfType("Text")).toBeUndefined();
  });

  it("returns undefined when there is no appConfig", () => {
    const { documentContent } = setupDocumentContent(srcContent);
    expect(documentContent.getMaxTilesOfType("Drawing")).toBeUndefined();
  });
});
```

> Note: confirm `mockUniqueId` is exported from `dc-test-utils`; the copy test imports it. If a camelCase settings key is needed for a multi-word type, the view must also try the camelCase form (see Step 3).

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/dc-max-tiles.test.ts`
Expected: FAIL — `getMaxTilesOfType is not a function`.

**Step 3: Implement the view**

In `base-document-content.ts`, in the same `.views` block as `getTilesOfType` (~line 379), add:

```typescript
getMaxTilesOfType(type: string) {
  const appConfig = getAppConfig(self);
  if (!appConfig) return undefined;
  // "Diagram" → "diagram"; "IframeInteractive" → "iframeinteractive"
  const lowerCaseId = type.toLowerCase();
  // "IframeInteractive" → "iframeInteractive" (camelCase settings keys)
  const camelCaseId = type.charAt(0).toLowerCase() + type.slice(1);
  const maxTiles = appConfig.getSetting("maxTiles", lowerCaseId)
    ?? appConfig.getSetting("maxTiles", camelCaseId);
  return typeof maxTiles === "number" ? maxTiles : undefined;
},
```

`getAppConfig` is already imported at the top of this file.

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/dc-max-tiles.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/models/document/base-document-content.ts src/models/document/document-content-tests/dc-max-tiles.test.ts
git commit -m "feat: add getMaxTilesOfType view to document content"
```

---

## Task 3: Refactor the toolbar to use `getMaxTilesOfType`

**Files:**
- Modify: `src/components/toolbar.tsx:162-172`

**Step 1: Replace the inline settings logic**

Change the block at [toolbar.tsx:162-172](../../src/components/toolbar.tsx#L162-L172) to:

```typescript
    if (toolButton.isTileTool) {
      // If a limit on the number of tiles of a certain type has been specified in settings,
      // disable the related tile button when that limit is reached.
      const content = document?.content;
      const maxTilesOfType = content?.getMaxTilesOfType(toolButton.id);
      if (maxTilesOfType != null) {
        const tilesOfTypeCount = content?.getTilesOfType(toolButton.id).length || 0;
        if (tilesOfTypeCount >= maxTilesOfType) return true;
      }
    }
```

The `settings` destructure (`appConfig: { settings }` at ~line 140) may now be unused — remove it if so to satisfy lint.

**Step 2: Run type check and lint**

Run: `npm run check:types`
Expected: no new errors.
Run: `npm run lint -- src/components/toolbar.tsx`
Expected: no errors (remove unused `settings` if flagged).

**Step 3: Run the toolbar tests if present**

Run: `npm test -- --no-watchman src/components/toolbar`
Expected: PASS (or "no tests found" — acceptable, the behavior is covered by the model view test).

**Step 4: Commit**

```bash
git add src/components/toolbar.tsx
git commit -m "refactor: toolbar reads tile limit via getMaxTilesOfType"
```

---

## Task 4: `evictTilesOverLimit` action

**Files:**
- Modify: `src/models/document/base-document-content.ts` (add the action in a `.actions` block that comes *after* the one defining `deleteTile`, so it can call `self.deleteTile`)
- Test: `src/models/document/document-content-tests/dc-max-tiles.test.ts`

**Step 1: Write failing tests for eviction**

Append to `dc-max-tiles.test.ts`. These call `evictTilesOverLimit` directly with the IDs of the "new" tiles. The base document has two drawing tiles (`drawingTool1`, `drawingTool2`) and two text tiles (`textTool1`, `textTool2`) — see the layout comment in `dc-tile-move-copy.test.ts`.

```typescript
  it("evicts the oldest pre-existing tile first, keeping the new tile", () => {
    // limit 2; doc already has drawingTool1 (oldest) and drawingTool2.
    // Pretend drawingTool2 is the freshly added one — it must survive.
    const { documentContent } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 2 }
    });
    // Add a third drawing by treating drawingTool2 as "new"; now 2 existing + simulate over limit
    // Simpler: set limit to 1 and mark drawingTool2 as the new tile.
    const { documentContent: doc1 } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 1 }
    });
    doc1.evictTilesOverLimit(["drawingTool2"]);
    const remaining = doc1.getTilesOfType("Drawing");
    expect(remaining).toEqual(["drawingTool2"]); // oldest (drawingTool1) evicted, new kept
  });

  it("keeps only the newest of the batch when the batch exceeds the limit", () => {
    const { documentContent } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 1 }
    });
    // Both drawing tiles are "new"; drawingTool2 is later in document order, so newest.
    documentContent.evictTilesOverLimit(["drawingTool1", "drawingTool2"]);
    expect(documentContent.getTilesOfType("Drawing")).toEqual(["drawingTool2"]);
  });

  it("does nothing when no maxTiles is set for the type", () => {
    const { documentContent } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 1 }
    });
    const before = documentContent.getTilesOfType("Text");
    documentContent.evictTilesOverLimit(["textTool2"]);
    expect(documentContent.getTilesOfType("Text")).toEqual(before); // text has no limit
  });

  it("does nothing when already within the limit", () => {
    const { documentContent } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 5 }
    });
    const before = documentContent.getTilesOfType("Drawing");
    documentContent.evictTilesOverLimit(["drawingTool2"]);
    expect(documentContent.getTilesOfType("Drawing")).toEqual(before);
  });
```

> Verify the exact tile IDs and types in `multiple-tiles-example.json` before finalizing assertions; adjust IDs if they differ. The layout comment lists `drawingTool1`, `drawingTool2`, `textTool1`, `textTool2`.

**Step 2: Run to verify failure**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/dc-max-tiles.test.ts`
Expected: FAIL — `evictTilesOverLimit is not a function`.

**Step 3: Implement the action**

In `base-document-content.ts`, add a new `.actions(self => ({ ... }))` block *after* the one that defines `deleteTile` (later blocks can reference earlier actions via `self`). Add:

```typescript
/**
 * For each tile type among newTileIds, if the document now exceeds the
 * configured maxTiles for that type, delete the oldest tiles (document order,
 * top-first) until the count equals maxTiles. Pre-existing tiles are removed
 * before any newly added tile; among newly added tiles the oldest go first, so
 * the newest survive. Only top-level tiles are considered.
 */
evictTilesOverLimit(newTileIds: string[]) {
  const newIdSet = new Set(newTileIds);
  // Determine the distinct types of the newly added top-level tiles.
  const newTypes = new Set(
    newTileIds
      .map(id => self.getTile(id)?.content.type)
      .filter((t): t is string => !!t)
  );

  newTypes.forEach(type => {
    const max = self.getMaxTilesOfType(type);
    if (max == null) return;

    // getTilesOfType is document-ordered (oldest first).
    // Order eviction candidates: pre-existing oldest-first, then new oldest-first.
    let candidates = self.getTilesOfType(type);
    const existing = candidates.filter(id => !newIdSet.has(id));
    const added = candidates.filter(id => newIdSet.has(id));
    const eviction = [...existing, ...added];

    let overflow = candidates.length - max;
    let i = 0;
    while (overflow > 0 && i < eviction.length) {
      self.deleteTile(eviction[i]);
      i++;
      overflow--;
    }
  });
},
```

> Because this lives in a `.actions` block after `deleteTile`'s, it calls `self.deleteTile` directly. `overflow` is computed up front from the precomputed `eviction` order, so we don't need to re-query `getTilesOfType` after each delete.

**Step 4: Run to verify pass**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/dc-max-tiles.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/models/document/base-document-content.ts src/models/document/document-content-tests/dc-max-tiles.test.ts
git commit -m "feat: add evictTilesOverLimit action"
```

---

## Task 5: Wire eviction into `copyTiles`

**Files:**
- Modify: `src/models/document/document-content.ts` (end of `copyTiles`, ~line 462, before `return updatedTiles;`)
- Test: `src/models/document/document-content-tests/dc-max-tiles.test.ts`

**Step 1: Write the failing integration tests**

These exercise the real `duplicateTiles` path (one of the three callers) end-to-end. Append to `dc-max-tiles.test.ts`:

```typescript
  it("duplicating over the limit evicts the oldest, keeping the duplicate", () => {
    const { documentContent } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 2 }
    });
    expect(documentContent.getTilesOfType("Drawing")).toEqual(["drawingTool1", "drawingTool2"]);

    const items = documentContent.getDragTileItems(["drawingTool2"]);
    documentContent.duplicateTiles(items);

    const drawings = documentContent.getTilesOfType("Drawing");
    expect(drawings.length).toBe(2);            // still at the limit
    expect(drawings).not.toContain("drawingTool1"); // oldest evicted
    expect(drawings).toContain("drawingTool2");  // newer original kept
  });

  it("only returns tiles that are still in the document after eviction", () => {
    // limit 1; copy BOTH existing drawings via copyTiles directly so the pasted
    // batch (2) exceeds the limit. The older of the two pasted tiles is evicted,
    // so copyTiles must not return it.
    const { documentContent } = setupDocumentContent(srcContent, {
      drawing: { maxTiles: 1 }
    });
    const items = documentContent.getDragTileItems(["drawingTool1", "drawingTool2"]);
    const returned = documentContent.copyTiles(items, [], [], false, {
      rowDropId: documentContent.rowOrder[documentContent.rowOrder.length - 1],
      rowInsertIndex: documentContent.rowOrder.length,
      rowDropLocation: "bottom"
    });

    // Every returned tile id must actually exist in the document.
    returned.forEach(t => {
      expect(documentContent.getTile(t.newTileId!)).toBeDefined();
    });
    // And the net effect is a single surviving drawing of the batch.
    expect(documentContent.getTilesOfType("Drawing").length).toBe(1);
  });
```

> `getDragTileItems` / `duplicateTiles` / `copyTiles` are real model methods. Confirm `mockUniqueId` gives stable new IDs; the assertions check counts/old-ID-absence and existence, which are robust to the generated IDs. Adjust the `rowInfo` literal to match `IDropRowInfo` if its shape differs (see how `duplicateTiles` builds it at [document-content.ts:517](../../src/models/document/document-content.ts#L517)).

**Step 2: Run to verify failure**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/dc-max-tiles.test.ts`
Expected: the two new integration tests FAIL — without eviction, three drawings remain and `copyTiles` returns evicted (now-missing) tiles.

**Step 3: Wire the call into `copyTiles`**

In `document-content.ts`, replace the final `return updatedTiles;` at the end of `copyTiles` (~line 463) with eviction followed by a filtered return:

```typescript
    // Enforce per-type tile limits by removing the oldest tiles of any
    // now-over-limit type. Runs inside this single copyTiles action so the
    // add + eviction is one undoable step.
    self.evictTilesOverLimit(updatedTiles.map(t => t.newTileId).filter((id): id is string => !!id));

    // Eviction may have removed some of the tiles we just added (when the pasted
    // batch itself exceeds the limit), so only return tiles still in the document.
    // Callers (e.g. selectCopiedTiles) rely on these being live.
    return updatedTiles.filter(t => t.newTileId && self.getTile(t.newTileId));
```

> `IDropTileItem.newTileId` is set for every entry pushed in the loop (line ~396); the filters guard the type and confirm the tile survived eviction.

**Step 4: Run to verify pass**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/dc-max-tiles.test.ts`
Expected: PASS (all cases).

**Step 5: Run the full copy/move suite for regressions**

Run: `npm test -- --no-watchman src/models/document/document-content-tests/`
Expected: PASS. (Existing copy tests create content without `maxTiles`, so eviction is a no-op for them.)

**Step 6: Commit**

```bash
git add src/models/document/document-content.ts src/models/document/document-content-tests/dc-max-tiles.test.ts
git commit -m "feat: enforce maxTiles on copy/duplicate/paste by evicting oldest tiles"
```

---

## Task 6: Verify the single-undo property

**Files:**
- Read only: `src/models/document/document.test.ts` for the undo-test pattern.

The single-undo requirement is satisfied structurally: eviction runs inside the one `copyTiles` MST action, and `deleteTile` is a nested action call, so the history system records one undoable entry. This task verifies that claim.

**Step 1: Check for an existing document-level undo test pattern**

Run: `grep -n "undo" src/models/document/document.test.ts`
If a helper creates a history-enabled document (`createDocumentModel` + tree manager) and performs undo, add a test there: duplicate a tile over the limit, then perform one undo, and assert the document returns to its original tile set (evicted tile restored AND duplicate removed).

**Step 2: If no straightforward pattern exists**

Do NOT build new undo infrastructure for this. Instead document the guarantee in the design doc and rely on the structural argument plus manual verification (Task 7). Note this decision in the commit message.

**Step 3: Commit (only if a test was added)**

```bash
git add src/models/document/document.test.ts
git commit -m "test: one undo reverts copy-with-eviction"
```

---

## Task 7: Manual verification

**Files:** none (manual)

**Step 1: Build types and lint**

Run: `npm run check:types`
Run: `npm run lint:build`
Expected: clean.

**Step 2: Manual smoke test (optional, if running the app)**

Use a unit/problem whose `content.json` sets e.g. `settings.diagram.maxTiles: 1` (see `src/public/demo/units/qa/content.json`). In the app:
1. Create a diagram tile, then duplicate it → the original is removed, only the newest remains.
2. Copy a diagram tile to another document already containing one → only the newest remains in the target.
3. Press undo once → the evicted tile returns and the pasted/duplicated tile is removed in a single step.

**Step 3: Final full test run**

Run: `npm test -- --no-watchman src/models/document/`
Expected: PASS.

---

## Notes / out of scope

- Embedded tiles inside a pasted container (e.g. a Question tile's children) are not eviction targets — `evictTilesOverLimit` only inspects top-level tiles via `getTilesOfType`, and `getTile(id)?.content.type` for the new IDs.
- No user-facing notification (silent eviction, per design).
- Shared models / annotations on evicted tiles are cleaned up by the existing `deleteTile` path.
