# Tab/Arrow Order in CLUE UI

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-384
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Status**: **In Development**

## Overview

Enable low vision and low mobility students to navigate the CLUE interface using keyboard Tab/Shift-Tab and arrow keys, with proper DOM hierarchy, focus trapping within tiles, and visible focus indicators.

## Project Owner Overview

CLUE currently lacks comprehensive keyboard navigation support, making it inaccessible to students who cannot use a mouse. This story establishes the foundational tab order and keyboard navigation structure across the entire CLUE UI—from the application header through the Resources pane (left) and My Workspace pane (right), down into individual tiles. Students will be able to Tab through major regions, use arrow keys to navigate within regions, and have focus trapped appropriately when editing tiles. This work supports WCAG compliance and enables future accessibility features like screen reader support and voice typing (CLUE-383).

## Background

The CLUE application has a two-pane layout managed by `WorkspaceComponent`:
- **Left pane (Resources)**: Contains `NavTabPanel` with tabs (Curriculum, My Work, Class Work, Sort Work, etc.) using the `react-tabs` library
- **Right pane (My Workspace)**: Contains `DocumentWorkspaceComponent` with a canvas of tiles organized in rows

Currently:
- No explicit `tabIndex` management exists
- Very minimal ARIA attributes are used
- No visible focus indicators (CSS `:focus` styles) exist
- The `HotKeys` utility handles some keyboard shortcuts (undo/redo, copy document) but no navigation
- Tile toolbars use `FloatingPortal` which places them outside normal DOM flow
- No landmark regions or skip navigation links exist

**User workflow context**: The main focus depends on the user's current activity:
- **Initial launch**: Users focus on the left (Resources pane) to understand the curriculum
- **Ongoing work**: Users focus mainly on the right (Workspace pane) to create and edit content

This suggests the keyboard navigation should support both workflows—easy access to Resources for orientation, but efficient navigation to Workspace for productivity.

**Related tickets:**
- **Epic CLUE-382**: Accessibility - TTS/STT and tabbing hierarchy (parent)
- **CLUE-383**: STT (Voice Typing) in CLUE Text Tiles (related)
- **CLUE-391**: Tab order in CLUE Tile UI - text tiles (cloned from this ticket for tile-specific work)

## Requirements

### Conformance Target
- [ ] Target WCAG 2.2 Level AA conformance for all keyboard navigation and focus management features

### DOM Hierarchy & Landmarks
- [ ] Use standard ARIA landmark roles at appropriate levels: `banner` (header), `main` (workspace), `complementary`/`navigation` (resources)
- [ ] Reserve `role="application"` only for specific widgets requiring custom keyboard handling (e.g., tile canvas), not at top level
- [ ] Resources pane must be marked as `role="complementary"` or `role="navigation"` with `aria-label`
- [ ] My Workspace pane must be marked as `role="main"` with `aria-label`
- [ ] Tab panels within Resources must use proper `role="tablist"`, `role="tab"`, `role="tabpanel"` structure (react-tabs may provide this)

### Tab Order (Major Regions)
- [ ] Tab order must follow logical visual flow: Header → Resources pane → My Workspace pane
- [ ] Composite widget pattern: Tab moves between major regions/containers; Arrow keys navigate within them
- [ ] Within Resources pane: Tab list → Active tab panel content → Controls within panel → Chat panel (when expanded via existing toggle; keyboard navigation follows current visibility state)
- [ ] Within My Workspace: Document toolbar → Tile canvas (single Tab stop using roving tabindex; arrow keys navigate between tiles)
- [ ] Focus memory: When tabbing into the tile canvas, focus goes to the last-focused tile (or first tile if none previously focused). Shift-Tab from canvas returns to Document toolbar
- [ ] Skip navigation link labeled "Skip to My Workspace" should allow jumping directly to My Workspace (label sourced from `useAriaLabels` hook for localization)

### Tab Order (Within Tiles)
- [ ] Each tile must be a focusable container that receives focus as a single unit
- [ ] **Enter key** from tile container enters the tile's internal focus trap (Down arrow navigates to row below, not into tile)
- [ ] Within a focused tile, Tab cycles through: Tile title → Tile toolbar buttons → Tile content controls (if any)
- [ ] For tiles with no focusable content controls, Tab cycles through only title and toolbar
- [ ] Focus must be trapped within a tile once entered (focus ring)
- [ ] **Escape key** exits the tile focus trap and returns focus to the tile container (Up arrow inside trap also exits for consistency)
- [ ] Moving to a tile above from inside the trap is a two-step gesture: Up arrow (or Escape) to exit trap → Up arrow again to move to row above

### Arrow Key Navigation
- [ ] Arrow keys navigate between sibling elements at the same level:
  - Left/Right arrows between tabs in a tab list
  - Left/Right arrows between tiles in a row
  - Up/Down arrows between rows of tiles (always, even when on a tile container)
- [ ] Boundary behavior: Arrow navigation stops at edges (does not wrap). At first/last element, the key press has no effect (focus stays in place)
- [ ] Home/End keys should jump to first/last tile in the current row (standard roving tabindex behavior)
- [ ] For nested tabs (e.g., Curriculum > subtabs): All tabs in same Tab sequence; Down arrow jumps into subtabs, Up arrow returns to parent tabs
- [ ] **Enter key** from a tile container enters the tile's focus trap (not Down arrow)
- [ ] **Escape key** exits the tile focus trap; Up arrow from inside trap also exits for consistency
- [ ] Arrow key navigation must not interfere with text input: when focus is on a text field, input, or textarea, arrow keys control the cursor within that field, not tile/region navigation

### Focus Indicators
- [ ] All focusable elements must have visible focus indicators (CSS `:focus` or `:focus-visible`)
- [ ] Focus indicator style: Double border with 2px solid #0957D0 outer + 1px solid white inner (ensures visibility on both light and dark backgrounds)
- [ ] Focus ring styling must be captured in shared SCSS variables (e.g., `$focus-ring-color`, `$focus-ring-inner-color`, `$focus-ring-outer-width`, `$focus-ring-inner-width`) for easy updates
- [ ] For containers with `overflow: hidden`, use `outline` (not `box-shadow`) and ensure sufficient padding to prevent clipping, or use `inset` outline where appropriate
- [ ] Focus indicators must meet WCAG 2.2 focus-appearance contrast requirements (3:1 against adjacent colors); #0957D0 is the base color but must be validated against actual backgrounds

### Screen Reader Support
- [ ] All interactive elements must have accessible names (via `aria-label`, visible text, or `aria-labelledby`)
- [ ] Focus changes must be announced appropriately
- [ ] Use `aria-live` regions sparingly to announce significant dynamic content changes:
  - Use `aria-live="polite"` by default (e.g., panel switches, tile added/removed confirmations)
  - Reserve `aria-live="assertive"` for errors or time-sensitive alerts only
  - Candidate regions: tab panel switches, tile canvas changes, toolbar visibility changes

### Testing
- [ ] Include automated accessibility tests (jest-axe or similar) for new keyboard navigation code
- [ ] Include Cypress keyboard-navigation tests covering: Tab through major regions, arrow navigation within tile canvas, Enter/Escape tile trap entry/exit, skip link functionality

## Technical Notes

### Key Files
| Component | File Path | Role |
|-----------|-----------|------|
| Workspace | `src/components/workspace/workspace.tsx` | Two-pane layout, keyboard dispatch |
| Nav Tab Panel | `src/components/navigation/nav-tab-panel.tsx` | Tabs (react-tabs library) |
| Document Workspace | `src/components/document/document-workspace.tsx` | Right pane documents |
| Canvas | `src/components/document/canvas.tsx` | Tile rendering |
| Tile Row | `src/components/document/tile-row.tsx` | Row of tiles |
| Tile Component | `src/components/tiles/tile-component.tsx` | Individual tile wrapper |
| Tile Toolbar | `src/components/toolbar/tile-toolbar.tsx` | Tile toolbar (uses FloatingPortal) |
| Hot Keys | `src/utilities/hot-keys.ts` | Keyboard shortcut handler |

### Existing Patterns
- `HotKeys` utility in `src/utilities/hot-keys.ts` for keyboard shortcuts
- `persistentUI` store tracks active tab, pane visibility, selected tiles
- `react-tabs` library already supports some keyboard navigation
- MobX observer pattern used throughout components

### Constraints
- Tile toolbars use `@floating-ui/react` `FloatingPortal`, which renders outside normal DOM—may need special handling for focus management
- Multiple tile types exist in `src/plugins/`; each may need tile-specific keyboard handling
- **Some tiles may have no tab-focusable elements** inside their content area (e.g., image-only tiles, read-only displays). Focus trap behavior must handle this gracefully.
- Must not break existing mouse-based interactions

## Out of Scope

- Voice typing / speech-to-text integration (covered by CLUE-383)
- Text-to-speech / read-aloud functionality (separate ticket)
- Tile-specific internal keyboard navigation (e.g., navigating within a graph tile's data points, custom key handlers for drawing tools) — this ticket establishes the framework for title and toolbar focus; CLUE-391 and other tickets handle tile-specific content interactions. Content controls are included in the focus cycle only if they are already standard focusable elements (inputs, buttons, etc.)
- Mobile/touch accessibility
- Keyboard navigation help/discoverability UI (tooltips, shortcut legend, onboarding hints) — consider creating a follow-up ticket

## Open Questions

<!-- Requirements-focused questions only (scope, acceptance criteria, business rules).
     Implementation questions go in implementation.md. -->

### RESOLVED: How does a user enter a tile's focus trap?
**Context**: The ticket specifies that navigating into a tile traps Tab within tile elements, and Up arrow or Escape exits. But it doesn't specify how a user *enters* the trap.
**Options considered**:
- A) Tab into tile container automatically enters the focus trap (first Tab lands inside tile)
- B) Tab lands on tile container as a single focusable unit; Enter/Down arrow enters the focus trap
- C) Tab lands on tile container; any key press or second Tab enters the focus trap

**Decision**: B — Tab lands on tile as a single focusable unit; **Enter key only** enters the focus trap (Down arrow always navigates to row below). This follows standard grid/composite widget patterns and avoids key conflict ambiguity.

---

### RESOLVED: What are the focus indicator visual specs?
**Context**: The ticket mentions "Styled focused elements – some examples in latest specs" but I don't have access to these design specifications.
**Options considered**:
- A) Use browser default focus indicators (typically blue outline)
- B) Use a custom focus ring style (please provide specs: color, width, offset)
- C) Follow an existing design system or component library pattern

**Decision**: B — Custom focus ring style: 2px solid #0957D0 (a blue that meets WCAG contrast requirements). Styling should be captured in shared SCSS variables for easy updates.

---

### RESOLVED: Should Tab or Arrow keys be primary for navigation within regions?
**Context**: Common patterns vary. Some applications use Tab for everything; others use Tab for major regions and Arrow keys within regions (like toolbar buttons).
**Options considered**:
- A) Tab only: Tab moves through all focusable elements in sequence
- B) Composite widget pattern: Tab moves between regions/containers, Arrow keys move within them
- C) Hybrid: Tab works everywhere, Arrow keys provide optional accelerated navigation within certain widgets

**Decision**: B — Composite widget pattern. Tab moves between major regions/containers; Arrow keys move within them. This reduces Tab stops and provides more efficient keyboard navigation.

---

### RESOLVED: Should both Escape AND Up arrow exit a tile's focus trap?
**Context**: The ticket says "User escapes the tab ring in a tile with an up arrow key." Should Escape also work? Escape is the more standard key for exiting traps.
**Options considered**:
- A) Up arrow only (as ticket specifies)
- B) Escape only (standard pattern)
- C) Both Up arrow and Escape work to exit

**Decision**: C — Both Up arrow and Escape work to exit the focus trap. This provides flexibility: Escape is the standard pattern users expect, while Up arrow provides consistency with the arrow-key navigation model.

---

### RESOLVED: Where does the Chat panel fit in the tab order?
**Context**: The NavTabPanel includes a Chat panel toggle. When chat is visible, where should it appear in the tab order?
**Options considered**:
- A) Chat is part of the Resources pane, comes after the active tab content
- B) Chat is a separate landmark/region between Resources and Workspace
- C) Chat is at the end of the tab order, after Workspace

**Decision**: A — Chat is part of the Resources pane and comes after the active tab content. This keeps the Resources pane as a cohesive unit.

---

### RESOLVED: How should nested tabs be navigated (e.g., Curriculum > subtabs)?
**Context**: The Curriculum tab has subtabs within it. The ticket mentions "Curriculum tab > subtabs" but doesn't specify the navigation pattern.
**Options considered**:
- A) Flat tab order: All tabs (parent and child) are in the same Tab sequence
- B) Hierarchical: Arrow keys move between sibling tabs; Tab/Enter goes into selected tab's subtabs
- C) Separate tab lists: Subtabs are a separate focusable group accessed after parent tab content

**Decision**: Combination of A and B — All tabs (parent and child) are in the same Tab sequence, but arrow keys provide hierarchical navigation: Down arrow jumps into subtabs, Up arrow returns to parent tabs. This gives users both sequential Tab access and efficient arrow-key shortcuts.

---

## Self-Review

### WCAG Accessibility Expert

#### RESOLVED: Reconsider `role="application"` at top level
Updated to use standard landmark roles at appropriate levels, reserving `role="application"` only for specific widgets requiring custom keyboard handling.

#### RESOLVED: Specify WCAG conformance level
Added WCAG 2.2 Level AA as the target conformance level.

#### RESOLVED: Missing `aria-live` region specification
Added `aria-live` requirement to Screen Reader Support section.

---

### Senior Engineer

#### RESOLVED: FloatingPortal focus management strategy needed
Implementation concern, not a requirements issue. The requirement is that focus works correctly within tiles; how FloatingPortal is handled is an implementation detail to be addressed in implementation.md.

---

### QA Engineer

#### RESOLVED: Missing browser/screen reader test matrix
Deferred to standard QA practices; not specified at requirements level.

#### RESOLVED: Missing automated test requirements
Added requirement for automated accessibility tests (jest-axe or similar).

---

### Student

#### RESOLVED: Discoverability of keyboard navigation
Added to Out of Scope with note to consider a follow-up ticket for keyboard navigation help/discoverability UI.
