# Expand Tile Drag Handle Hit Area

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-398
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Status**: **Implemented**
**Implementation Spec**: [implementation.md](implementation.md)

## Overview

Expand the invisible hit target area for the top-right tile drag handle from 34×34px to 48×48px, making it easier to grab tiles for dragging, particularly for iFrameInteractive tiles where embedded content (like Leaflet map attribution) can interfere with the small corner target.

## Project Owner Overview

Users working with storm/hurricane simulation tiles in the Resources pane are having difficulty grabbing tiles to drag-copy them. The Leaflet map attribution link in the top-right corner overlaps the drag gripper, making it hard to initiate a drag. This is a usability issue that affects workflow efficiency.

The solution is to expand the invisible hit target area for the top-right drag handle across all tile types. This keeps the visual appearance unchanged while making the interaction target larger and more accessible. The change benefits all tiles, not just iFrameInteractive ones, and improves touch-device usability as well.

## Background

CLUE tiles have two corner handles:
- **Drag handle** (top-right): 34×34px, z-index 99, used for dragging tiles
- **Resize handle** (bottom-right): 34×34px, z-index 10, used for resizing tiles

These handles are positioned at `right: -1px; top/bottom: -1px` respectively, placing them slightly outside the tile border. The handles are invisible by default (opacity: 0) and become visible on hover or when the tile is selected.

For iFrameInteractive tiles embedding Leaflet maps, the map's attribution link sits in the top-right corner and can capture pointer events that would otherwise reach the drag handle. While a z-index fix in the Hurricane sim itself will help (tracked in HURR-23), Leslie Bondaryk has requested that we also expand the hit target area as a general usability improvement.

**Key files:**
- [tile-component.tsx](../../src/components/tiles/tile-component.tsx) - Handle components and drag logic
- [tile-component.scss](../../src/components/tiles/tile-component.scss) - Handle styling and dimensions

## Requirements

- Expand the invisible hit target area for the top-right drag handle from 34×34px to 48×48px
- Keep the resize handle (bottom-right) unchanged at 34×34px
- Extend the hit area inward (toward tile content) rather than outward
- Keep the visual appearance of the drag handle unchanged (the visible icon stays the same size)
- Apply the change to all tile types generically (not just iFrameInteractive)
- Add a code comment indicating where the hit area size can be adjusted for testing
- Maintain current z-index stacking so the handle remains above tile content

## Technical Notes

The current implementation uses a wrapper div that contains the visual SVG icon. The wrapper div is the actual hit target.

Current CSS for drag handle:
```scss
.tool-tile-drag-handle {
  position: absolute;
  right: -1px;
  top: -1px;
  width: 34px;
  height: 34px;
  z-index: 99;
}
```

The visual gripper SVG is 34×34px. To expand the hit area to 48×48px without changing the visual:
- Increase the wrapper dimensions to 48×48px
- Keep `right: -1px` and `top: -1px` unchanged — the extra 14px height naturally extends downward into the tile
- Position the SVG icon in the top-right corner of the larger wrapper
- Add a CSS comment noting the hit area size can be adjusted for testing
- Consider using a Sass variable (e.g., `$drag-handle-hit-size: 48px`) for maintainability

The 48×48px size exceeds Apple's 44×44pt minimum recommended touch target, providing good usability on touch devices.

Note: The drag handle uses `draggable={true}` with `onDragStart`, so drags only initiate on actual drag gestures, not plain clicks. Clicks in the expanded area that don't result in a drag will fall through to tile content below.

## Testing Notes

- Verify drag handle hit area is 48×48px (inspect via dev tools)
- Verify visual appearance of the gripper icon is unchanged (still 34×34px)
- Verify dragging works from the expanded area (not just the visible icon)
- Test on touch devices to confirm improved usability
- Verify no regression in normal tile content interaction near the corner
- Verify no overlap issues with tile badges, menus, or other top-right tile chrome
- Verify clicks with minor mouse jitter don't accidentally trigger drags

## Out of Scope

- Changing the visual appearance of the drag handle icon
- Expanding the resize handle (bottom-right) hit area
- The z-index fix for the Hurricane sim's Leaflet attribution (tracked in HURR-23)
- Adding new functionality to the drag handle
- Changing the position of the drag handle (it remains in the top-right corner)

## Open Questions

### RESOLVED: What should the new hit area size be?

**Context**: The current hit area is 34×34px. We need to balance making it easier to hit while not making it so large it interferes with tile content.

**Options considered**:
- A) 44×44px (Apple's minimum recommended touch target size)
- B) 48×48px (slightly larger than Apple's minimum)
- C) Match the current tile header height for visual consistency

**Decision**: B) 48×48px

### RESOLVED: Should both handles (drag and resize) be expanded equally?

**Context**: The ticket specifically mentions the corner dragger, but the same usability argument could apply to the drag handle at top-right.

**Options considered**:
- A) Expand both handles equally
- B) Only expand the resize handle (bottom-right) as mentioned in the ticket
- C) Expand resize handle more than drag handle

**Decision**: Only expand the top-right drag handle. The resize handle should be left as is. The story text only mentioned the "corner dragger" which refers to the drag handle, not the resize handle.

### RESOLVED: How should the expanded hit area be positioned relative to the tile?

**Context**: Currently handles are at `right: -1px; top: -1px`. With a larger hit area, we could extend it further into the tile, further outside the tile, or both.

**Options considered**:
- A) Extend inward (larger overlap with tile content)
- B) Extend outward (larger area outside tile boundary)
- C) Extend both directions equally (centered on current position)

**Decision**: A) Extend inward, with a comment in the code/styling indicating where this can be adjusted during testing.

## Self-Review

### Senior Engineer

#### RESOLVED: Expanded hit area may intercept clicks intended for tile content

The 48×48px hit area extending inward will overlap with the top-right corner of tile content. For most tiles this is unlikely to cause issues, but tiles with interactive elements in the top-right corner could have click interception. The drag handle's z-index of 99 already sits above tile content, so this is existing behavior with a larger footprint.

**Resolution**: Accepted as a known trade-off. The adjustable size comment allows tuning if specific tiles have problems.

---

### QA Engineer

#### RESOLVED: Missing acceptance criteria for testing

The requirements don't specify how to verify the change works correctly.

**Resolution**: Added Testing Notes section with verification steps.

---

### Student

No issues identified. The change improves usability for grabbing and moving tiles, which benefits students working with the Resources pane.

---

### WCAG Accessibility Expert

#### RESOLVED: Confirm WCAG 2.2 target size compliance

The 48×48px target size exceeds WCAG 2.2 Success Criterion 2.5.8 (Target Size - Minimum) which requires 24×24 CSS pixels, and meets the Level AAA recommendation of 44×44 CSS pixels. This is a positive accessibility improvement for users with motor impairments.

Note: The visual indicator (34×34px icon) is smaller than the actual hit target. This is acceptable since the invisible target area doesn't create accessibility barriers - it only makes interaction easier.

**Resolution**: No changes needed. WCAG compliance noted as a benefit.
