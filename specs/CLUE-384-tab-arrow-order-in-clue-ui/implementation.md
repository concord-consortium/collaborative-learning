# Implementation Plan: Tab/Arrow Order in CLUE UI

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-384
**Requirements**: [requirements.md](./requirements.md)
**Status**: Draft

## Overview

This plan implements keyboard navigation and focus management for the CLUE UI, enabling Tab/Shift-Tab navigation between major regions and arrow key navigation within regions, following the composite widget pattern.

## Architecture Decisions

### AD-1: Focus Management Approach

**Decision**: Create a centralized `FocusManager` class that coordinates focus across regions, rather than distributed focus handling in each component.

**Rationale**:
- Simplifies focus memory (last-focused tile per canvas)
- Enables consistent focus trap entry/exit behavior
- Easier to test and debug

**Alternative considered**: MobX store for focus state — rejected because focus is ephemeral UI state, not persistent application state.

### AD-2: Roving Tabindex Implementation

**Decision**: Implement roving tabindex for tile canvas using a custom React hook (`useTileCanvasNavigation`) rather than a third-party library.

**Rationale**:
- Tile canvas has unique requirements (2D grid with variable columns per row)
- Need tight integration with existing MST selection model
- Control over focus memory behavior
- No suitable library found that handles FloatingPortal focus boundaries

### AD-3: Focus Trap Strategy

**Decision**: Use CSS `outline` positioning combined with programmatic focus management, not a library like `focus-trap` or `react-focus-lock`.

**Rationale**:
- FloatingPortal renders toolbar outside normal DOM flow
- Need fine-grained control over what constitutes "inside" the trap (tile container + its toolbar in portal)
- Libraries assume contiguous DOM, which doesn't match our architecture

### AD-4: HotKeys Extension vs. Replacement

**Decision**: Extend the existing `HotKeys` utility to support navigation keys, rather than replacing it.

**Rationale**:
- Existing shortcuts (undo/redo, copy) must continue working
- HotKeys already handles cross-platform key mapping
- Avoids breaking existing functionality
- Incremental change is safer

### AD-5: SCSS Variables Location

**Decision**: Add focus ring variables to existing `src/components/vars.scss` and export them for TypeScript consumption.

**Rationale**:
- `vars.scss` is already the centralized location for shared styling
- Already has an `:export` block for TypeScript access
- Keeps focus styling consistent with other design tokens

### AD-6: ARIA Grid Pattern for Tile Canvas

**Decision**: Use full ARIA grid pattern (`role="grid"` > `role="row"` > `role="gridcell"`) for the tile canvas.

**Rationale**:
- Tile canvas has true 2D arrow-key navigation (Up/Down between rows, Left/Right within rows)
- Grid pattern communicates this structure semantically to screen readers
- Home/End jump to row boundaries, matching standard grid behavior
- Variable columns per row is acceptable in ARIA grid (rows can have different numbers of cells)

**Trade-offs**:
- Requires maintaining proper DOM structure (grid > row > gridcell)
- Screen readers will announce position (e.g., "row 2 of 4, column 1 of 3")
- If DOM structure breaks, SR may announce incorrectly

**Alternatives rejected**:
- `role="listbox"` + `role="option"`: Doesn't communicate 2D structure
- No roles (plain divs): Works functionally but loses semantic navigation benefits

---

## Acceptance Criteria

The following criteria must be met before this implementation is considered complete:

### Keyboard Navigation
- [ ] **Tab order**: Tab enters regions in this order: Skip Link → Header → Resources pane → My Workspace pane. Within each region, Tab visits focusable elements; the "entry focus target" per region is its first focusable element (or the roving-tabindex anchor for composite widgets like tile canvas)
- [ ] **Focus memory implementation**: Focus memory for tile canvas is achieved via the roving tabindex pattern — the MST selection state (`ui.selectedTileIds`) persists while the user tabs away, so the selected tile retains `tabIndex={0}` and naturally receives focus when Tab returns to the canvas. No explicit `getFocusMemory()` call is needed at Tab entry.
- [ ] **Skip link**: "Skip to My Workspace" link is first focusable element, becomes visible on focus, and moves focus to workspace
- [ ] **Arrow navigation in tiles**: Arrow keys navigate between tiles (Left/Right within row, Up/Down between rows)
- [ ] **Boundary behavior**: Arrow keys stop at edges (no wrap); focus stays in place at boundaries
- [ ] **Home/End**: Home/End keys jump to first/last tile in current row
- [ ] **Focus memory**: When tabbing back into tile canvas (i.e., Tab from document toolbar lands on canvas, or Shift-Tab from after canvas lands on canvas), focus returns to last-focused tile rather than always the first tile. If no tile was previously focused in this session, focus goes to the first tile. Focus memory should only restore when focus enters the grid from outside — internal arrow navigation and mouse selection update focus memory but do not trigger restore logic (to avoid surprising jumps).

### Focus Trap (Tile Editing)
- [ ] **Enter to edit**: Enter key on focused tile enters focus trap
- [ ] **Escape to exit**: Escape key exits focus trap and returns focus to tile container
- [ ] **Up arrow to exit**: Up arrow exits focus trap when not in editable element
- [ ] **Tab cycles**: Tab/Shift-Tab cycles through title → toolbar → content within trap
- [ ] **Portal inclusion**: Toolbar buttons (in FloatingPortal) are included in Tab cycle
- [ ] **Toolbar re-render**: Tab cycle is not broken when toolbar buttons enable/disable or tile type changes

### Visual Focus Indicators
- [ ] **Visible focus**: All focusable elements show visible focus indicator when focused
- [ ] **Consistent styling**: Focus uses double border (2px #0957D0 outer + 1px white inner)
- [ ] **No clipping**: Focus indicators not clipped by `overflow: hidden` containers
- [ ] **Trapped state**: Tiles in focus trap have visually distinct state (`.tile-focus-trapped`)

### ARIA and Landmarks
- [ ] **Landmark roles**: Header (`banner`), Resources (`navigation`), Workspace (`main`) have proper roles
- [ ] **Grid structure**: Tile canvas uses `role="grid"` with proper row/gridcell structure
- [ ] **Grid position announcements**: Screen readers announce row/column position when navigating tiles (e.g., "row 2 of 4, column 1 of 3") — this is automatic from proper ARIA grid structure
- [ ] **Accessible names**: All landmarks and interactive elements have accessible names via `aria-label`

### Screen Reader Announcements
- [ ] **Trap entry/exit**: "Editing tile" announced on Enter; "Exited tile" announced on Escape
- [ ] **Panel switches**: Tab panel changes announced via aria-live region
- [ ] **Tile selection**: Tile type announced when tile selected via keyboard
- [ ] **Announcement reliability**: Rapid sequential announcements (e.g., quick tile navigation) must not truncate or drop the final message. During rapid arrow navigation, only the *final* tile-selected announcement must be guaranteed to complete — intermediate announcements may be superseded. Throttling/debouncing tile selection announcements is acceptable and recommended to avoid noisy/unusable rapid-fire announcements.

### Non-Regression
- [ ] **Mouse interactions**: All existing mouse interactions continue to work
- [ ] **Existing shortcuts**: Ctrl+Z/Y (undo/redo), Ctrl+C/V (copy/paste) continue to work
- [ ] **Text editing**: Arrow keys work normally inside text inputs, textareas, and contenteditable

### Testing
- [ ] **Unit tests**: FocusManager, navigation hooks, and focus trap have unit test coverage
- [ ] **jest-axe**: Workspace component passes automated accessibility audit
- [ ] **Cypress E2E**: Keyboard navigation flow covered by E2E tests
- [ ] **Manual SR testing**: Tested with NVDA+Chrome/Firefox and VoiceOver+Safari

---

## Implementation Phases

### Phase 1: Foundation (Focus Infrastructure)

#### 1.1 SCSS Focus Variables

**File**: `src/components/vars.scss`

Add focus ring variables:
```scss
// Focus indicators (WCAG 2.2 AA compliant)
// Double border: outer blue + inner white for visibility on all backgrounds
$focus-ring-color: #0957D0;
$focus-ring-inner-color: #FFFFFF;
$focus-ring-outer-width: 2px;
$focus-ring-inner-width: 1px;

// Extend :export block
:export {
  focusRingColor: $focus-ring-color;
  focusRingInnerColor: $focus-ring-inner-color;
  focusRingOuterWidth: $focus-ring-outer-width;
  focusRingInnerWidth: $focus-ring-inner-width;
}
```

**Contrast validation task**: Before finalizing, run contrast checker against all CLUE background colors:
- White document background
- Gray panel backgrounds (#F5F5F5, #E0E0E0)
- Colored tile borders
- Selected tile highlight color

The white inner border (#FFFFFF) provides fallback contrast on dark backgrounds.

#### 1.2 Global Focus Styles

**File**: `src/components/app.scss` (new section)

Add base focus styles:
```scss
@import './vars.scss';

// Remove existing outline: none declarations (audit and replace)
// Add visible focus indicators for all interactive elements
// Double border: inner white (box-shadow) + outer blue (outline)

:focus-visible {
  outline: $focus-ring-outer-width solid $focus-ring-color;
  outline-offset: $focus-ring-inner-width;
  box-shadow: 0 0 0 $focus-ring-inner-width $focus-ring-inner-color;
}

// Inset variant for overflow:hidden containers
.focus-inset:focus-visible {
  outline-offset: -($focus-ring-outer-width + $focus-ring-inner-width);
  box-shadow: inset 0 0 0 $focus-ring-inner-width $focus-ring-inner-color;
}
```

**Migration task**: Search for `outline: none` declarations and evaluate each:
- `tile-component.scss` — replace with custom focus style
- `link-indicator.scss` — replace with custom focus style
- `playback-control.scss` — replace with custom focus style
- `geometry-tile.scss` — replace with custom focus style (if appropriate)

#### 1.3 ARIA Labels Hook

**File**: `src/hooks/use-aria-labels.ts` (new)

Provide all ARIA labels via a hook for co-location, future localization, and authoring support:

```typescript
/**
 * Hook providing ARIA labels for accessibility.
 * Co-locates all labels for:
 * - Future localization (i18n) via context
 * - Potential authoring customization via AppConfig
 * - Consistency across components
 */
export function useAriaLabels() {
  // Future: could pull from i18n context or AppConfig
  // const { locale } = useI18n();
  // const { ariaOverrides } = useAppConfig();

  return {
    // Landmark regions
    header: "CLUE Header",
    resourcesPane: "Resources",
    workspacePane: "My Workspace",
    documentTiles: "Document tiles",

    // Navigation
    skipToMain: "Skip to My Workspace",
    resourceTabs: "Resource navigation",

    // Dynamic label functions
    tabPanel: (tabName: string) => `${tabName} content`,
    tile: (tileType: string) => `${tileType} tile`,
    chat: (expanded: boolean) => expanded ? "Collapse chat" : "Expand chat",

    // Tile toolbar
    tileToolbar: "Tile toolbar",

    // Live region
    announcements: "Status announcements",

    // Screen reader announcements (for aria-live regions)
    // These MUST be co-located with labels for consistent i18n
    announce: {
      editingTile: "Editing tile",
      exitedTile: "Exited tile",
      tileSelected: (tileType: string) => `${tileType} tile selected`,
      tileAdded: (tileType: string) => `${tileType} tile added`,
      tileRemoved: (tileType: string) => `${tileType} tile removed`,
      panelSelected: (panelName: string) => `${panelName} panel selected`,
    },
  };
}

// Type for consumers
export type AriaLabels = ReturnType<typeof useAriaLabels>;
```

**Usage in components**:
```tsx
const ariaLabels = useAriaLabels();

<header role="banner" aria-label={ariaLabels.header}>
<main role="main" aria-label={ariaLabels.workspacePane}>
<div aria-label={ariaLabels.tile(tileType)}>
```

**Future extensibility**: The hook can later:
- Read from i18n context for localization
- Pull overrides from AppConfig/curriculum
- Accept parameters for unit-specific labels

**Verification**: During implementation, audit all components to ensure NO hardcoded aria-labels or announcement strings exist outside this hook. All accessibility strings should flow through `useAriaLabels()` for consistent localization. Common places to check:
- `aria-label` attributes on landmarks, buttons, toolbars
- Strings passed to `announce()` function
- `title` attributes used for accessibility

#### 1.4 FocusManager Utility

**File**: `src/utilities/focus-manager.ts` (new)

```typescript
interface FocusRegion {
  id: string;
  element: HTMLElement;
  type: 'region' | 'composite' | 'trap';
}

class FocusManager {
  private regions: Map<string, FocusRegion> = new Map();
  private focusMemory: Map<string, HTMLElement> = new Map();
  private currentTrap: string | null = null;

  registerRegion(region: FocusRegion): void;
  unregisterRegion(id: string): void;

  // Focus memory
  setFocusMemory(regionId: string, element: HTMLElement): void;
  getFocusMemory(regionId: string): HTMLElement | null;

  // Trap management
  enterTrap(regionId: string): void;
  exitTrap(): void;
  isInTrap(): boolean;

  // Keyboard vs mouse tracking
  isKeyboardNavigation(): boolean;
}

export const focusManager = new FocusManager();
```

**Keyboard vs mouse tracking implementation**:
The `isKeyboardNavigation()` method needs to track input modality so we don't steal focus on mouse clicks. Implementation approach:

```typescript
class FocusManager {
  private lastInputWasKeyboard = false;

  constructor() {
    // Track input modality globally
    document.addEventListener('keydown', (e) => {
      // Only count navigation keys, not typing
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
        this.lastInputWasKeyboard = true;
      }
    }, { capture: true });

    document.addEventListener('mousedown', () => {
      this.lastInputWasKeyboard = false;
    }, { capture: true });
  }

  isKeyboardNavigation(): boolean {
    return this.lastInputWasKeyboard;
  }
}
```

**Lifecycle requirements**:
- Every `registerRegion()` call MUST have a corresponding `unregisterRegion()` in useEffect cleanup
- All focus operations must handle null refs gracefully (element may have unmounted)
- `getFocusMemory()` should validate the returned element is still in DOM (`element.isConnected`) before returning
- **StrictMode idempotency**: `registerRegion()` must be idempotent — repeated calls with same ID should update (not duplicate) the registration. React 18 StrictMode mounts/unmounts effects twice in dev; the singleton must tolerate this without corrupting region ordering or focus memory
- **unregisterRegion() tolerance**: Must be idempotent — tolerate "unregister twice" calls without throwing (StrictMode dev patterns)
- **Memory cleanup**: `unregisterRegion()` must also clear the corresponding `focusMemory` entry to avoid retaining references to detached DOM elements

**Debug logging** (nice-to-have for supportability):
```typescript
class FocusManager {
  private debug = localStorage.getItem('debug')?.includes('focus') ?? false;

  private log(message: string, ...args: unknown[]) {
    if (this.debug) {
      console.log(`[FocusManager] ${message}`, ...args);
    }
  }

  registerRegion(region: FocusRegion): void {
    this.log('registerRegion', region.id, region.type);
    // ...
  }

  enterTrap(regionId: string): void {
    this.log('enterTrap', regionId);
    // ...
  }
}
```
This integrates with CLUE's existing `debug` localStorage pattern (see CLAUDE.md), enabling `localStorage.setItem('debug', 'focus')` to trace focus state changes during development and troubleshooting.

#### 1.5 HotKeys Extension

**File**: `src/utilities/hot-keys.ts`

Extend key mapping to include navigation keys:
```typescript
// Add to keyMap
37: "left",    // Already exists
38: "up",      // Already exists
39: "right",   // Already exists
40: "down",    // Already exists
13: "enter",   // Add
27: "escape",  // Add
36: "home",    // Add
35: "end",     // Add
// NOTE: Do NOT add Tab (9) here — Tab is browser-handled except in explicit trap contexts
```

**Arrow key interception rules** (critical for screen reader compatibility):
Arrow keys are screen reader commands in browse/virtual cursor modes (NVDA, JAWS, VoiceOver). Intercept arrows ONLY when:
1. Focus is on a defined composite container (tile canvas, tab list) AND
2. `event.target` is the container or a child tile/tab element AND
3. Target is NOT an editable element (see detection below)

```typescript
function shouldInterceptArrows(event: KeyboardEvent): boolean {
  // Never intercept modified arrow keys (Ctrl, Alt, Cmd, Shift)
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;

  const target = event.target as HTMLElement;

  // Never intercept in editable contexts
  if (isEditableElement(target)) return false;

  // Only intercept when focus is inside a composite widget
  return target.closest('[role="grid"], [role="tablist"], .tile-canvas') !== null;
}

function isEditableElement(el: HTMLElement): boolean {
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  if (el.isContentEditable) return true;
  if (el.closest('[contenteditable="true"]')) return true;
  // Check for CodeMirror, Monaco, or other rich editors
  if (el.closest('.cm-editor, .monaco-editor, .slate-editor, .ProseMirror')) return true;
  // Check for iframes (may contain editors)
  if (el.closest('iframe')) return true;

  // PRINCIPLE: When in doubt, don't intercept.
  // If element has any unknown interactive role or looks like a custom widget,
  // assume it handles its own arrow keys.
  const role = el.getAttribute('role');
  if (role && ['textbox', 'combobox', 'searchbox', 'spinbutton', 'slider'].includes(role)) {
    return true;
  }

  return false;
}
```

**Safe default principle**: When in doubt, don't intercept arrow keys. It's better to have tile navigation fail (user can still Tab) than to break text editing in an unrecognized editor. The function includes common patterns but unknown interactive widgets should be assumed to handle their own arrows.

**Future extensibility**: The CSS selector list in `isEditableElement()` will drift as new tile types and editors are added. Consider a future extension point where tile plugins can declare:
```typescript
// In tile plugin registration
{
  id: 'my-tile',
  handlesOwnArrowKeys: true,  // Opt out of arrow interception
  isEditableSelector: '.my-custom-editor'  // Additional selectors
}
```
This avoids maintaining a growing allowlist. For now, the hardcoded list is acceptable; revisit if it becomes a maintenance burden.

**Follow-up ticket recommended**: Create a ticket for "Tile plugin arrow key opt-out API" if multiple tile types need custom editor detection. Until then, treat unknown embedded editors as editable by default when they match common wrapper patterns.

**Exports required**: The following must be exported from `hot-keys.ts` for use by other modules:
- `isEditableElement(el: HTMLElement): boolean` — used by focus trap hook
- `FOCUSABLE_SELECTOR: string` — used by canvas navigation and focus trap hooks

If circular dependencies arise (e.g., hot-keys imports from a hook that imports these), extract to a separate `src/utilities/focus-utils.ts` file.

**Tab key handling**: Do NOT route Tab through HotKeys dispatch. Handle Tab only in explicit focus trap contexts (Phase 5). Let browser handle default Tab navigation between regions.

**Preserve existing behavior**: Ensure Ctrl+Z/Ctrl+Y (undo/redo), Ctrl+C/Ctrl+V (copy/paste), and other existing shortcuts continue to work. Navigation keys should not conflict with these modifier-based shortcuts.

**Modifier keys pass-through**: Never intercept arrow keys with modifiers (Ctrl+Arrow, Alt+Arrow, Cmd+Arrow, Shift+Arrow). These combinations have system/application meanings:
- **Ctrl+Arrow**: Word navigation in text fields
- **Shift+Arrow**: Text selection (character-by-character in fields, or multi-select in lists)
- **Ctrl+Shift+Arrow**: Word selection
- **Alt+Arrow**: Browser history navigation (some browsers)
- **Cmd+Arrow** (macOS): Line start/end navigation

All modifier+arrow combinations pass through to browser/native handler. This check is included in `shouldInterceptArrows()` above. Note: Shift+Arrow specifically does NOT multi-select tiles — CLUE's tile selection model is single-select only, so Shift+Arrow has no meaning at the tile canvas level and safely passes through.

---

### Phase 2: Landmark Roles and Skip Navigation

#### 2.1 Workspace Landmarks

**File**: `src/components/workspace/workspace.tsx`

Add landmark roles to main containers:

```tsx
const ariaLabels = useAriaLabels();

// Header region
<header role="banner" aria-label={ariaLabels.header}>
  {/* existing header content */}
</header>

// Resources pane (left)
<nav role="navigation" aria-label={ariaLabels.resourcesPane}>
  <NavTabPanel ... />
</nav>

// Workspace pane (right) — id is target for skip link
<main role="main" id="main-workspace" aria-label={ariaLabels.workspacePane} tabIndex={-1}>
  <DocumentWorkspaceComponent ... />
</main>
```

#### 2.2 Skip Navigation Link

**File**: `src/components/workspace/workspace.tsx`

Add skip link as first focusable element:

```tsx
<a
  href="#main-workspace"
  className="skip-link"
  onClick={(e) => {
    e.preventDefault();
    document.getElementById('main-workspace')?.focus();
  }}
>
  {ariaLabels.skipToMain}
</a>
```

**File**: `src/components/workspace/workspace.scss`

```scss
.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 9999;

  // Intentionally uses :focus (not :focus-visible) so the link appears
  // whenever focused, including programmatic focus. Skip links should
  // always be visible when active regardless of input modality.
  &:focus {
    left: 10px;
    top: 10px;
    padding: 8px 16px;
    background: white;
    border: $focus-ring-outer-width solid $focus-ring-color;
  }
}
```

---

### Phase 3: Tab Navigation Between Regions

**Key principle**: Do NOT intercept Tab key at region boundaries. Instead, rely on:
1. **Proper DOM order** matching visual layout (Header → Resources → Workspace)
2. **Roving tabindex** within each region (only one element per region has `tabIndex=0`)
3. **Skip link** for users who want to bypass regions
4. **Landmarks** for screen reader navigation

This approach lets the browser handle Tab naturally, which is more accessible and less error-prone than manually teleporting focus.

#### 3.1 Region Registration Hook

**File**: `src/hooks/use-region-navigation.ts` (new)

The hook registers regions for focus memory tracking (not Tab interception):

```typescript
export function useRegionNavigation(regionId: string) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      focusManager.registerRegion({
        id: regionId,
        element: ref.current,
        type: 'region'
      });
    }
    return () => focusManager.unregisterRegion(regionId);
  }, [regionId]);

  return { ref };
}
```

**Note**: No `handleKeyDown` for Tab — browser handles Tab navigation natively. The hook only registers the region for focus memory purposes.

#### 3.2 Apply to Workspace Regions

**File**: `src/components/workspace/workspace.tsx`

```tsx
const { ref: resourcesRef } = useRegionNavigation('resources');
const { ref: workspaceRef } = useRegionNavigation('workspace');
```

#### 3.3 Ensure Proper DOM Order

Verify that the DOM structure matches the intended Tab order:

```tsx
<div className="workspace">
  <SkipLink />                    {/* Tab stop 1 */}
  <header role="banner">...</header>  {/* Tab stop 2 (if focusable content) */}
  <nav role="navigation" ref={resourcesRef}>
    <TabList>...</TabList>        {/* Tab stop 3 (roving tabindex) */}
  </nav>
  <main role="main" ref={workspaceRef}>
    <DocumentToolbar>...</DocumentToolbar>  {/* Tab stop 4 */}
    <TileCanvas>...</TileCanvas>  {/* Tab stop 5 (roving tabindex) */}
  </main>
</div>
```

If DOM order doesn't match visual order, restructure the components rather than intercepting Tab.

---

### Phase 4: Tile Canvas Arrow Navigation

#### 4.1 Roving Tabindex Hook

**File**: `src/hooks/use-tile-canvas-navigation.ts` (new)

```typescript
// Selector for focusable elements (shared with focus-trap hook)
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Helper: Build 2D array of tile IDs from row models
function buildTileGrid(rows: TileRowModelType[]): string[][] {
  return rows.map(row => row.tiles.map(tile => tile.tileId));
}

// Helper: Find tile's position in grid
function findTilePosition(grid: string[][], tileId: string): { row: number; col: number } {
  for (let row = 0; row < grid.length; row++) {
    const col = grid[row].indexOf(tileId);
    if (col !== -1) return { row, col };
  }
  return { row: -1, col: -1 }; // Not found
}

interface TileCanvasNavigationOptions {
  rows: TileRowModelType[];
  selectedTileId: string | null;
  onTileSelect: (tileId: string) => void;
}

export function useTileCanvasNavigation(options: TileCanvasNavigationOptions) {
  const { rows, selectedTileId, onTileSelect } = options;

  // Build 2D tile grid for navigation
  const tileGrid = useMemo(() => buildTileGrid(rows), [rows]);

  const handleKeyDown = useCallback((e: KeyboardEvent): boolean => {
    if (!selectedTileId) return false;

    // Pass through modified arrow keys (Ctrl+Arrow for word nav, Shift+Arrow for selection, etc.)
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return false;

    const { row, col } = findTilePosition(tileGrid, selectedTileId);
    let nextTileId: string | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        nextTileId = tileGrid[row]?.[col - 1] || null;
        break;
      case 'ArrowRight':
        nextTileId = tileGrid[row]?.[col + 1] || null;
        break;
      case 'ArrowUp':
        nextTileId = tileGrid[row - 1]?.[col] || tileGrid[row - 1]?.[0] || null;
        break;
      case 'ArrowDown':
        nextTileId = tileGrid[row + 1]?.[col] || tileGrid[row + 1]?.[0] || null;
        break;
      case 'Home':
        nextTileId = tileGrid[row]?.[0] || null;
        break;
      case 'End':
        nextTileId = tileGrid[row]?.[tileGrid[row].length - 1] || null;
        break;
      // NOTE: Enter key is NOT handled here — it's handled by tile-component
      // where the focus trap hook is available (see Phase 5.2)
    }

    if (nextTileId && nextTileId !== selectedTileId) {
      e.preventDefault();
      e.stopPropagation();
      onTileSelect(nextTileId);
      return true; // Handled
    }

    return false; // Not handled
  }, [tileGrid, selectedTileId, onTileSelect]);

  return { handleKeyDown };
}
```

**Dynamic updates**: The tile canvas is dynamic—users can add, delete, reorder, and resize tiles. The hook must:
- Rebuild `tileGrid` when `rows` changes (handled by `useMemo` dependency)
- Handle case where `selectedTileId` no longer exists (tile was deleted) — fall back to first tile or clear selection
- Handle case where selected tile moves to a different row/position — navigation should use new position
- Use MobX `observer` pattern or subscribe to MST model changes to react to tile mutations

#### 4.2 ARIA Grid Structure

**Important**: If tiles use `role="gridcell"`, the parent structure MUST follow the ARIA grid pattern:

```tsx
const ariaLabels = useAriaLabels();

// Canvas container
// aria-rowcount and aria-colcount help SR announce "row 2 of 4, column 1 of 3"
// colcount uses max columns across all rows (rows may have different tile counts)
const maxColCount = Math.max(...rows.map(r => r.tiles.length), 0);

<div
  role="grid"
  aria-label={ariaLabels.documentTiles}
  aria-rowcount={rows.length}
  aria-colcount={maxColCount}
  className="tile-canvas"
  onKeyDown={handleKeyDown}
>
  {rows.map((row, rowIndex) => (
    // Each row — aria-rowindex is 1-based
    <div role="row" key={row.id} aria-rowindex={rowIndex + 1} className="tile-row">
      {row.tiles.map((tile, colIndex) => (
        // TileComponent IS the gridcell (has role="gridcell" internally)
        // Pass aria-colindex for SR position announcements
        <TileComponent key={tile.tileId} ariaColIndex={colIndex + 1} ... />
      ))}
    </div>
  ))}
</div>
```

**Note**: `aria-rowindex` and `aria-colindex` are 1-based per ARIA spec. The TileComponent should apply `aria-colindex` to its gridcell element.

**Caution on grid indexes**: These attributes are primarily useful for virtualized/partially-rendered grids. Since CLUE renders all tiles in DOM, many screen readers infer positions correctly without explicit indexes. Consider making these attributes **optional** during initial implementation:
- `aria-colcount = max columns` may cause confusing "column X of Y" announcements when rows have fewer cells
- If you add indexes, they MUST be kept consistent during add/delete/reorder operations — otherwise announcements will be worse than having none
- Test with NVDA/VoiceOver first without explicit indexes; add them only if position announcements are missing or incorrect

**Note**: The `role="gridcell"` is placed on the TileComponent itself (see Phase 4.4), not on a wrapper div. This ensures the focusable element and the gridcell are the same element.

**Alternative**: If the full grid pattern is too complex (e.g., variable columns per row), consider using a simpler pattern:
- `role="listbox"` + `role="option"` for a flat list
- No roles (plain divs) with just roving tabindex — still accessible, just less semantic

The grid pattern is recommended because it matches the 2D arrow-key navigation model.

**Event handling location**: Navigation keys (Arrow, Home, End) are handled at the grid container level via `onKeyDown`. When handled, `stopPropagation()` is required to prevent double-processing by tile-level handlers or HotKeys. Tile-level handlers only process Enter (trap entry) and trap-internal keys; all other keys bubble to grid.

#### 4.3 Canvas Component Integration

**File**: `src/components/document/canvas.tsx`

```tsx
const { handleKeyDown: handleTileNavigation } = useTileCanvasNavigation({
  rows: content.rowOrder,
  selectedTileId: ui.selectedTileIds[0] || null,
  onTileSelect: (id) => ui.setSelectedTile(document.content.tileMap.get(id))
});

// Combine with existing hotkey handler
// IMPORTANT: "handled" contract - when handleTileNavigation returns true:
// - The event has been preventDefault()'d and stopPropagation()'d
// - Selection/focus target updated; focus will move via roving-tabindex effect (Phase 4.4)
// - Caller MUST NOT call hotKeys.dispatch() — doing so would double-process the event
const handleKeyDown = (e: React.KeyboardEvent) => {
  const handled = handleTileNavigation(e.nativeEvent);
  if (!handled) {
    hotKeys.dispatch(e.nativeEvent);
  }
};
```

#### 4.4 Tile Component Focus

**File**: `src/components/tiles/tile-component.tsx`

Change `tabIndex` from `-1` to `0` for selected tile (roving pattern):

```tsx
const ariaLabels = useAriaLabels();

<div
  className={classNames("tile-component", ...)}
  tabIndex={isSelected ? 0 : -1}
  role="gridcell"
  aria-label={ariaLabels.tile(tileType)}
  aria-colindex={ariaColIndex}  // Passed from parent (Phase 4.2)
  data-tile-id={tileId}         // For Cypress test correlation (Phase 8.3)
  onKeyDown={handleKeyDown}
  ref={tileRef}
>
```

**Props addition**: Add `ariaColIndex?: number` to `TileComponentProps` interface to accept the column index from parent.

Add effect to focus when selected via keyboard:
```tsx
useEffect(() => {
  if (isSelected && document.activeElement !== tileRef.current) {
    // Only focus if selection came from keyboard (not mouse)
    if (focusManager.isKeyboardNavigation()) {
      tileRef.current?.focus();
    }
  }
}, [isSelected]);
```

---

### Phase 5: Tile Focus Trap

**Focus return contract**: When exiting a trap (Escape or Up arrow), focus MUST return to a deterministic location:
1. Focus returns to the tile container element (the `[role="gridcell"]` div)
2. The tile container receives `tabIndex={0}` (roving tabindex active state)
3. The tile remains selected in the UI state
4. Screen reader announces "Exited tile" via aria-live region
5. **Subsequent navigation**: After exit, the user is back in tile-canvas navigation mode — a subsequent Up arrow press will move to the tile in the row above (if any), Left/Right will move within the row, etc. The exit does NOT consume the next arrow press.

This prevents "focus lost to body" scenarios that confuse SR users. The two-step gesture (Up to exit trap, Up again to move to row above) is intentional and matches standard grid/spreadsheet behavior.

**Focus entry contract**: When entering a trap (Enter key), focus should land on the most likely edit target in this priority order:
1. **Title input** (if tile title is editable and not read-only)
2. **First toolbar button** (if no editable title)
3. **First focusable content element** (if no toolbar buttons)
4. **Tile container itself** (fallback if no focusable elements — trap is effectively a no-op)

This ensures users land on something actionable, not just "first focusable" which might be surprising.

#### 5.1 Focus Trap Hook

**File**: `src/hooks/use-tile-focus-trap.ts` (new)

**Trap boundary definition**: The trap boundary is a computed set of focusable elements from BOTH:
1. The tile's DOM subtree (title, content controls)
2. The toolbar's DOM subtree (in FloatingPortal)

This set must be recomputed when toolbar buttons change (enabled/disabled state).

**DOM replacement handling**: The toolbar may re-render completely when buttons change (e.g., tile type changes which tools are available). The `getFocusableElements` function queries the current DOM on each call rather than caching elements, ensuring it handles toolbar DOM replacement gracefully. If `toolbarRef.current` becomes null temporarily during re-render, the function returns only tile elements (safe degradation).

```typescript
import { announce } from '../utilities/announcer';
import { useAriaLabels } from './use-aria-labels';
import { focusManager } from '../utilities/focus-manager';
// NOTE: isEditableElement and FOCUSABLE_SELECTOR must be exported from hot-keys.ts
// as stable utilities. Watch for circular dependencies: if hot-keys imports from
// this hook, extract these utilities to a separate file (e.g., focus-utils.ts).
import { isEditableElement, FOCUSABLE_SELECTOR } from '../utilities/hot-keys';

export function useTileFocusTrap(tileId: string, toolbarRef: RefObject<HTMLElement>) {
  const [isTrapped, setIsTrapped] = useState(false);
  const tileRef = useRef<HTMLElement>(null);
  const ariaLabels = useAriaLabels();

  // Compute trap boundary: tile subtree + portal toolbar subtree
  // Re-runs when toolbar changes (buttons enabled/disabled)
  const getFocusableElements = useCallback(() => {
    const tileElements = tileRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [];
    const toolbarElements = toolbarRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [];
    return [...tileElements, ...toolbarElements].filter(
      el => !el.hasAttribute('disabled') && el.tabIndex !== -1
    );
  }, [toolbarRef]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isTrapped) return;

    const target = e.target as HTMLElement;

    // Exit trap: Escape always exits, ArrowUp only exits if not in editable element
    const shouldExit = e.key === 'Escape' ||
      (e.key === 'ArrowUp' && !isEditableElement(target));

    if (shouldExit) {
      e.preventDefault();
      setIsTrapped(false);
      focusManager.exitTrap();
      announce(ariaLabels.announce.exitedTile);
      tileRef.current?.focus();
      return;
    }

    if (e.key === 'Tab') {
      // Cycle within trap
      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
      let nextIndex: number;

      if (e.shiftKey) {
        nextIndex = currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex >= elements.length - 1 ? 0 : currentIndex + 1;
      }

      e.preventDefault();
      (elements[nextIndex] as HTMLElement).focus();
    }
  }, [isTrapped, getFocusableElements, ariaLabels]);

  const enterTrap = useCallback(() => {
    setIsTrapped(true);
    announce(ariaLabels.announce.editingTile);

    // Focus entry contract priority:
    // 1. Title input (if editable)
    // 2. First toolbar button
    // 3. First focusable content element
    // 4. Tile container (fallback)
    const titleInput = tileRef.current?.querySelector('.tile-title-input:not([readonly])') as HTMLElement;
    if (titleInput) {
      titleInput.focus();
      return;
    }

    const toolbarButton = toolbarRef.current?.querySelector('button:not([disabled])') as HTMLElement;
    if (toolbarButton) {
      toolbarButton.focus();
      return;
    }

    const elements = getFocusableElements();
    if (elements.length > 0) {
      (elements[0] as HTMLElement).focus();
      return;
    }

    // Fallback: keep focus on container (trap is no-op)
    tileRef.current?.focus();
  }, [getFocusableElements, ariaLabels]);

  return { tileRef, isTrapped, enterTrap, handleKeyDown };
}
```

#### 5.2 Tile Component Integration

**File**: `src/components/tiles/tile-component.tsx`

```tsx
const { tileRef, isTrapped, enterTrap, handleKeyDown: handleTrapKeyDown } =
  useTileFocusTrap(tileId, toolbarRef);

const handleKeyDown = (e: React.KeyboardEvent) => {
  // Check for trap entry
  if (e.key === 'Enter' && !isTrapped) {
    enterTrap();
    e.preventDefault();
    return;
  }

  // Handle trap navigation
  if (isTrapped) {
    handleTrapKeyDown(e.nativeEvent);
    return;
  }

  // When not in trap, let event bubble to canvas for navigation handling.
  // Do NOT call hotKeys.dispatch here — canvas handles both navigation
  // and hotKeys dispatch (see Phase 4.3). Calling here would double-process.
};

// Add trapped state to className for visual feedback
<div
  className={classNames("tile-component", { "tile-focus-trapped": isTrapped }, ...)}
  ...
>
```

**File**: `src/components/tiles/tile-component.scss`

Add visual differentiation for trapped state:
```scss
.tile-component.tile-focus-trapped {
  // Subtle visual indicator that tile is in "edit mode"
  // Could be inner glow, different border color, or background tint
  box-shadow: inset 0 0 0 2px rgba($focus-ring-color, 0.2);
}
```

#### 5.3 Toolbar Focus Integration

**File**: `src/components/toolbar/tile-toolbar.tsx`

Pass ref to parent for focus trap inclusion:

```tsx
// Add forwardRef — props must include tileId for test correlation
const TileToolbar = forwardRef<HTMLDivElement, TileToolbarProps>((props, ref) => {
  const { tileId, ...rest } = props;
  const ariaLabels = useAriaLabels();

  return (
    <FloatingPortal>
      <div
        ref={ref}
        role="toolbar"
        aria-label={ariaLabels.tileToolbar}
        data-tile-id={tileId}  // For Cypress test correlation (Phase 8.3)
        className="tile-toolbar"
        ...
      >
```

**Pre-implementation check**: Verify if `TileToolbar` already uses a ref internally. If so, use a `useMergeRefs` utility to combine the forwarded ref with the internal ref.

---

### Phase 6: Nav Tab Panel Enhancements

#### 6.1 ARIA Labels

**File**: `src/components/navigation/nav-tab-panel.tsx`

Add aria-labels to tab list and panels:

```tsx
const ariaLabels = useAriaLabels();

<TabList aria-label={ariaLabels.resourceTabs}>
  ...
</TabList>

<TabPanel aria-label={ariaLabels.tabPanel('Problems')}>
  ...
</TabPanel>
```

**Verification**: Confirm that `react-tabs` automatically adds `aria-selected="true"` to active tabs. If not, add it manually to match WAI-ARIA tabs pattern.

#### 6.2 Custom Arrow Key Handling for Subtabs

**File**: `src/components/navigation/nav-tab-panel.tsx`

Add handler for Down/Up arrow to navigate into/out of subtabs:

```tsx
const handleTabKeyDown = (e: React.KeyboardEvent, isSubtab: boolean) => {
  if (e.key === 'ArrowDown' && !isSubtab && hasSubtabs) {
    // Focus first subtab
    e.preventDefault();
    focusFirstSubtab();
  } else if (e.key === 'ArrowUp' && isSubtab) {
    // Return to parent tab
    e.preventDefault();
    focusParentTab();
  }
};
```

#### 6.3 Chat Panel Keyboard Access

Ensure Chat toggle button is in tab order after tab content:

```tsx
const ariaLabels = useAriaLabels();

<button
  className="chat-toggle"
  aria-label={ariaLabels.chat(chatExpanded)}
  aria-expanded={chatExpanded}
  onClick={toggleChat}
>
```

---

### Phase 7: Screen Reader Announcements

#### 7.1 Live Region Setup

**File**: `src/components/workspace/workspace.tsx`

Add live region container:

```tsx
<div
  aria-live="polite"
  aria-atomic="true"
  className="sr-only live-region"
  id="clue-announcements"
/>
```

**File**: `src/components/app.scss` (add utility class)

```scss
// Screen-reader-only utility class — visually hidden but accessible to SR
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Note**: If the codebase already has a `.visually-hidden` or similar utility class, use that instead and update the className accordingly.

**Critical**: The chosen utility class must NOT use `display: none` or `visibility: hidden` — these hide content from screen readers entirely. The pattern above (1px size + clip + overflow) is the standard SR-safe visually-hidden technique. Verify any existing utility follows this pattern before reusing.

#### 7.2 Announcement Utility

**File**: `src/utilities/announcer.ts` (new)

```typescript
let announceTimeout: number | null = null;
let announceRafId: number | null = null;

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const region = document.getElementById('clue-announcements');
  if (!region) return;

  // Cancel any pending operations to prevent interleaving when users arrow quickly
  if (announceTimeout) {
    clearTimeout(announceTimeout);
    announceTimeout = null;
  }
  if (announceRafId) {
    cancelAnimationFrame(announceRafId);
    announceRafId = null;
  }

  // Clear first, then set on next tick — ensures SR detects the change
  // even if the same message is announced twice in a row
  region.textContent = '';
  region.setAttribute('aria-live', priority);

  announceRafId = requestAnimationFrame(() => {
    announceRafId = null;  // Clear after execution
    region.textContent = message;

    // Clear after a delay to reset for next announcement
    // Use longer delay (3s) to ensure SR has time to read
    announceTimeout = window.setTimeout(() => {
      region.textContent = '';
      announceTimeout = null;
    }, 3000);
  });
}
```

**Why this pattern**:
- Clearing then setting on next tick ensures screen readers detect changes even for repeated identical messages
- Time-based clearing (1s) was too short — NVDA/VoiceOver may not finish reading longer messages
- `requestAnimationFrame` ensures the clear happens before the set in the rendering cycle

#### 7.3 Integration Points

Announce on (using `ariaLabels` from hook):
- Tab panel switches: `announce(ariaLabels.announce.panelSelected('Problems'))`
- Tile added/removed: `announce(ariaLabels.announce.tileAdded('Text'))`
- Focus trap entry/exit: `announce(ariaLabels.announce.editingTile)` / `announce(ariaLabels.announce.exitedTile)`

---

### Phase 8: Testing

#### 8.1 Jest Unit Tests

**File**: `src/utilities/focus-manager.test.ts`
- Region registration/unregistration
- Focus memory get/set
- Trap entry/exit state
- **Keyboard vs mouse tracking**: `isKeyboardNavigation()` returns true after navigation keydown, false after mousedown

**File**: `src/hooks/use-tile-canvas-navigation.test.ts`
- Arrow key navigation (all directions)
- Boundary behavior (stops at edges)
- Home/End key behavior

**File**: `src/hooks/use-tile-focus-trap.test.ts`
- Tab cycling within trap
- Escape/Up arrow exit
- Focus order (title → toolbar → content)
- **Toolbar re-render stability**: When toolbar buttons change (enable/disable) during Tab cycling, focus should move to next valid element (not get lost)

**File**: `src/hooks/use-tile-canvas-navigation.test.ts` (additional)
- **Focus recovery on tile deletion**: When the focused tile is deleted, focus should move to a sane neighbor (next tile in row, or previous tile, or first tile in previous row)

#### 8.2 Jest-Axe Accessibility Tests

**File**: `src/components/workspace/workspace.test.tsx`
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('workspace has no accessibility violations', async () => {
  const { container } = render(<WorkspaceComponent ... />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

#### 8.3 Cypress Keyboard Navigation Tests

**File**: `cypress/e2e/keyboard-navigation.cy.ts` (new)

**Portal selector strategy**: Because `TileToolbar` uses `FloatingPortal`, toolbar elements are rendered as direct children of `<body>`, NOT inside the tile's DOM subtree. Cypress assertions like `cy.get('.tile-component').find('.tile-toolbar')` will FAIL. Instead:
- Query toolbar elements directly by role/aria-label: `cy.get('[role="toolbar"]')` or `cy.get('[aria-label="Tile toolbar"]')`
- When checking if focused element is "in the tile's focus trap," check if it matches tile content OR toolbar selectors — they won't share a common ancestor
- **Recommended**: Add `data-tile-id` attribute to both the tile container and its toolbar. This allows correlating which toolbar belongs to which tile when multiple toolbars could exist transiently during re-render: `cy.get('[role="toolbar"][data-tile-id="tile-123"]')`

**Note on keyboard simulation**: The examples below use Cypress's built-in `.tab()` and `.type('{key}')` for readability. For production tests, prefer `cypress-real-events` for native keyboard behavior:
- `cy.realPress('Tab')` instead of `.tab()`
- `cy.realPress('Enter')` instead of `.type('{enter}')`
- `cy.realPress('ArrowRight')` instead of `.type('{rightarrow}')`

```typescript
import 'cypress-real-events/support';

describe('Keyboard Navigation', () => {
  beforeEach(() => {
    cy.visit('/app');
  });

  it('Tab navigates through major regions', () => {
    cy.get('body').focus();
    cy.realPress('Tab');
    cy.focused().should('have.attr', 'role', 'navigation');

    cy.realPress('Tab');
    cy.focused().should('have.attr', 'role', 'main');
  });

  it('Skip link jumps to My Workspace', () => {
    cy.get('body').focus();
    cy.realPress('Tab');
    cy.contains('Skip to My Workspace').should('be.visible');
    cy.realPress('Enter');
    cy.focused().should('have.attr', 'id', 'main-workspace');
  });

  it('Arrow keys navigate tiles', () => {
    // Focus tile canvas
    cy.get('[role="main"]').focus();
    cy.get('.tile-component').first().should('have.focus');

    // Navigate right
    cy.realPress('ArrowRight');
    cy.get('.tile-component').eq(1).should('have.focus');

    // Navigate down
    cy.realPress('ArrowDown');
    // Verify moved to tile in next row
  });

  it('Enter/Escape manage tile focus trap', () => {
    cy.get('[role="gridcell"]').first().focus();
    cy.realPress('Enter');
    // Should be in trap — verify by checking focused element has expected role/label
    // (Don't use DOM containment; portal elements won't be "within" tile)
    cy.focused().should('satisfy', (el) => {
      // Focus should be on title input, toolbar button, or content control
      return el.is('input, button, [role="button"], [contenteditable]');
    });

    cy.realPress('Escape');
    cy.get('[role="gridcell"]').first().should('have.focus');
  });

  it('Tab cycles through tile AND toolbar in FloatingPortal', () => {
    cy.get('[role="gridcell"]').first().focus();
    cy.realPress('Enter');
    // Tab through elements - toolbar is in portal, so query by role not containment
    cy.realPress('Tab');
    cy.realPress('Tab');
    cy.realPress('Tab');
    cy.focused().should('match', '[role="toolbar"] button, [aria-label="Tile toolbar"] button');
    // Continue tabbing should cycle back (focus lands on element in tile or title)
    cy.realPress('Tab');
    // Verify we're back in the tile's content area by checking for tile-related attributes
    cy.focused().should('satisfy', (el) => {
      return el.closest('[role="gridcell"]').length > 0 ||
             el.is('.tile-title-input') ||
             el.closest('[role="toolbar"]').length > 0;
    });
  });
});
```

#### 8.4 Manual Testing Checklist

Visual and UX verification (not automatable):
- [ ] Focus ring visible on white document background
- [ ] Focus ring visible on gray panel backgrounds
- [ ] Focus ring not clipped by `overflow: hidden` containers
- [ ] Tab order follows visual layout (left-to-right, top-to-bottom)
- [ ] Arrow navigation feels natural (no unexpected jumps)
- [ ] Mouse interactions still work after keyboard navigation
- [ ] No focus loss scenarios (deleted tile, closed panel, etc.)
- [ ] `.tile-focus-trapped` visual state is distinguishable from selected-only state
- [ ] Previously hidden focus states (canvas, draggable handles) look acceptable after `outline: none` removal

#### 8.5 Screen Reader Testing Matrix

Test with the following browser/screen reader combinations:

| Platform | Browser | Screen Reader | Priority |
|----------|---------|---------------|----------|
| Windows | Chrome | NVDA | High |
| Windows | Firefox | NVDA | High |
| macOS | Safari | VoiceOver | High (trap+portal risk) |
| macOS | Chrome | VoiceOver | Medium |

Verify:
- [ ] Landmark regions announced correctly
- [ ] Tab/panel switches announced via aria-live
- [ ] Tile selection and trap entry/exit announced
- [ ] All interactive elements have accessible names
- [ ] Arrow navigation does NOT fight SR browse/virtual cursor mode

**SR mode reality check**: Arrow navigation is expected to work when focus is inside the widget (forms/focus mode). In browse/virtual cursor mode, the SR may consume arrow keys for its own navigation, and that's acceptable—the UI must not break. Test that users can Tab into a composite widget and then use arrows; do not expect arrows to work before the user has interacted with the widget.

#### 8.6 Assistive Tech Sanity Checklist

Beyond screen readers, verify basic compatibility with:
- [ ] All actions possible with single-key or sequential key presses (no chord-only requirements)
- [ ] Sticky Keys (Windows/macOS accessibility feature) doesn't break navigation
- [ ] macOS Voice Control can activate focused elements
- [ ] Switch control (if available) can navigate major regions

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `src/hooks/use-aria-labels.ts` | Centralized ARIA labels (localization/authoring ready) |
| `src/utilities/focus-manager.ts` | Centralized focus coordination |
| `src/utilities/announcer.ts` | Screen reader announcements |
| `src/hooks/use-region-navigation.ts` | Tab between major regions |
| `src/hooks/use-tile-canvas-navigation.ts` | Arrow navigation in tile canvas |
| `src/hooks/use-tile-focus-trap.ts` | Focus trap for tile editing |
| `cypress/e2e/keyboard-navigation.cy.ts` | E2E keyboard tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/vars.scss` | Add focus ring variables |
| `src/components/app.scss` | Global focus-visible styles |
| `src/components/workspace/workspace.tsx` | Landmarks, skip link, live region |
| `src/components/workspace/workspace.scss` | Skip link styling |
| `src/components/navigation/nav-tab-panel.tsx` | ARIA labels, subtab navigation |
| `src/components/document/canvas.tsx` | Tile canvas keyboard handler |
| `src/components/tiles/tile-component.tsx` | Roving tabindex, focus trap |
| `src/components/tiles/tile-component.scss` | Remove outline:none, add focus styles |
| `src/components/toolbar/tile-toolbar.tsx` | Role, aria-label, forwardRef |
| `src/utilities/hot-keys.ts` | Add navigation keys |
| Multiple `.scss` files | Replace outline:none with focus styles |

### Test Files
| File | Type |
|------|------|
| `src/utilities/focus-manager.test.ts` | Unit test |
| `src/hooks/use-tile-canvas-navigation.test.ts` | Unit test |
| `src/hooks/use-tile-focus-trap.test.ts` | Unit test |
| `src/components/workspace/workspace.test.tsx` | jest-axe integration |
| `cypress/e2e/keyboard-navigation.cy.ts` | E2E test |

---

## Migration Notes

### `outline: none` Audit Results

A comprehensive audit of all `outline: none` / `outline: 0` declarations was performed across the codebase. Each instance was evaluated for whether it should be removed (to allow the global `:focus-visible` style to show) or kept (because it serves a specific purpose).

#### REMOVED (19 instances)

These suppressions were removed to allow keyboard focus indicators via the global `:focus-visible` styles:

| File | Element | Reason for removal |
|------|---------|-------------------|
| `tile-component.scss` | `.tool-tile` `&:focus` | Main tile element — needs visible focus for keyboard navigation. Changed to `&:focus:not(:focus-visible)` to suppress only mouse-click outline. |
| `tile-component.scss` | `.tool-tile-drag-handle` `&:focus` | Drag handle — now shows focus ring when keyboard-focused |
| `tile-component.scss` | `.tool-tile-resize-handle` `&:focus` | Resize handle — now shows focus ring when keyboard-focused |
| `problem-panel.scss` | `.buttons button` `outline: 0` | Action button — needs visible focus |
| `document.scss` | `.icon-edit` `&:focus` | Title edit icon — interactive button needs focus ring |
| `document.scss` | `.icon-sticky-note` `&:focus` | Sticky note icon — interactive button needs focus ring |
| `document.scss` | `.icon-button` `&:focus` | Titlebar action button — interactive button needs focus ring |
| `sort-work-view.scss` | `.switch-document-button` `outline: none` | Document navigation button — needs focus ring |
| `clue-app-header.scss` | `.middle button` `outline: none` | Header button — had comment "need focus/accessibility solution" which is now provided by global styles |
| `sixpack-right-controls.scss` | `button` `outline: none` | Teacher dashboard controls — needs focus ring |
| `chat-panel-header.scss` | `.chat-close-button` `&:active` | Close button active state — `:active` outline suppression is unnecessary with `:focus-visible` |
| `comment-card.scss` | `.comment-textbox select` `outline: none` | Dropdown select element — needs visible focus for keyboard users |
| `custom-modal.scss` | `.modal-close` `outline: none` | Modal close button — needs focus ring |
| `custom-modal.scss` | `.modal-button` `outline: none` | Modal action buttons — needs focus ring |
| `single-card-data-area.scss` | `input, textarea` `outline: none` | Data card form fields — needs focus indicator |
| `dataflow-rateselector-playback.scss` | `.datarate-options select` `outline: 0` | Dataflow rate selector — needs focus ring |
| `dataflow-program-toolbar.scss` | `button` `outline: 0` | Dataflow toolbar buttons — needs focus ring |
| `dataflow-program-zoom.scss` | `button` `&:focus` | Zoom +/- buttons — needs focus ring |
| `selection-button.scss` | `.selection-button` `outline: none` | Simulator selection toggle — needs focus ring |
| `link-indicator.scss` | `.icon-link-indicator` `&:focus` | Link indicator button — needs focus ring |

#### KEPT (10 instances)

These suppressions were kept because they serve a specific purpose:

| File | Element | Reason kept |
|------|---------|-------------|
| `custom-modal.scss` | `.custom-modal` container `outline: none` | Modal overlay container — not an interactive element; receives programmatic focus for trap. Outline on container would be visually distracting. |
| `link-tile-dialog.scss` | Modal container `outline: none` | Same as above — modal overlay, not interactive |
| `error-alert.scss` | Modal container `outline: none` | Same as above — modal overlay |
| `publish-dialog.scss` | Modal container `outline: none` | Same as above — modal overlay |
| `expressions-dialog.scss` | Modal container `outline: none` | Same as above — modal overlay |
| `group-management-modal.scss` | Modal container `outline: none` | Same as above — modal overlay |
| `dataflow-rateselector-playback.scss` | Slider `&-handle:focus` | Slider thumb — has custom `box-shadow` focus indicator |
| `dataflow-rateselector-playback.scss` | `.countdown-timer` `outline: 0` | Display-only timer element — not interactive |
| `playback-control.scss` | Slider thumb `outline: none` | Slider thumb — has custom visual focus indicator |
| `student-card.scss` | `:focus-visible` with custom styles | Already has custom focus indicator (not a suppression — replaces default with custom) |
| `column-header-cell.scss` | `.rdg-text-editor:focus` with `border-color` | Already has custom focus indicator via border change |
| `geometry-tile.scss` | `.geometry-content` `outline: none` | Non-interactive canvas content area — receives programmatic focus for drawing |
| `chat-panel-header.scss` | `.chat-close-button` `&:focus:not(:focus-visible)` | Already uses the correct pattern — suppresses only mouse-click outline |

### FloatingPortal Considerations

The `TileToolbar` uses FloatingPortal which renders outside the tile's DOM. The focus trap must:
1. Track both tile content AND toolbar elements
2. Pass toolbar ref from tile component to toolbar
3. Include toolbar elements in Tab cycling calculation

### React-Tabs Limitations

`react-tabs` doesn't natively support:
- Down arrow to enter subtabs
- Custom ARIA labels on TabList

Workaround: Add custom `onKeyDown` handler to tabs that intercepts Down/Up arrows before react-tabs processes them.

---

## Open Questions

### RESOLVED: Should focus indicator be different for tiles vs. buttons?

**Context**: The requirements specify a double-border focus style (2px blue #0957D0 outer + 1px white inner). Tiles are large containers while buttons are small targets. Should tiles have a more prominent indicator?

**Options**:
- A) Same style for all elements (simpler, consistent) — 2px blue + 1px white everywhere
- B) Thicker outline for tiles (3px blue + 2px white), standard for buttons (2px blue + 1px white)
- C) Same colors but larger offset for tiles to make the ring more visible on large containers

**Decision**: Defer until after initial implementation testing. Start with option A (same style everywhere). The SCSS architecture supports easy differentiation later (~10 lines of CSS) if visual QA determines tiles need more prominent indicators.

---

### RESOLVED: Should Ctrl/Cmd+Arrow skip multiple tiles?

**Context**: Some applications use Ctrl+Arrow as "jump" navigation (e.g., skip to end of row, or jump 5 items). Should CLUE support this?

**Options**:
- A) No modifier support (simple, fewer shortcuts to learn)
- B) Ctrl+Arrow jumps to first/last tile in direction
- C) Ctrl+Arrow is reserved for future use

**Decision**: Defer until after initial implementation testing. Start with option A (no modifier support). Home/End already cover jump-to-first/last in the current row. Adding Ctrl+Arrow later requires ~15-20 lines in the existing hook if users request it.

---

## Rollout Plan

### Phase 1: Foundation (Week 1)
- SCSS variables
- Global focus styles
- FocusManager utility
- HotKeys extension

### Phase 2: Landmarks (Week 1)
- Workspace landmarks
- Skip navigation link

### Phase 3: Region Navigation (Week 2)
- Tab between regions
- Focus memory per region

### Phase 4: Tile Canvas (Week 2-3)
- Roving tabindex
- Arrow key navigation
- Home/End support

### Phase 5: Focus Traps (Week 3)
- Enter/Escape trap entry/exit
- Tab cycling within tiles
- FloatingPortal integration

### Phase 6: Nav Panel (Week 3-4)
- ARIA labels
- Subtab arrow navigation
- Chat panel keyboard access

### Phase 7: Screen Reader (Week 4)
- Live regions
- Announcements

### Phase 8: Testing (Throughout)
- Unit tests (parallel with implementation)
- jest-axe integration (end of Phase 2)
- Cypress E2E (end of Phase 5)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| FloatingPortal focus escapes | High | High | Define single authoritative trap boundary; test toolbar button state changes |
| Screen reader arrow key conflicts | High | High | Only intercept arrows when focus is inside composite widget AND not in editable context |
| Breaking existing mouse interaction | Medium | High | Run full E2E suite after each phase |
| react-tabs keyboard conflicts | Medium | Medium | Custom handler intercepts before library; validate in NVDA + VoiceOver |
| Global `:focus-visible` visual regressions | High | Medium | Expect polish fixes; hidden focus states will surface in canvas, draggables, etc. |
| Safari/VoiceOver differences | Medium | High | `:focus-visible` support differs; test trap + portal extensively in Safari |
| Performance (focus tracking overhead) | Low | Medium | Profile focus operations; optimize if needed |
| Tile plugins with custom focus needs | Medium | Medium | Document extension points; defer to CLUE-391 |
| Rich editor detection misses | Medium | Medium | Expand `isEditableElement()` as new editor types discovered |
| DOM order doesn't match visual order | Low | High | Verify during implementation; restructure if needed (Phase 3.3) |

**Risk eliminated by design**: Tab interception at region boundaries was originally planned but removed after Copilot review. Relying on native browser Tab behavior eliminates a major source of potential accessibility bugs.

---

## Dependencies

- **Requirements document**: Must be finalized before implementation begins
- **jest-axe**: Need to add to devDependencies if not present
  ```bash
  npm install --save-dev jest-axe @types/jest-axe
  ```
- **cypress-real-events**: Required for realistic keyboard simulation in E2E tests. Cypress's built-in `.type('{tab}')` triggers synthetic events that may not match native keyboard behavior. `cypress-real-events` uses Chrome DevTools Protocol for native events.
  ```bash
  npm install --save-dev cypress-real-events
  ```
  Import in tests: `import 'cypress-real-events/support';` or add to `cypress/support/e2e.ts`

---

## Self-Review

### Senior Engineer

#### RESOLVED: FocusManager singleton vs. React Context
**Concern**: The `FocusManager` is implemented as a singleton class, but React hooks are functional. This could lead to lifecycle issues if components don't properly unregister regions.

**Resolution**: The singleton pattern is acceptable here because focus is global browser state, not component state. The `useEffect` cleanup in `useRegionNavigation` handles unregistration. Added explicit documentation in Phase 1.4 noting that all `registerRegion` calls must have corresponding `unregisterRegion` in useEffect cleanup.

#### RESOLVED: Error handling for focus operations
**Concern**: What happens if `tileRef.current` is null, or if a tile is deleted while focused?

**Resolution**: Add defensive checks in all focus operations. The `useTileCanvasNavigation` hook's dynamic updates note (Phase 4.1) already addresses deleted tiles. Added note to FocusManager to gracefully handle null refs and missing regions.

#### RESOLVED: Integration with undo/redo
**Concern**: Does keyboard navigation interfere with existing Ctrl+Z/Ctrl+Y shortcuts?

**Resolution**: No conflict. HotKeys already handles undo/redo. Navigation keys (arrows, Enter, Escape) are separate. Tab key override only applies when not in a text input. Added note to Phase 1.4 to preserve existing HotKeys behavior.

---

### React/TypeScript Expert

#### RESOLVED: TypeScript types completeness
**Concern**: The FocusManager class methods are shown but types for `FOCUSABLE_SELECTOR` and helper functions (`buildTileGrid`, `findTilePosition`) are not specified.

**Resolution**: Added type definitions to implementation:
- `FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'`
- `buildTileGrid(rows: TileRowModelType[]): string[][]` returns 2D array of tile IDs
- `findTilePosition(grid: string[][], tileId: string): { row: number; col: number }`

#### RESOLVED: Hook cleanup patterns
**Concern**: Event listeners added in hooks need proper cleanup to prevent memory leaks.

**Resolution**: All hooks using `useEffect` for event listener registration include cleanup functions. The pattern in Phase 3.1 demonstrates this with `return () => focusManager.unregisterRegion(regionId)`. This pattern applies to all hooks.

#### RESOLVED: Ref forwarding complexity
**Concern**: `TileToolbar` forwardRef pattern (Phase 5.3) needs to merge with any existing ref usage in that component.

**Resolution**: Use `useMergedRef` pattern if TileToolbar already uses refs internally. Added note that implementation should check for existing ref usage before adding forwardRef.

---

### WCAG Accessibility Expert

#### RESOLVED: aria-activedescendant alternative
**Concern**: Roving tabindex is one pattern; `aria-activedescendant` is another valid approach. Was this considered?

**Resolution**: Roving tabindex was chosen because it works better with the FloatingPortal architecture. `aria-activedescendant` requires focus to stay on a container while visually indicating the "active" child, which conflicts with our need to actually focus toolbar buttons in the portal. Decision documented in AD-2.

#### RESOLVED: Focus indicator contrast validation
**Concern**: The spec says #0957D0 "must be validated against actual backgrounds." Has this been done?

**Resolution**: This is a visual design task to be completed in Phase 1. Added explicit step: "Run contrast checker against all CLUE background colors (white document, gray panel, colored tile borders)." The white inner border provides fallback for dark backgrounds.

#### RESOLVED: aria-current for selected tab
**Concern**: Tabs should use `aria-selected="true"` (for tabs) but the plan doesn't mention verifying react-tabs provides this.

**Resolution**: `react-tabs` library automatically adds `aria-selected="true"` to the active tab. Verified in library documentation. Added note to Phase 6.1 to verify this behavior is present and not overridden.

#### NOTE: Keyboard help discoverability
**Concern**: How will users discover keyboard shortcuts?

**Status**: Out of scope per requirements.md. Follow-up ticket recommended for keyboard navigation help/legend UI.

---

### QA Engineer

#### RESOLVED: Manual testing checklist missing
**Concern**: Automated tests are comprehensive, but no manual testing checklist is provided for visual/UX verification.

**Resolution**: Added manual testing checklist to Phase 8:
- [ ] Focus ring visible on all backgrounds (light/dark)
- [ ] Focus ring not clipped by overflow:hidden containers
- [ ] Tab order follows visual layout
- [ ] Arrow navigation feels natural (no unexpected jumps)
- [ ] Screen reader announces focus changes appropriately
- [ ] Mouse interactions still work after keyboard navigation
- [ ] No focus loss scenarios (deleted tile, closed panel)

#### RESOLVED: Browser/screen reader test matrix
**Concern**: Which browser/screen reader combinations should be tested?

**Resolution**: Added to Phase 8.3 test requirements:
- Chrome + NVDA (Windows)
- Firefox + NVDA (Windows)
- Safari + VoiceOver (macOS)
- Chrome + VoiceOver (macOS)

#### RESOLVED: FloatingPortal focus trap testing
**Concern**: How to specifically test that focus trap includes portal-rendered toolbar?

**Resolution**: Added specific Cypress test case in Phase 8.3 that tabs through tile content and verifies focus reaches toolbar buttons (queried via `.tile-toolbar` selector since portal DOM is outside tile subtree).

---

### Student End User

#### RESOLVED: Learning curve for keyboard shortcuts
**Concern**: How will a student know to press Enter to edit a tile, or Escape to exit?

**Resolution**: While a keyboard shortcut legend is out of scope, the focus trap entry/exit is standard enough that most keyboard users will discover it. Additionally, screen reader announcements (Phase 7) will say "Editing tile" and "Exited tile" which provides audio cues. Recommended: Add visible "Press Enter to edit" tooltip on focused tile (follow-up ticket).

#### RESOLVED: Two-step gesture confusion
**Concern**: Navigating up from inside a tile requires Escape/Up to exit trap, then Up again to move to row above. This might confuse students.

**Resolution**: This is a standard pattern in grid widgets (e.g., spreadsheets require exiting cell edit mode before navigating). The announcement "Exited tile" provides feedback. If user testing reveals confusion, we can add a visual indicator showing "edit mode" vs. "navigation mode." Monitored as potential follow-up.

#### RESOLVED: Visual feedback for focus trap state
**Concern**: Is there visible indication that a tile is in "trapped" state vs. just selected?

**Resolution**: Added recommendation to Phase 5.2: When `isTrapped` is true, add `.tile-focus-trapped` class to tile component, which can have subtle visual differentiation (e.g., slightly different border color or inner glow). This helps students understand the current state.

#### NOTE: Focus recovery
**Concern**: What happens if focus somehow gets "lost" (e.g., focused element removed from DOM)?

**Status**: The dynamic updates handling in `useTileCanvasNavigation` (Phase 4.1) addresses deleted tiles by falling back to first tile. For other focus loss scenarios, browsers typically move focus to `<body>`. Could add a focus watchdog as follow-up if this becomes a problem in testing.

---

## External Review (Copilot)

### RESOLVED: Screen reader arrow key conflicts
**Concern**: Arrow keys are screen reader commands in browse/virtual cursor modes. Globally intercepting arrows makes UI fight the SR.

**Resolution**: Added explicit `shouldInterceptArrows()` and `isEditableElement()` functions in Phase 1.5. Arrows only intercepted when focus is inside a composite widget AND target is not editable. Updated risk assessment to High/High.

### RESOLVED: StrictMode idempotency
**Concern**: React 18 StrictMode mounts/unmounts effects twice. `registerRegion()` must be idempotent.

**Resolution**: Added idempotency requirement to FocusManager lifecycle notes in Phase 1.4.

### RESOLVED: Focus return semantics
**Concern**: "Exit trap" needs to specify exactly where focus goes to prevent "focus lost" moments.

**Resolution**: Added explicit "Focus return contract" at start of Phase 5 specifying focus returns to tile container with tabIndex={0} and announcement.

### RESOLVED: Tab key handling risk
**Concern**: Routing Tab through HotKeys broadly is fragile.

**Resolution**: Removed Tab from HotKeys key map. Tab only handled in explicit trap contexts (Phase 5).

### RESOLVED: Editable detection incomplete
**Concern**: Must include contenteditable, CodeMirror/Monaco, and iframes.

**Resolution**: Added comprehensive `isEditableElement()` function in Phase 1.5 covering all cases.

### RESOLVED: Announcements need i18n pathway
**Concern**: Labels are centralized but announcements ("Editing tile", "Exited tile") were not.

**Resolution**: Added `announce` object to `useAriaLabels()` hook with all announcement strings for consistent i18n.

### RESOLVED: Missing assistive tech checklist
**Concern**: Switch control, Voice Control, sticky keys behave differently from screen readers.

**Resolution**: Added Phase 8.6 Assistive Tech Sanity Checklist.

### RESOLVED: Risk levels underestimated
**Concern**: FloatingPortal, react-tabs, global CSS changes, Safari/VoiceOver had higher risk than documented.

**Resolution**: Updated Risk Assessment table with revised likelihood/impact levels and additional risks.

### NOTE: Product/Design perspective
**Status**: UX writing for microcopy (trapped-state styling, announcement wording) should be validated with design during implementation. Not blocking for plan approval.

---

## External Review (Copilot Round 2)

### RESOLVED: Tab interception at region level is high-risk
**Concern**: Phase 3 was overriding Tab key with `preventDefault()` to manually move focus between regions. This fights browser native behavior, complicates accessibility, and can interfere with SR behaviors.

**Resolution**: Completely rewrote Phase 3 to rely on proper DOM order + roving tabindex instead of Tab interception. Tab now flows naturally via browser behavior. This is a significant simplification that reduces risk.

### RESOLVED: ARIA grid semantics must match behavior
**Concern**: If tiles use `role="gridcell"`, there must be a parent `role="grid"` and proper `role="row"` structure, otherwise screen readers may interpret it inconsistently.

**Resolution**: Added Phase 4.2 ARIA Grid Structure with explicit structure requirements and code example. Also noted alternative patterns (listbox/option, or plain divs) if full grid is too complex.

### RESOLVED: unregisterRegion() must be idempotent
**Concern**: StrictMode dev patterns may call unregister twice; must not throw.

**Resolution**: Added explicit note to FocusManager lifecycle requirements in Phase 1.4.

### RESOLVED: Clear focusMemory on unregister
**Concern**: Storing raw `HTMLElement` in maps can create stale element issues; memory should be cleared on unregister.

**Resolution**: Added memory cleanup requirement to FocusManager lifecycle notes in Phase 1.4.

### RESOLVED: Announcer timing pattern is fragile
**Concern**: The 1s timeout clearing can fail with rapid/repeated announcements; same message announced twice won't be detected.

**Resolution**: Rewrote announcer in Phase 7.2 to use clear-then-set-on-next-tick pattern with `requestAnimationFrame` and longer 3s timeout.

### RESOLVED: Focus landing on trap entry needs explicit priority
**Concern**: "First focusable element" might be surprising; should land on most likely edit target.

**Resolution**: Added "Focus entry contract" to Phase 5 with explicit priority: title → first toolbar button → first focusable content → container fallback.

### RESOLVED: Missing delete-focused-tile regression test
**Concern**: Need to test focus recovery when the focused tile is deleted.

**Resolution**: Added specific test case to Phase 8.1 unit tests.

### RESOLVED: Editable element detection will drift
**Concern**: CSS selector list for editors will grow as new tile types are added.

**Resolution**: Added future extensibility note to Phase 1.5 suggesting tile plugins could declare `handlesOwnArrowKeys` or additional selectors.

### RESOLVED: All accessibility strings must flow through hook
**Concern**: Risk of half-localized UI if some strings are hardcoded.

**Resolution**: Added verification note to Phase 1.3 requiring audit of all aria-labels and announcement strings during implementation.

### NOTE: Arrow navigation expectations for QA
**Status**: Documented that arrow navigation is only guaranteed when user has moved focus into the widget (forms/focus mode). This guides QA testing expectations but doesn't change implementation.

### NOTE: Cypress portal focus assertions
**Status**: Portal DOM isn't "within" tile container, so `be.within('.tile-component')` won't work for toolbar buttons. Tests need to use `.tile-toolbar` selector directly. Existing test in Phase 8.3 already does this correctly.

---

## References

- [WAI-ARIA Authoring Practices - Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WAI-ARIA Authoring Practices - Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [WCAG 2.2 Focus Appearance (2.4.11)](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [react-tabs Documentation](https://github.com/reactjs/react-tabs)
- [@floating-ui/react Documentation](https://floating-ui.com/docs/react)
