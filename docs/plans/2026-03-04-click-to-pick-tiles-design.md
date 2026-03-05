# Click-to-Pick Tiles (CLUE-401)

## Context
Users currently move tiles via HTML5 click-and-drag, which requires holding the mouse button down throughout. This is difficult for users with motor impairments and awkward for long-distance moves across the document. This feature adds a click-to-pick alternative: click the drag handle to "pick up" a tile, move the cursor freely, then click a drop zone to place it — no sustained mouse hold required.

## Phased Implementation

### Phase 1: Mouse Click-to-Pick (COMPLETE)
Click the drag handle to pick up, move cursor, click to place. Ghost image follows cursor. Works alongside existing HTML5 drag. Supports both same-document moves and cross-document copies (e.g. resources pane → workspace).

### Phase 2: Keyboard Navigation (COMPLETE)
Make the drag handle tab-focusable. Enter/Space to pick up. Arrow keys navigate drop zones. All drop zones visible during pick-up with ARIA labels. Accessible drop zone styling with high-contrast borders.

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
- Renders `image_drag.png` via `createPortal` on `document.body`, with the tile type's registered Icon SVG (32x32) centered over it. The ghost is anchored with its top-right corner at the cursor position so it extends leftward over the tile and doesn't overflow the right edge of the screen.
- On keyboard pick-up (Tab + Enter), initializes position from the focused drag handle's bounding rect so the ghost appears at the handle rather than at (0,0).
- Styled with `pointer-events: none` so it doesn't block clicks on drop zones.
- Adds `tile-picked-up` class to `document.body` for global grabbing cursor.
- Listens for Escape key to cancel pick-up.
- Listens for `mousedown` (capture phase) to cancel pick-up when clicking outside document content, drag handles, or delete button.
- Renders an `aria-live="assertive"` region announcing keyboard instructions on pick-up.

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

## Phase 2: Keyboard Navigation (COMPLETE)

### Drag Handle Focusability

The `DragTileButton` wrapper in `tile-component.tsx` is keyboard-reachable:
- `tabIndex={0}` and `role="button"` make it focusable and identifiable.
- `onKeyDown`: Enter or Space triggers pick-up (same as click logic).
- Dynamic `aria-label`: `"Move tile"` normally, `"Cancel move"` when the tile is picked up.
- `isPickedUp` prop drives the aria-label toggle.

### Visible Drop Zones

When `pickedUpTileId` is set, ALL valid drop zones render their `.drop-feedback` bars simultaneously. The active zone (mouse-hovered or keyboard-focused) gets full highlight; all others show dimmed.

**Styling** (`tile-row.scss`):
- Active zone: `background-color: $color7` at `opacity: 0.4` with `border: 2px solid $focus-ring-color` (#0957D0) — provides clear non-color visual contrast.
- Dimmed zone: `opacity: 0.15` with `border: 1px dashed $color7-4` (#009cdb) — visible dashed outline shows all possible positions.

### Arrow Key Navigation

`DocumentContentComponent` adds a global `keydown` listener when a tile is picked up (via the same MobX reaction that adds mousemove listeners). Drop zones form an ordered flat list computed by `getDropZoneList()` from `content.allRows`:

- Each non-section-header row contributes: top, left, right, bottom zones.
- Section headers contribute only bottom (and top if not the first row).
- Fixed position rows contribute only bottom.
- The list uses `getDropInfoForGlobalRowIndex()` to produce correct local `rowInsertIndex` values within the containing RowList (important for nested rows inside question tiles).

**Navigation**:
- **All four arrow keys** cycle sequentially through the flat zone list (Down/Right advance, Up/Left go back). This ensures every zone is reachable.
- **Enter**: Place the tile at the currently focused zone via `handlePickUpPlace`.
- **Tab**: Move focus to the Delete button.
- **Escape**: Cancel pick-up (handled by `PickedUpTileGhost`).
- Mouse movement clears keyboard focus (`focusedDropZoneIndex`) so the two modes don't conflict.

State: `focusedDropZoneIndex: types.maybe(types.number)` in `UIModel`, cleared by `clearPickedUpTile()`.

### ARIA

- Each visible drop zone gets `aria-label` describing the position (e.g. "Above row 2", "Left of row 3").
- On pick-up, an `aria-live="assertive"` region in `PickedUpTileGhost` announces: "Tile picked up. Use arrow keys to choose a position, Enter to place, Escape to cancel."
- The keydown handler skips processing when focus is on interactive elements (`.delete-button`, `button`, `input`, etc.) so Enter activates the focused control instead of placing the tile.

### Ghost Element Enhancements

- Displays the tile type's registered Icon SVG (from `getTileComponentInfo`) centered at 32x32 over the 80x80 drag placeholder image, so users can identify which tile type is being moved.
- On keyboard pick-up, initializes position from the active element's bounding rect (the focused drag handle).
- Anchored with top-right corner at cursor/handle position, extending leftward over the tile to avoid right-edge screen overflow.

---

## Phase 3: Visual Polish & Bug Fixes (COMPLETE)

### Tile Shrink Animation
When a tile is picked up or HTML5-dragged, all `.tool-tile` elements shrink to `scale(0.95)` with a 0.2s ease-out transition, creating visible gaps where the drop zone indicators show *around* tiles instead of overlaid on top. Uses body-level CSS classes (`body.tile-picked-up` set by the ghost component, `body.tile-dragging` set by `handleTileDragStart`/`handleDragEnd`) so all tiles shrink simultaneously without each component needing to observe drag state. See comment in `tile-component.scss`.

### Resources Pane Fixes
Curriculum/resources tiles live in `problem.sections[].content`, not in the `documents` store, so `documents.findDocumentOfTile()` returned null for them. Fixed by:
- **Ghost icon**: Store `pickedUpTileType` in the UI store at pick-up time; the ghost reads it directly instead of looking up the source document.
- **Click-to-place**: Added `findContentOfTile()` helper in `DocumentContentComponent` that first checks the documents store, then falls back to searching `problem.sections` and `teacherGuide?.sections`.
- **Delete**: `handleDeleteTile` in `toolbar.tsx` uses `documents.findDocumentOfTile()` to target the correct source document.

### Empty Document Support
When the target document has no rows (e.g. a new blank personal document), click-to-place and keyboard Enter now accept placement at `rowInsertIndex: 0`. The spacer div shows an `empty-drop-target` style (dimmed drop zone appearance) to indicate it accepts drops.

### Drop Zone Corner Overlap
Left/right drop zones are inset by 8px at top and bottom (`top: 8px; bottom: 8px`) so they don't overlap with the top/bottom zones at the corners, avoiding confusing transparent overlaps.

---

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

### Phase 2 (COMPLETE)
- `src/components/tiles/tile-component.tsx` — `tabIndex={0}`, `role="button"`, `onKeyDown` for Enter/Space, `isPickedUp` prop, dynamic `aria-label`
- `src/components/document/document-content.tsx` — `getDropZoneList()` computes ordered zones from `allRows` using `getDropInfoForGlobalRowIndex`, `handlePickUpKeyDown` keyboard handler (arrow/Enter/Tab), mouse clears keyboard focus
- `src/components/document/tile-row.tsx` — ARIA attributes (`role="option"`, `aria-label`, `aria-selected`) on drop zone divs during pick-up
- `src/components/document/tile-row.scss` — Accessible drop zone styling: active zones get solid border with `$focus-ring-color`, dimmed zones get dashed border
- `src/components/picked-up-tile-ghost.tsx` — Tile type icon overlay via `getTileComponentInfo`, keyboard position initialization from active element, `aria-live` announcement, top-right anchor positioning
- `src/models/stores/ui.ts` — `focusedDropZoneIndex` state, `setFocusedDropZoneIndex` action, cleared in `clearPickedUpTile`

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

### Phase 2 (COMPLETE)
1. Tab to drag handle → handle receives focus with visible focus ring ✓
2. Enter on focused handle → tile picks up, ghost appears at handle, all drop zones visible ✓
3. Ghost shows tile type icon centered over drag placeholder ✓
4. Arrow keys → cycle through all drop zones sequentially with highlight ✓
5. Left/right side-by-side placement works via keyboard ✓
6. Enter → tile placed at highlighted zone ✓
7. Escape → cancel, tile stays in original position ✓
8. Tab → focus moves to Delete button; Enter deletes ✓
9. Screen reader announces pick-up state and drop zone labels ✓
10. Drop zones have visible borders (solid active, dashed dimmed) for accessibility ✓
11. Mouse movement during keyboard navigation clears keyboard focus ✓
