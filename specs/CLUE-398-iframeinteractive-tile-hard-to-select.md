# Expand Tile Drag Handle Hit Area

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-398

**Status**: **Closed**

## Overview

Expand the invisible hit target area for the top-right tile drag handle from 34×34px to 48×48px, making it easier to grab tiles for dragging, particularly for iFrameInteractive tiles where embedded content (like Leaflet map attribution) can interfere with the small corner target.

Users working with storm/hurricane simulation tiles in the Resources pane were having difficulty grabbing tiles to drag-copy them. The Leaflet map attribution link in the top-right corner overlaps the drag gripper, making it hard to initiate a drag. The solution expands the invisible hit target area for the top-right drag handle across all tile types, keeping the visual appearance unchanged while improving usability and touch-device accessibility.

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

The implementation is a CSS-only change:
- A new Sass variable `$drag-handle-hit-size: 48px` is defined in `src/components/vars.scss`
- The wrapper element (`.tool-tile-drag-handle-wrapper`) becomes the 48×48px hit target with absolute positioning
- The visual icon (`.tool-tile-drag-handle`) stays at 34×34px, positioned in the top-right corner of the wrapper via flexbox
- No TSX changes required — the wrapper element already exists in `tile-component.tsx` with `onDragStart` attached

The 48×48px size exceeds Apple's 44×44pt minimum recommended touch target and meets WCAG 2.2 Level AAA (Success Criterion 2.5.8).

The drag handle uses `draggable={true}` with `onDragStart`, so drags only initiate on actual drag gestures, not plain clicks. Clicks in the expanded area that don't result in a drag will fall through to tile content below.

## Out of Scope

- Changing the visual appearance of the drag handle icon
- Expanding the resize handle (bottom-right) hit area
- The z-index fix for the Hurricane sim's Leaflet attribution (tracked in HURR-23)
- Adding new functionality to the drag handle
- Changing the position of the drag handle (it remains in the top-right corner)

## Decisions

### What should the new hit area size be?
**Context**: The current hit area is 34×34px. We needed to balance making it easier to hit while not making it so large it interferes with tile content.
**Options considered**:
- A) 44×44px (Apple's minimum recommended touch target size)
- B) 48×48px (slightly larger than Apple's minimum)
- C) Match the current tile header height for visual consistency

**Decision**: B) 48×48px — slightly exceeds Apple's minimum and meets WCAG 2.2 Level AAA.

---

### Should both handles (drag and resize) be expanded equally?
**Context**: The ticket specifically mentions the corner dragger, but the same usability argument could apply to the resize handle at bottom-right.
**Options considered**:
- A) Expand both handles equally
- B) Only expand the resize handle (bottom-right) as mentioned in the ticket
- C) Expand resize handle more than drag handle

**Decision**: Only expand the top-right drag handle. The resize handle should be left as is. The story text only mentioned the "corner dragger" which refers to the drag handle, not the resize handle.

---

### How should the expanded hit area be positioned relative to the tile?
**Context**: Currently handles are at `right: -1px; top: -1px`. With a larger hit area, we could extend it further into the tile, further outside the tile, or both.
**Options considered**:
- A) Extend inward (larger overlap with tile content)
- B) Extend outward (larger area outside tile boundary)
- C) Extend both directions equally (centered on current position)

**Decision**: A) Extend inward, with a comment in the code/styling indicating where this can be adjusted during testing.

---

### Expanded hit area may intercept clicks intended for tile content
**Context**: The 48×48px hit area extending inward will overlap with the top-right corner of tile content. For most tiles this is unlikely to cause issues, but tiles with interactive elements in the top-right corner could have click interception. The drag handle's z-index of 99 already sits above tile content, so this is existing behavior with a larger footprint.
**Options considered**:
- A) Accept the trade-off and rely on the adjustable size comment for tuning
- B) Reduce the hit area to minimize overlap

**Decision**: Accepted as a known trade-off. The adjustable size comment allows tuning if specific tiles have problems.

---

### Testing notes were missing from the spec
**Context**: The initial requirements didn't specify how to verify the change works correctly.
**Options considered**:
- A) Add a Testing Notes section with specific verification steps
- B) Rely on standard QA processes without explicit criteria

**Decision**: Added a Testing Notes section covering: dev tools size verification, visual appearance check, drag-from-expanded-area testing, touch device testing, regression testing for tile content interaction, overlap checks with tile chrome, and accidental drag prevention.

---

### Should the grab cursor apply to the entire hit area or just the visible icon?
**Context**: The `cursor: grab` style was on the `.tool-tile-drag-handle` (the 34×34px icon), not the 48×48px wrapper. Users won't see the grab cursor until they hover over the visible icon, even though the entire area is draggable.
**Options considered**:
- A) Apply grab cursor to the entire 48×48px wrapper
- B) Keep cursor on the 34×34px icon only, with commented-out CSS for testing

**Decision**: Keep cursor behavior on the icon only for now. Added commented-out CSS for wrapper hover cursor that can be enabled during testing if deemed beneficial.
