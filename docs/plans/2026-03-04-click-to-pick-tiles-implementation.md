# Click-to-Pick Tiles Implementation Plan

**Goal:** Add click-to-pick as an alternative to click-and-drag for moving tiles, with Phase 1 (mouse) and Phase 2 (keyboard) as separate commits.

**Architecture:** Application-level pick state in the UI MobX store. When a tile is picked up, a ghost image follows the cursor, drop zones highlight, and clicks on drop zones/delete button trigger placement/deletion. Phase 2 adds keyboard navigation through drop zones with arrow keys.

**Tech Stack:** React 17, MobX State Tree, HTML5 mouse events, SCSS

---

## Phase 1: Mouse Click-to-Pick

### Task 1: UI Store — Pick-up State

**Files:**
- Modify: `src/models/stores/ui.ts:46-60` (model definition) and `:153-216` (actions)

**Step 1: Add properties to UIModel**

In `src/models/stores/ui.ts`, add two fields to the UIModel `.model()` call, after the `dragId` line (line 59):

```typescript
dragId: types.maybe(types.string), // existing line
pickedUpTileId: types.maybe(types.string),
pickedUpDocId: types.maybe(types.string)
```

**Step 2: Add actions**

In the same file, add actions inside the existing `.actions()` block that contains `setDraggingId` (after line 207):

```typescript
setDraggingId(dragId?: string) {
  self.dragId = dragId;
},

pickUpTile(tileId: string, docId: string) {
  self.pickedUpTileId = tileId;
  self.pickedUpDocId = docId;
},
clearPickedUpTile() {
  self.pickedUpTileId = undefined;
  self.pickedUpDocId = undefined;
},
```

**Step 3: Add a view**

Add a view to the existing `.views()` block (after line 69):

```typescript
isSelectedTile(tile: ITileModel) {
  return self.selectedTileIds.indexOf(tile.id) !== -1;
},
get isTilePickedUp() {
  return !!self.pickedUpTileId;
}
```

**Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to ui.ts

**Step 5: Commit**

```bash
git add src/models/stores/ui.ts
git commit -m "feat: add pickedUpTileId/pickedUpDocId state to UI store"
```

---

### Task 2: Drag Handle Click — Pick Up Tile

**Files:**
- Modify: `src/components/tiles/tile-component.tsx:94-119` (DragTileButton) and `:150-160` (InternalTileComponent class fields) and `:413-475` (handleTileDragStart)

**Step 1: Add `onPickUpClick` prop to DragTileButton**

Update the `IDragTileButtonProps` interface (line 94) and component:

```typescript
interface IDragTileButtonProps {
  divRef: (instance: HTMLDivElement | null) => void;
  hovered: boolean;
  selected: boolean;
  selectTileHandler: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleTileDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  triggerResizeHandler: () => void;
  onPickUpClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}
const DragTileButton = (
    { divRef, hovered, selected,
      handleTileDragStart, triggerResizeHandler, selectTileHandler, onPickUpClick }: IDragTileButtonProps) => {
  const classes = classNames("tool-tile-drag-handle", { hovered, selected });
  return (
    <div className={`tool-tile-drag-handle-wrapper`}
      ref={divRef}
      onDragStart={handleTileDragStart}
      onDragEnd={triggerResizeHandler}
      onClick={onPickUpClick}
      draggable={true}
      data-testid="tool-tile-drag-handle"
      aria-label="Drag to move tile"
    >
      <TileDragHandle className={classes} />
    </div>
  );
};
```

Note: `onClick` changes from `selectTileHandler` to `onPickUpClick`. The new handler will call `selectTileHandler` internally.

**Step 2: Add didDrag field and handlePickUpClick to InternalTileComponent**

Add a class field near line 159:

```typescript
private didDrag = false;
```

Add the `handleDragEnd` handler to reset the flag (this supplements the existing `triggerResizeHandler` on `onDragEnd`):

```typescript
private handleDragEnd = () => {
  this.didDrag = false;
  this.triggerResizeHandler();
};
```

Update `DragTileButton` usage in render to use `handleDragEnd` for `onDragEnd` (currently it passes `triggerResizeHandler`). The `triggerResizeHandler` is still called inside `handleDragEnd`.

**Step 3: Set didDrag in handleTileDragStart**

At the top of `handleTileDragStart` (line 413), after the `disableTileDrags` check, add:

```typescript
this.didDrag = true;
```

Also clear any active pick-up since a real drag is starting:

```typescript
this.didDrag = true;
const { ui } = this.stores;
if (ui.isTilePickedUp) {
  ui.clearPickedUpTile();
}
```

**Step 4: Implement handlePickUpClick**

```typescript
private handlePickUpClick = (e: React.MouseEvent<HTMLDivElement>) => {
  // Always select the tile on handle click
  this.selectTileHandler(e as unknown as React.PointerEvent<HTMLDivElement>);

  // If a real drag just happened, don't trigger pick-up
  if (this.didDrag) {
    this.didDrag = false;
    return;
  }

  const { model, docId } = this.props;
  const { ui } = this.stores;

  if (ui.pickedUpTileId === model.id) {
    // Re-clicking the same handle cancels pick-up
    ui.clearPickedUpTile();
  } else {
    ui.pickUpTile(model.id, docId);
  }
};
```

**Step 5: Wire up new props in render**

In the render method where `DragTileButton` is created (around line 227), update:

```typescript
const dragTileButton = isDraggable &&
                        <DragTileButton
                          divRef={elt => this.dragElement = elt}
                          hovered={hoverTile}
                          selected={isTileSelected}
                          selectTileHandler={this.selectTileHandler}
                          handleTileDragStart={this.handleTileDragStart}
                          triggerResizeHandler={this.handleDragEnd}
                          onPickUpClick={this.handlePickUpClick}
                          />;
```

**Step 6: Run tests**

Run: `npm test -- --testPathPattern="tile-component" --no-coverage 2>&1 | tail -20`
Expected: All existing tests pass (click behavior changes but tests likely don't test drag handle clicks directly)

**Step 7: Commit**

```bash
git add src/components/tiles/tile-component.tsx
git commit -m "feat: drag handle click triggers pick-up instead of just select"
```

---

### Task 3: Ghost Element

**Files:**
- Create: `src/components/picked-up-tile-ghost.tsx`
- Modify: `src/components/app.tsx` or nearest parent that renders globally (check where modals/portals are rendered)

**Step 1: Check where to render the ghost**

Run: `grep -n "ModalProvider\|createPortal\|\.app" src/components/app.tsx | head -20`

The ghost should render as a sibling of the document content, likely inside the app's main container.

**Step 2: Create the ghost component**

Create `src/components/picked-up-tile-ghost.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
import { useStores } from "../hooks/use-stores";
import dragPlaceholderImage from "../assets/image_drag.png";

export const PickedUpTileGhost: React.FC = observer(function PickedUpTileGhost() {
  const { ui } = useStores();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!ui.pickedUpTileId) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [ui.pickedUpTileId]);

  if (!ui.pickedUpTileId) return null;

  const ghost = (
    <img
      src={dragPlaceholderImage}
      alt=""
      style={{
        position: "fixed",
        left: position.x - 40,
        top: position.y - 10,
        pointerEvents: "none",
        opacity: 0.8,
        zIndex: 10000,
      }}
    />
  );

  return createPortal(ghost, document.body);
});
```

**Step 3: Render ghost in the app**

Find the appropriate parent component and add `<PickedUpTileGhost />`. This is likely in `src/components/app.tsx` or whatever component wraps the document workspace. Search for where the document content is rendered and add the ghost component nearby.

**Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/picked-up-tile-ghost.tsx src/components/app.tsx
git commit -m "feat: add ghost image that follows cursor during pick-up"
```

---

### Task 4: Cursor Feedback and Escape Cancel

**Files:**
- Modify: `src/components/picked-up-tile-ghost.tsx` (add Escape listener and cursor class)

**Step 1: Add cursor class and Escape handling to the ghost component**

Extend the `useEffect` in `PickedUpTileGhost` to also:
- Add/remove `.tile-picked-up` class on `document.body`
- Listen for Escape key

```tsx
useEffect(() => {
  if (!ui.pickedUpTileId) return;

  document.body.classList.add("tile-picked-up");

  const handleMouseMove = (e: MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      ui.clearPickedUpTile();
    }
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("keydown", handleKeyDown);
  return () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("keydown", handleKeyDown);
    document.body.classList.remove("tile-picked-up");
  };
}, [ui, ui.pickedUpTileId]);
```

**Step 2: Add CSS**

In `src/components/app.scss` (or a global stylesheet), add:

```scss
body.tile-picked-up {
  cursor: grabbing !important;

  * {
    cursor: grabbing !important;
  }
}
```

**Step 3: Run type check and manual test**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```bash
git add src/components/picked-up-tile-ghost.tsx src/components/app.scss
git commit -m "feat: grabbing cursor and Escape cancel during pick-up"
```

---

### Task 5: Drop Zone Highlighting During Pick-up

**Files:**
- Modify: `src/components/document/document-content.tsx:76-90` (componentDidMount) and `:150-192` (render) and `:304-416` (getDropRowInfo)

**Step 1: Extract getDropRowInfo to accept clientX/clientY**

Currently `getDropRowInfo` takes a `React.DragEvent` and reads `e.clientX`/`e.clientY`. Refactor it to accept `(clientX: number, clientY: number)` so both drag events and mouse events can use it.

Create a private method `getDropRowInfoFromPoint`:

```typescript
private getDropRowInfoFromPoint = (clientX: number, clientY: number): IDropRowInfo | undefined => {
  const { content } = this.props;
  if (!this.domElement || !content) {
    return { rowInsertIndex: content ? content.rowOrder.length : 0 };
  }
  // ... same logic as getDropRowInfo but using clientX/clientY params instead of e.clientX/e.clientY
};
```

Then update `getDropRowInfo` to delegate:

```typescript
private getDropRowInfo = (e: React.DragEvent<HTMLDivElement> | { clientX: number, clientY: number }) => {
  return this.getDropRowInfoFromPoint(e.clientX, e.clientY);
};
```

**Step 2: Add mousemove handler for pick-up mode**

In `componentDidMount`, add a reaction that enables/disables the mousemove listener based on `ui.pickedUpTileId`:

```typescript
this.pickUpReactionDisposer = reaction(
  () => this.stores.ui.pickedUpTileId,
  (pickedUpTileId) => {
    if (pickedUpTileId && !this.props.readOnly) {
      this.domElement?.addEventListener("mousemove", this.handlePickUpMouseMove);
      this.domElement?.addEventListener("mouseleave", this.handlePickUpMouseLeave);
    } else {
      this.domElement?.removeEventListener("mousemove", this.handlePickUpMouseMove);
      this.domElement?.removeEventListener("mouseleave", this.handlePickUpMouseLeave);
      this.clearDropRowInfo();
    }
  }
);
```

Add the handler:

```typescript
private handlePickUpMouseMove = (e: MouseEvent) => {
  const now = Date.now();
  const lastUpdate = this.state.dropRowInfo?.updateTimestamp ?? 0;
  if (now - lastUpdate > kDragUpdateInterval) {
    const dropRowInfo = this.getDropRowInfoFromPoint(e.clientX, e.clientY);
    this.setState({ dropRowInfo });
  }
};

private handlePickUpMouseLeave = () => {
  this.clearDropRowInfo();
};
```

Clean up in `componentWillUnmount`:

```typescript
this.pickUpReactionDisposer?.();
```

**Step 3: Run tests**

Run: `npm test -- --testPathPattern="document-content" --no-coverage 2>&1 | tail -20`
Expected: Existing tests pass

**Step 4: Commit**

```bash
git add src/components/document/document-content.tsx
git commit -m "feat: drop zones highlight on mousemove during pick-up"
```

---

### Task 6: Click-to-Place on Document

**Files:**
- Modify: `src/components/document/document-content.tsx`

**Step 1: Add click handler for placement**

Add a click handler that fires when a tile is picked up and the user clicks inside the document content area. Hook it into the existing `onClick` handler or add a new `mousedown` handler:

```typescript
private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const { ui } = this.stores;

  // Handle click-to-place when a tile is picked up
  if (ui.pickedUpTileId && !this.props.readOnly) {
    const dropRowInfo = this.getDropRowInfoFromPoint(e.clientX, e.clientY);
    if (dropRowInfo?.rowDropId) {
      this.handlePickUpPlace(dropRowInfo);
      e.stopPropagation();
      return;
    }
    // Click was in document but not on a valid drop zone — cancel
    ui.clearPickedUpTile();
  }
};
```

Note: Check if there's already a `handleClick` on the document content div (there is, at line 178). Either extend it or replace it.

**Step 2: Implement handlePickUpPlace**

```typescript
private handlePickUpPlace = (dropRowInfo: IDropRowInfo) => {
  const { content } = this.props;
  const { ui } = this.stores;
  const tileId = ui.pickedUpTileId;

  if (!content || !tileId) return;

  const tileModel = content.getTile(tileId);
  if (!tileModel) {
    ui.clearPickedUpTile();
    return;
  }

  const dragTileItems = content.getDragTileItems([tileId]);
  const tilesToMove = content.removeEmbeddedTilesFromDragTiles(dragTileItems);
  content.userMoveTiles(tilesToMove, dropRowInfo);

  ui.clearPickedUpTile();
  this.clearDropRowInfo();
};
```

**Step 3: Run tests**

Run: `npm test -- --testPathPattern="document-content" --no-coverage 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/components/document/document-content.tsx
git commit -m "feat: click document drop zone to place picked-up tile"
```

---

### Task 7: Click-to-Delete for Picked-up Tiles

**Files:**
- Modify: `src/components/delete-button.tsx`
- Modify: `src/components/toolbar.tsx` (pass UI store or pickedUpTileId)

**Step 1: Update DeleteButton to handle picked-up tiles**

The `DeleteButton` needs access to the UI store to check `pickedUpTileId`. Either pass it as a prop or use the `useStores` hook.

In `delete-button.tsx`, add to the click handler:

```typescript
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  // If a tile is picked up, treat click as delete-via-pick-up
  if (pickedUpTileId) {
    dragTileIdRef.current = pickedUpTileId;
    clearPickedUpTile();
    showDragDeleteAlert();
    return;
  }
  !isDisabled && onClick(e, toolButton);
};
```

Add the necessary props or hook to get `pickedUpTileId` and `clearPickedUpTile` from the UI store.

**Step 2: Run tests**

Run: `npm test -- --testPathPattern="delete-button" --no-coverage 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/components/delete-button.tsx src/components/toolbar.tsx
git commit -m "feat: clicking Delete button places picked-up tile in trash"
```

---

### Task 8: Cancel on Click Elsewhere

**Files:**
- Modify: `src/components/picked-up-tile-ghost.tsx`

**Step 1: Add global mousedown listener for cancel**

In the ghost component's `useEffect`, add a `mousedown` listener on the document that clears the pick-up if the click target is NOT inside a document-content area or the delete button. This acts as the catch-all cancel:

```typescript
const handleMouseDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  // Don't cancel if clicking inside document content (placement handler will handle it)
  if (target.closest(".document-content")) return;
  // Don't cancel if clicking the delete button (delete handler will handle it)
  if (target.closest(".delete-button")) return;
  // Don't cancel if clicking a drag handle (toggle handler will handle it)
  if (target.closest(".tool-tile-drag-handle-wrapper")) return;
  // Everything else cancels pick-up
  ui.clearPickedUpTile();
};

document.addEventListener("mousedown", handleMouseDown);
// ... cleanup in return
```

**Step 2: Run all related tests**

Run: `npm test -- --testPathPattern="(delete-button|toolbar|tile-component)" --no-coverage 2>&1 | tail -20`

**Step 3: Commit Phase 1**

```bash
git add -A
git commit -m "feat: cancel pick-up on click outside document/delete (Phase 1 complete)"
```

---

## Phase 2: Keyboard Navigation

### Task 9: Make Drag Handle Tab-Focusable

**Files:**
- Modify: `src/components/tiles/tile-component.tsx:102-119` (DragTileButton)

**Step 1: Add tabIndex, role, and keyboard handler**

Update `DragTileButton`:

```typescript
interface IDragTileButtonProps {
  // ... existing props ...
  onPickUpClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  isPickedUp: boolean;
}
const DragTileButton = (
    { divRef, hovered, selected,
      handleTileDragStart, triggerResizeHandler, selectTileHandler,
      onPickUpClick, isPickedUp }: IDragTileButtonProps) => {
  const classes = classNames("tool-tile-drag-handle", { hovered, selected });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPickUpClick(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  return (
    <div className={`tool-tile-drag-handle-wrapper`}
      ref={divRef}
      onDragStart={handleTileDragStart}
      onDragEnd={triggerResizeHandler}
      onClick={onPickUpClick}
      onKeyDown={handleKeyDown}
      draggable={true}
      tabIndex={0}
      role="button"
      aria-label={isPickedUp ? "Cancel move" : "Move tile"}
      data-testid="tool-tile-drag-handle"
    >
      <TileDragHandle className={classes} />
    </div>
  );
};
```

**Step 2: Pass isPickedUp from InternalTileComponent render**

```typescript
const isPickedUp = ui.pickedUpTileId === model.id;
const dragTileButton = isDraggable &&
                        <DragTileButton
                          // ... existing props ...
                          isPickedUp={isPickedUp}
                          />;
```

**Step 3: Run tests**

Run: `npm test -- --testPathPattern="tile-component" --no-coverage 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/components/tiles/tile-component.tsx
git commit -m "feat: make drag handle tab-focusable with Enter/Space to pick up"
```

---

### Task 10: Show All Drop Zones During Pick-up

**Files:**
- Modify: `src/components/document/tile-row.tsx` (drop feedback rendering)
- Modify: `src/components/document/tile-row.scss` (dimmed style)

**Step 1: Check current drop feedback rendering**

Read `src/components/document/tile-row.tsx` to understand `renderDragDropHandles` and the `dropHighlight` prop/context.

**Step 2: Add "all zones visible" mode**

When `ui.pickedUpTileId` is set, each `TileRowComponent` should render its drop feedback bars as visible (dimmed) regardless of whether it's the active drop target. The active drop target gets the full highlight.

In `tile-row.tsx`, consume the UI store and check `isTilePickedUp`:

```typescript
const allZonesVisible = ui.isTilePickedUp;
const showTopHighlight = (highlight === "top") || allZonesVisible;
// ... same pattern for left, right, bottom
```

Add a CSS class to distinguish dimmed from active:

```typescript
className={`drop-feedback top ${showTopHighlight ? "show" : ""} ${highlight === "top" ? "active" : ""}`}
```

**Step 3: Add dimmed styles**

In `tile-row.scss`:

```scss
.drop-feedback {
  // ... existing styles ...

  &.show {
    background-color: $color7;
    opacity: 0.15;  // dimmed by default when all visible
  }

  &.show.active {
    opacity: 0.25;  // full highlight for active zone
  }
}
```

Note: This changes the existing `.show` opacity. Make sure the native drag path still works by also applying `.active` during native drag highlighting.

**Step 4: Run tests**

Run: `npm test -- --testPathPattern="tile-row" --no-coverage 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/components/document/tile-row.tsx src/components/document/tile-row.scss
git commit -m "feat: show all drop zones (dimmed) when tile is picked up"
```

---

### Task 11: Arrow Key Navigation of Drop Zones

**Files:**
- Modify: `src/components/document/document-content.tsx`
- Modify: `src/models/stores/ui.ts` (add focusedDropZoneIndex)

**Step 1: Add focusedDropZoneIndex to UI store**

```typescript
focusedDropZoneIndex: types.maybe(types.number)
```

And actions:

```typescript
setFocusedDropZoneIndex(index?: number) {
  self.focusedDropZoneIndex = index;
},
```

Clear it in `clearPickedUpTile`:

```typescript
clearPickedUpTile() {
  self.pickedUpTileId = undefined;
  self.pickedUpDocId = undefined;
  self.focusedDropZoneIndex = undefined;
},
```

**Step 2: Build drop zone list**

In `DocumentContentComponent`, compute the list of valid drop zones from `content.allRows`. Each zone is a `{ rowId, location: "top" | "bottom" | "left" | "right" }` object. Store this as a computed value or build it on demand.

**Step 3: Add keyboard handler**

In the ghost component or document content, add a global `keydown` listener during pick-up:

- **ArrowDown**: increment `focusedDropZoneIndex`
- **ArrowUp**: decrement `focusedDropZoneIndex`
- **ArrowLeft/ArrowRight**: move between left/right zones within the same row
- **Enter**: place tile at the focused zone
- **Tab**: cycle to delete button (focus it directly)
- **Escape**: cancel (already handled)

**Step 4: Update drop zone rendering**

The focused drop zone (by index) gets the `active` class. Map `focusedDropZoneIndex` to the corresponding row and location, and pass it through `DropRowContext`.

**Step 5: Add ARIA attributes**

On drop zones, add:

```typescript
role="option"
aria-label={`Above ${tileTypeName} tile`}  // or similar descriptive text
aria-selected={isFocused}
```

Wrap the drop zone region in:

```typescript
role="listbox"
aria-label="Drop zones for tile placement"
```

**Step 6: Add aria-live announcement**

When pick-up is triggered, announce:

```tsx
<div aria-live="assertive" className="sr-only">
  Tile picked up. Use arrow keys to choose a position, Enter to place, Escape to cancel.
</div>
```

**Step 7: Run tests**

Run: `npm test -- --testPathPattern="(document-content|tile-row|ui)" --no-coverage 2>&1 | tail -20`

**Step 8: Commit Phase 2**

```bash
git add -A
git commit -m "feat: keyboard navigation of drop zones during pick-up (Phase 2 complete)"
```

---

## Verification Checklist

### Phase 1 Manual Tests
1. Click drag handle → tile picks up, ghost follows cursor
2. Move cursor over document → drop zones highlight
3. Click drop zone → tile moves to that position
4. Click drag handle again → pick-up cancels
5. Press Escape → pick-up cancels
6. Click tile content → pick-up cancels, tile gets focus
7. Click Delete button while tile picked up → confirmation modal → delete
8. Start a real drag (click-hold-move) → works as before, no pick-up triggered
9. Existing HTML5 drag-and-drop still works unchanged

### Phase 2 Manual Tests
1. Tab to drag handle → handle receives focus with visible focus ring
2. Enter on focused handle → tile picks up, all drop zones visible
3. Arrow keys → cycle through drop zones with highlight
4. Enter → tile placed at highlighted zone
5. Escape → cancel, tile stays in original position
6. Tab → focus moves to Delete button; Enter deletes
7. Screen reader announces pick-up state and drop zone labels
