# Implementation Plan: Expand Tile Drag Handle Hit Area

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-398
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **Implemented**

## Implementation Plan

### Add Sass variable for drag handle hit area size

**Summary**: Define a new Sass variable for the drag handle hit area dimensions, making the size easily adjustable for testing and future maintenance.

**Files affected**:
- `src/components/vars.scss` — add new variable

**Estimated diff size**: ~3 lines

Add the variable in the "shared component dimensions" section (around line 402, after `$toolbar-button-height`):

```scss
// Before (current code around line 402):
$toolbar-button-height: 34px;
$toolbar-height: $toolbar-button-height + 4px;

// After:
$toolbar-button-height: 34px;
$toolbar-height: $toolbar-button-height + 4px;

// Drag handle touch target size (meets WCAG 2.2 Level AAA 44×44px recommendation)
$drag-handle-hit-size: 48px;
```

---

### Update drag handle CSS to use expanded hit area

**Summary**: Modify the drag handle styling to use the new 48×48px hit area while keeping the visual gripper icon at 34×34px in the top-right corner.

**Files affected**:
- `src/components/tiles/tile-component.scss` — update `.tool-tile-drag-handle` styles

**Estimated diff size**: ~15 lines

```scss
// Before (lines 52-79):
.tool-tile-drag-handle {
  position: absolute;
  right: -1px;
  top: -1px;
  box-sizing: border-box;
  width: 34px;
  height: 34px;
  z-index: 99;
  opacity: 0;
  transition: 0.3s;

  &.hovered {
    opacity: 0.5;
  }

  &:hover {
    cursor: grab;
    opacity: 1;
  }

  &.selected {
    opacity: 1;
  }

  &:focus {
    outline: none;
  }
}

// After:
.tool-tile-drag-handle-wrapper {
  // Hit area for drag handle - size can be adjusted for testing
  position: absolute;
  right: -1px;
  top: -1px;
  box-sizing: border-box;
  width: $drag-handle-hit-size;
  height: $drag-handle-hit-size;
  z-index: 99;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  // Uncomment to show grab cursor over entire hit area (not just the icon)
  // &:hover {
  //   cursor: grab;
  // }
}

.tool-tile-drag-handle {
  // Visual gripper icon - stays at 34×34px
  box-sizing: border-box;
  width: 34px;
  height: 34px;
  opacity: 0;
  transition: 0.3s;

  &.hovered {
    opacity: 0.5;
  }

  &:hover {
    cursor: grab;
    opacity: 1;
  }

  &.selected {
    opacity: 1;
  }

  &:focus {
    outline: none;
  }
}
```

**Key changes**:
1. The wrapper (`tool-tile-drag-handle-wrapper`) becomes the hit target at 48×48px
2. The visual icon (`tool-tile-drag-handle`) stays at 34×34px
3. Flexbox positions the icon at `flex-end` / `flex-start` (top-right corner of the wrapper)
4. The wrapper inherits the positioning properties (`position`, `right`, `top`, `z-index`)
5. The icon loses positioning properties (it's now positioned by flexbox within the wrapper)

**Note**: The wrapper element already exists in `tile-component.tsx` (line 107) with `onDragStart` attached to it (line 109). No TSX changes are required — this is a CSS-only change.

---

## Open Questions

No implementation questions at this time. The approach is straightforward CSS changes.

## Self-Review

### Senior Engineer

#### RESOLVED: Hover cursor should apply to entire hit area

The current implementation puts `cursor: grab` on the `.tool-tile-drag-handle` (the icon), not the wrapper. This means users won't see the grab cursor until they hover over the visible 34×34px icon, even though the entire 48×48px area is draggable.

**Resolution**: Keep cursor behavior on icon only for now. Added commented-out CSS for wrapper hover cursor that can be enabled during testing if deemed beneficial.

---

### QA Engineer

No additional issues identified. The Testing Notes in requirements.md cover the necessary verification steps.
