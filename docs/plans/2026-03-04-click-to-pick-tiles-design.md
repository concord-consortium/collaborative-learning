# Click-to-Pick Tiles (CLUE-401)

## Context
Users currently move tiles via HTML5 click-and-drag, which requires holding the mouse button down throughout. This is difficult for users with motor impairments and awkward for long-distance moves across the document. This feature adds a click-to-pick alternative: click the drag handle to "pick up" a tile, move the cursor freely, then click a drop zone to place it — no sustained mouse hold required.

## Phased Implementation

### Phase 1: Mouse Click-to-Pick (COMPLETE)
Click the drag handle to pick up, move cursor, click to place. Ghost image follows cursor. Works alongside existing HTML5 drag. Supports both same-document moves and cross-document copies (e.g. resources pane → workspace).

### Phase 2: Keyboard Navigation (NOT STARTED)
Make the drag handle tab-focusable. Enter/Space to pick up. Arrow keys navigate drop zones. All drop zones visible during pick-up with ARIA labels.

---

## Phase 1: Mouse Click-to-Pick (COMPLETE)

### State Model (UI Store)

Added to `UIModel` in `src/models/stores/ui.ts`:
- `pickedUpTileId: types.maybe(types.string)` — tile currently picked up
- `pickedUpDocId: types.maybe(types.string)` — source document content ID (for move vs. copy)
- `isTilePickedUp` view — computed boolean for convenience
- `pickUpTile(tileId, docId)` action — sets both fields
- `clearPickedUpTile()` action — clears both fields

The full drag tile data (`IDragTilesData`) is computed lazily from the document content at placement time, not stored eagerly. This avoids stale data if the document changes while a tile is picked up.

### Pick-up Trigger (Drag Handle Click)

The `DragTileButton` in `tile-component.tsx` has `onClick={onPickUpClick}` and `onDragStart={handleTileDragStart}`. The key distinction: a click without drag means "pick up"; a click-and-drag uses the existing HTML5 DnD.

Changes to `TileComponent`:
- `private didDrag = false` class field. Set `true` in `handleTileDragStart`, reset in `handleDragEnd`.
- `handlePickUpClick`: selects the tile, then if `didDrag` is true skips (a real drag just finished). Otherwise toggles pick-up on/off via `ui.pickUpTile`/`ui.clearPickedUpTile`.
- `handleDragEnd`: resets `didDrag` and calls `triggerResizeHandler`.
- **Critical**: `handlePickUpClick` calls `e.stopPropagation()` to prevent the click from bubbling up to the document-content handler, which would immediately try to place the just-picked-up tile.
- Starting a real HTML5 drag also clears any active pick-up state.

### Ghost Element

`PickedUpTileGhost` component (`src/components/picked-up-tile-ghost.tsx`) rendered inside `App.renderApp()`. It observes `ui.pickedUpTileId`. When set:
- Renders `image_drag.png` via `createPortal` on `document.body`, positioned at cursor via a `mousemove` listener with `position: fixed`.
- Styled with `pointer-events: none` so it doesn't block clicks on drop zones.
- Adds `tile-picked-up` class to `document.body` for global grabbing cursor.
- Listens for Escape key to cancel pick-up.
- Listens for `mousedown` (capture phase) to cancel pick-up when clicking outside document content, drag handles, or delete button.

When `pickedUpTileId` is cleared, the ghost unmounts and all listeners are cleaned up.

### Drop Zone Highlighting

`DocumentContentComponent` uses a MobX `reaction` on `ui.pickedUpTileId` to add/remove `mousemove` and `mouseleave` listeners on the document content DOM element. The `mousemove` handler calls `getDropRowInfoFromPoint(clientX, clientY)` (refactored from the original `getDropRowInfo` that took a `DragEvent`) to calculate drop zone info, which flows through `DropRowContext` to highlight the target zone — the same visual feedback as native drag.

### Placement (Click-to-Place)

The existing `handleClick` on the document-content div was extended:

**When `ui.pickedUpTileId` is set**:
1. Calculate `dropRowInfo` from click coordinates
2. If a valid drop zone is found, call `handlePickUpPlace(dropRowInfo)`
3. `handlePickUpPlace` uses `documents.findDocumentOfTile(tileId)` to find the source document
4. If source and target are the same document → `userMoveTiles` (move)
5. If source and target differ (e.g. resources pane → workspace) → `getDragTiles` + `handleDragCopyTiles` (copy)
6. Clear pick-up state and drop zone highlights
7. If no valid drop zone was found, cancel pick-up

**On the Delete button**: `DeleteButton` uses `useStores()` to access `ui.pickedUpTileId`. On click, if a tile is picked up, stores the tile ID in a ref, clears pick-up state (removing ghost), and shows the single-tile drag-delete confirmation modal. Wrapped with `observer` for reactivity.

### Cancel

- **Escape key**: Global `keydown` listener in `PickedUpTileGhost` calls `clearPickedUpTile()`.
- **Re-click drag handle**: `handlePickUpClick` toggles pick-up off.
- **Click inside document content**: `handleClick` in `DocumentContentComponent` cancels if no valid drop zone.
- **Click outside document/delete/handle**: Global `mousedown` listener (capture phase) in `PickedUpTileGhost` clears pick-up.

---

## Phase 2: Keyboard Navigation (NOT STARTED)

### Drag Handle Focusability

Make the `DragTileButton` wrapper keyboard-reachable:
- Add `tabIndex={0}` and `role="button"`.
- Add `onKeyDown`: Enter or Space triggers pick-up (same as click logic).
- Update `aria-label` to `"Move tile"`. When the tile is picked up, change to `"Cancel move"`.

### Visible Drop Zones

When `pickedUpTileId` is set, ALL valid drop zones render their `.drop-feedback` bars simultaneously at reduced opacity (e.g. 15%). The keyboard-focused or mouse-hovered zone gets full highlight (25% as today). This makes it clear where tiles can be placed.

### Arrow Key Navigation

Drop zones form an ordered list computed from `allRows`:
- Each row contributes zones: top-of-row, left-side, between-tiles, right-side, bottom-of-row (as applicable based on row content and section headers).
- **Up/Down arrow**: Move between rows.
- **Left/Right arrow**: Move between positions within a row.
- The currently focused zone gets the strong highlight.
- **Enter**: Place the tile at the focused zone.
- **Escape**: Cancel pick-up.
- **Tab**: Cycle to the Delete button as a drop target, then back to document zones.

### ARIA

- Each drop zone gets `role="option"` within a container with `role="listbox"`.
- `aria-label` describes the position, e.g. "Above row 2", "Right of Graph tile".
- The keyboard-focused zone gets `aria-selected="true"`.
- On pick-up, announce via `aria-live`: "Tile picked up. Use arrow keys to choose a position, Enter to place, Escape to cancel."

## Files Modified

### Phase 1 (COMPLETE)
- `src/models/stores/ui.ts` — `pickedUpTileId`, `pickedUpDocId`, `isTilePickedUp` view, actions
- `src/models/stores/ui.test.ts` — Tests for pick-up state
- `src/components/tiles/tile-component.tsx` — `DragTileButton` props, `didDrag` flag, `handlePickUpClick`, `handleDragEnd`, `stopPropagation`
- `src/components/document/document-content.tsx` — `getDropRowInfoFromPoint` refactor, `pickUpReactionDisposer` reaction, `handlePickUpMouseMove`/`handlePickUpMouseLeave`, `handlePickUpPlace` with cross-document copy support, `handleClick` extension
- `src/components/delete-button.tsx` — `observer` wrapper, `useStores`, picked-up tile delete on click
- `src/components/delete-button.test.tsx` — `Provider` wrapper for stores
- New: `src/components/picked-up-tile-ghost.tsx` — Ghost component with cursor tracking, Escape cancel, click-outside cancel
- `src/components/app.tsx` — Renders `PickedUpTileGhost`
- `src/components/app.scss` — `body.tile-picked-up` grabbing cursor

### Phase 2 (NOT STARTED)
- `src/components/tiles/tile-component.tsx` — `tabIndex`, `role`, `onKeyDown`, `isPickedUp` prop on drag handle
- `src/components/document/document-content.tsx` — Render all drop zones during pick-up, arrow key handler
- `src/components/document/tile-row.tsx` — Always-visible drop feedback styling
- `src/components/document/tile-row.scss` — Dimmed vs active drop zone styles
- `src/components/delete-button.tsx` — Tab-reachable during pick-up
- ARIA attributes on drop zones

## Verification

### Phase 1 (COMPLETE)
1. Click drag handle → tile picks up, ghost follows cursor ✓
2. Move cursor over document → drop zones highlight ✓
3. Click drop zone → tile moves to that position ✓
4. Click drag handle again → pick-up cancels ✓
5. Press Escape → pick-up cancels ✓
6. Click tile content → pick-up cancels, tile gets focus ✓
7. Click Delete button while tile picked up → ghost clears, confirmation modal → delete ✓
8. Start a real drag (click-hold-move) → works as before, no pick-up triggered ✓
9. Existing HTML5 drag-and-drop still works unchanged ✓
10. Pick up from resources pane, click to place in workspace → tile copies ✓

### Phase 2
1. Tab to drag handle → handle receives focus with visible focus ring
2. Enter on focused handle → tile picks up, all drop zones visible
3. Arrow keys → cycle through drop zones with highlight
4. Enter → tile placed at highlighted zone
5. Escape → cancel, tile stays in original position
6. Tab → focus moves to Delete button; Enter deletes
7. Screen reader announces pick-up state and drop zone labels
