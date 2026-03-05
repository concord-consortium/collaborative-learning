# Drag-to-Delete for Workspace Tiles (CLUE-401)

## Context
Users can currently delete tiles by selecting them and clicking the Delete (Tile) button in the vertical toolbar, which shows a confirmation modal. This adds drag-to-delete: users drag a tile directly onto the Delete button, which shows the same confirmation modal. Only the dragged tile is deleted (not all selected tiles).

## Design

### Drop target on DeleteButton
Add HTML5 drag-and-drop event handlers (`onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop`) to the delete button in `src/components/delete-button.tsx`. Accept drops with the `kDragTiles` data type, already set by `TileComponent.handleTileDragStart`.

### Visual feedback
Track `isDragOver` state. When a tile drag enters the button, apply hover/active styling. Revert on drag leave or drop. `onDragOver` calls `e.preventDefault()` and sets `dropEffect = "move"`.

### On drop
Extract tile ID from `e.dataTransfer.getData(kDragTileId)`. Store in ref, trigger confirmation modal. On confirm, delete only that single tile.

### Toolbar integration
Add `onDeleteTile(tileId: string)` prop from `toolbar.tsx` for single-tile deletion. Confirmation modal says "tile" (singular) for drag-delete.

## Files
- `src/components/delete-button.tsx`
- `src/components/toolbar.tsx`
