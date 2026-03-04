# Click-to-Pick Tiles (CLUE-401)

## Context
Users currently move tiles via HTML5 click-and-drag, which requires holding the mouse button down throughout. This is difficult for users with motor impairments and awkward for long-distance moves across the document. This feature adds a click-to-pick alternative: click the drag handle to "pick up" a tile, move the cursor freely, then click a drop zone to place it — no sustained mouse hold required.

## Phased Implementation

### Phase 1: Mouse Click-to-Pick
Click the drag handle to pick up, move cursor, click to place. Ghost image follows cursor. Works alongside existing HTML5 drag.

### Phase 2: Keyboard Navigation
Make the drag handle tab-focusable. Enter/Space to pick up. Arrow keys navigate drop zones. All drop zones visible during pick-up with ARIA labels.

---

## Phase 1: Mouse Click-to-Pick

### State Model (UI Store)

Add to `UIModel` in `src/models/stores/ui.ts`:
- `pickedUpTileId: types.maybe(types.string)` — tile currently picked up
- `pickedUpDocId: types.maybe(types.string)` — source document content ID (for move vs. copy)
- `pickUpTile(tileId, docId)` action — sets both fields
- `clearPickedUpTile()` action — clears both fields

The full drag tile data (`IDragTilesData`) is computed lazily from the document content at placement time, not stored eagerly. This avoids stale data if the document changes while a tile is picked up.

### Pick-up Trigger (Drag Handle Click)

The `DragTileButton` in `tile-component.tsx` already has `onClick={selectTileHandler}` and `onDragStart={handleTileDragStart}`. The key distinction: a click without drag means "pick up"; a click-and-drag uses the existing HTML5 DnD.

Changes to `TileComponent`:
- Track a `didDrag` ref. Set `true` in `handleTileDragStart`, reset on `dragend`.
- New click handler on the drag handle: if `didDrag` is true, skip (a real drag just finished). Otherwise, if no tile is picked up, call `ui.pickUpTile(model.id, docId)`. If this tile is already picked up, call `ui.clearPickedUpTile()` to cancel.
- The existing `selectTileHandler` still fires (the tile gets selected when picked up).

### Ghost Element

A `PickedUpTileGhost` component (rendered via React portal at app root) observes `ui.pickedUpTileId`. When set:
- Renders the same `image_drag.png` used by native drag, positioned at the cursor via a `mousemove` listener updating `position: fixed` coordinates.
- Styled with `pointer-events: none` so it doesn't block clicks on drop zones.

When `pickedUpTileId` is cleared, the ghost unmounts.

### Cursor Feedback

When `pickedUpTileId` is set, add a CSS class (e.g. `.tile-picked-up`) to the app container that sets `cursor: grabbing` globally. Remove the class when cleared.

### Drop Zone Highlighting

During pick-up, the document content area tracks cursor position via `mousemove` and calculates `dropRowInfo` using the same logic as `getDropRowInfo` (extracted into a shared utility from `DocumentContentComponent`). The existing `.drop-feedback.show` CSS classes highlight the target zone.

### Placement (Click-to-Place)

A document-level `mousedown` listener (added when `pickedUpTileId` is set) handles placement:

**On a drop zone (document content area)**: Calculate `dropRowInfo` from click coordinates. Build `IDragTilesData` from the picked-up tile. Call `documentContent.userMoveTiles()`. Clear pick-up state.

**On the Delete button**: `DeleteButton` observes `ui.pickedUpTileId`. On click, if a tile is picked up, it stores the tile ID and shows the drag-delete confirmation modal (reusing the existing `onDeleteTile` path). Clear pick-up state.

**Anywhere else (including other tile content/handles)**: Clear pick-up state. Let the click propagate normally for selection/focus. The pick-up cancels, the click takes its usual effect.

### Cancel

- **Escape key**: Global `keydown` listener (added when pick-up active) calls `clearPickedUpTile()`.
- **Re-click drag handle**: Same handle click toggles pick-up off.
- **Click elsewhere**: Document-level handler clears pick-up and lets click propagate.

---

## Phase 2: Keyboard Navigation

### Drag Handle Focusability

Make the `DragTileButton` wrapper keyboard-reachable:
- Add `tabIndex={0}` and `role="button"`.
- Add `onKeyDown`: Enter or Space triggers pick-up (same as click logic).
- Update `aria-label` from `"Drag to move tile"` to `"Move tile"`. When the tile is picked up, change to `"Cancel move"`.

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

## Files to Modify

### Phase 1
- `src/models/stores/ui.ts` — `pickedUpTileId`, `pickedUpDocId`, actions
- `src/components/tiles/tile-component.tsx` — Drag handle click handler, `didDrag` flag
- `src/components/document/document-content.tsx` — `mousemove` drop zone calculation, `mousedown` placement handler during pick-up
- `src/components/delete-button.tsx` — Handle click-to-place on delete
- New: `src/components/picked-up-tile-ghost.tsx` — Ghost component
- `src/components/tiles/tile-component.scss` or `src/components/app.scss` — `.tile-picked-up` cursor class
- Refactor: Extract `getDropRowInfo` into shared utility from `DocumentContentComponent`

### Phase 2
- `src/components/tiles/tile-component.tsx` — `tabIndex`, `role`, `onKeyDown` on drag handle
- `src/components/document/document-content.tsx` — Render all drop zones during pick-up, arrow key handler
- `src/components/document/tile-row.tsx` — Always-visible drop feedback styling
- `src/components/document/tile-row.scss` — Dimmed vs active drop zone styles
- `src/components/delete-button.tsx` — Tab-reachable during pick-up
- ARIA attributes on drop zones

## Verification

### Phase 1
1. Click drag handle → tile picks up, ghost follows cursor
2. Move cursor over document → drop zones highlight
3. Click drop zone → tile moves to that position
4. Click drag handle again → pick-up cancels
5. Press Escape → pick-up cancels
6. Click tile content → pick-up cancels, tile gets focus
7. Click Delete button while tile picked up → confirmation modal → delete
8. Start a real drag (click-hold-move) → works as before, no pick-up triggered
9. Existing HTML5 drag-and-drop still works unchanged

### Phase 2
1. Tab to drag handle → handle receives focus with visible focus ring
2. Enter on focused handle → tile picks up, all drop zones visible
3. Arrow keys → cycle through drop zones with highlight
4. Enter → tile placed at highlighted zone
5. Escape → cancel, tile returns to original position
6. Tab → focus moves to Delete button; Enter deletes
7. Screen reader announces pick-up state and drop zone labels
