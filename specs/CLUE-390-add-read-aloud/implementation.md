# Implementation Plan: TTS (Read Aloud) for CLUE

**Spec**: [requirements.md](requirements.md)
**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-390

## Architecture Overview

The Read Aloud feature introduces a **global singleton service** that manages Web Speech API state and coordinates with the existing toolbar and UI store systems. The core design centers on:

1. **ReadAloudService** — A standalone class (not MST) that owns the `speechSynthesis` interaction, tracks reading state, and exposes observable properties via MobX
2. **Toolbar integration** — A new `"readAloud"` button added to both the document toolbar config and the myResources toolbar config, handled via the existing `handleClickTool` switch in `ToolbarComponent`
3. **Global keyboard listeners** — Document-level `keydown` handlers for Spacebar (pause/resume) and Escape (cancel), suppressed in editable contexts
4. **MobX reactions** — To detect tile selection changes, pane switches, and tab changes that should stop or redirect Read Aloud

## New Files

| File | Purpose |
|------|---------|
| `src/models/services/read-aloud-service.ts` | Core Read Aloud singleton — state machine, speech synthesis, tile traversal |
| `src/models/services/read-aloud-service.test.ts` | Unit tests for the service |
| `src/components/toolbar/read-aloud-button.tsx` | Custom toolbar button component (like `DeleteButton`) with toggle state |
| `src/components/toolbar/read-aloud-button.test.tsx` | Unit tests for the button component |

## Modified Files

| File | Change |
|------|--------|
| `src/clue/app-icons.tsx` | Register `ReadAloudToolIcon` import |
| `src/clue/app-config.json` | Add `readAloud` button to both `toolbar` and `myResourcesToolbar` arrays |
| `src/components/toolbar.tsx` | Add `"readAloud"` case to `handleClickTool`, render `ReadAloudButton` instead of default `ToolbarButtonComponent`, wire `isButtonActive` for readAloud |
| `src/lib/logger-types.ts` | Add `TOOLBAR_READ_ALOUD_START`, `TOOLBAR_READ_ALOUD_STOP`, `TOOLBAR_READ_ALOUD_TILE_TRANSITION` to `LogEventName` |

## Implementation Steps

### Step 1: Register the Icon

**File: `src/clue/app-icons.tsx`**

Add the SVG import and register it:

```typescript
import ReadAloudToolIcon from "./assets/icons/read-aloud-tool.svg";

// In the appIcons object:
"icon-read-aloud-tool": ReadAloudToolIcon,
```

### Step 2: Add Button to Toolbar Configs

**File: `src/clue/app-config.json`**

Add to the `toolbar` array (right pane / document toolbar), after the existing action buttons but before any `isBottom` items:

```json
{
  "id": "readAloud",
  "title": "Read Aloud",
  "iconId": "icon-read-aloud-tool",
  "isTileTool": false
}
```

Add the same entry to the `myResourcesToolbar` array (left pane / curriculum toolbar), before the `togglePlayback` entry.

### Step 3: Add Log Event Names

**File: `src/lib/logger-types.ts`**

Add to the `LogEventName` enum in the toolbar section:

```typescript
TOOLBAR_READ_ALOUD_START,
TOOLBAR_READ_ALOUD_STOP,
TOOLBAR_READ_ALOUD_TILE_TRANSITION,
```

### Step 4: Create ReadAloudService

**File: `src/models/services/read-aloud-service.ts`**

This is the core implementation. It's a plain class (not MST) with MobX `makeObservable` for reactive state.

#### State Machine

```
Idle ──(start)──→ Reading ──(pause)──→ Paused
 ↑                   │                    │
 │                   │                    │
 └───(stop/end)──────┘                    │
 └───(stop/click)─────────────────────────┘
 └───(resume)─────────────────────────────┘ → Reading
```

#### Key Properties

```typescript
class ReadAloudService {
  // @observable — UI reacts to these via observer() components
  @observable state: "idle" | "reading" | "paused" = "idle";
  @observable activePane: "left" | "right" | null = null;
  @observable currentTileId: string | null = null;

  // Read-only (set in constructor)
  readonly isSupported: boolean;

  // Private (not observable — internal state only)
  private document: DocumentContentModel | null = null;  // Set in start(), cleared in stop()
  private toolbarProps: IToolbarEventProps | null = null;  // For logging; set in start(), cleared in stop()
  private tileQueue: string[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentChunks: string[] = [];
  private currentChunkIndex = 0;  // Tracks which chunk is currently being spoken
  private readGeneration = 0;  // Guards against stale utterance callbacks
  private isSelectingProgrammatically = false;  // Guards against selection reaction loop
  private disposers: (() => void)[] = [];
}
```

#### Constructor

- Check `'speechSynthesis' in window` — store as `isSupported` property
- Set up global keyboard listeners (Spacebar, Escape) with editable element / dialog suppression
- Do NOT start any MobX reactions yet (those are set up on `start()`)

#### `dispose()`

Removes the global `keydown` listener registered in the constructor. Called by `resetReadAloudService()` for test cleanup:

```typescript
dispose() {
  document.removeEventListener("keydown", this.handleKeyDown);
}
```

#### `start(pane: "left" | "right", content: DocumentContentModel, selectedTileIds: string[], toolbarProps: IToolbarEventProps)`

1. If already reading on the **same** pane, call `stop("user")` and **return** (toggle off)
2. If already reading on the **other** pane, call `stop("pane-switch")` first (global singleton), then continue
3. Set `this.document = content`, `this.toolbarProps = toolbarProps`, `activePane = pane`, `state = "reading"`
4. Determine tile queue:
   - If `selectedTileIds.length > 0`: build from document order and filter to selection — `const selectedSet = new Set(selectedTileIds); this.document.getAllTileIds(false).filter(id => selectedSet.has(id))`
   - Else: use `this.document.getAllTileIds(false)` (all non-teacher tiles in document order)
5. If queue is empty, immediately `stop("complete")` and return
6. Set up MobX reactions for:
   - `ui.selectedTileIds` changes (handle same-pane vs cross-pane selection)
   - `persistentUI.tabs.get(tabId).currentDocumentGroupId` changes (tab switch → stop)
7. Begin reading the first tile via `readTile(tileQueue[0])`

#### `prepareTile(tileId: string): boolean`

Extracts text and prepares chunks for a tile without speaking. Used by both `readTile()` and the paused selection handler. Returns `true` if the tile was found and prepared, `false` if skipped (e.g., deleted).

1. Set `currentTileId = tileId`
2. Extract text:
   - Get `tile = this.document.getTile(tileId)` — if `undefined` (tile deleted mid-read), call `advanceToNextTile()` and return `false`
   - Get `title = tile.computedTitle`
   - If tile is a Text tile: get `content = (tile.content as TextContentModel).asPlainText()`
   - Compose speech text:
     - If title and content: `"${title}. ${content}"`
     - If title only (non-text tile): `"${tileTypeName} tile: ${title}"` (e.g., "Graph tile: Population Growth")
     - If content only (no title): `"${content}"`
     - If neither: `"${tileTypeName} tile"`
3. Chunk the speech text to avoid Chrome's ~15-second utterance cutoff (see **Text Chunking** below)
4. Set `currentChunks = chunks`, `currentChunkIndex = 0`
5. Return `true`

#### `readTile(tileId: string)`

1. Call `prepareTile(tileId)` — if it returns `false` (tile missing), return early (`advanceToNextTile` was already called)
2. Select the tile in UI: set `isSelectingProgrammatically = true`, call `ui.setSelectedTileId(tileId)`, then reset `isSelectingProgrammatically = false`
3. Call `speakCurrentChunk()` to begin speaking
4. Log `TOOLBAR_READ_ALOUD_TILE_TRANSITION` with `{ pane, documentId, tileId }`

#### `speakCurrentChunk()`

Speaks the current chunk and chains to the next one via `onend`. All speech goes through this method.

```typescript
private speakCurrentChunk() {
  const gen = ++this.readGeneration;
  const chunk = this.currentChunks[this.currentChunkIndex];
  const utterance = new SpeechSynthesisUtterance(chunk);
  this.currentUtterance = utterance;

  utterance.onend = () => {
    if (gen !== this.readGeneration) return; // stale callback
    this.currentChunkIndex++;
    if (this.state === "paused") return; // let resume() handle it
    if (this.currentChunkIndex < this.currentChunks.length) {
      this.speakCurrentChunk();
    } else {
      this.advanceToNextTile();
    }
  };
  utterance.onerror = () => { this.stop("error"); };

  speechSynthesis.speak(utterance);
}
```

#### `pause()` / `resume()`

```typescript
pause() {
  if (this.state === "reading") {
    speechSynthesis.pause();
    this.state = "paused";
  }
}

resume() {
  if (this.state === "paused") {
    this.state = "reading";
    if (!speechSynthesis.speaking) {
      // Paused between chunks — speak the next one
      this.speakCurrentChunk();
    } else {
      speechSynthesis.resume();
    }
  }
}
```

#### `stop(reason: "user" | "complete" | "error" | "pane-switch" | "tab-switch" = "user")`

1. If `state === "idle"`, return early (no-op)
2. Increment `this.readGeneration` to invalidate any pending `onend` callbacks
3. Call `speechSynthesis.cancel()`
4. Dispose MobX reactions
5. Log `TOOLBAR_READ_ALOUD_STOP` with `{ pane, documentId, tileId, reason }` (before clearing state)
6. Set `state = "idle"`, `activePane = null`, `this.document = null`, `this.toolbarProps = null`, `currentTileId = null`
7. Do NOT clear `selectedTileIds` — the last tile remains selected per requirements

#### `advanceToNextTile()`

1. Find current index in `tileQueue` via `indexOf(this.currentTileId)`
2. If index is `-1` (tile no longer in queue, e.g., deleted), call `stop("complete")` and return
3. If there's a next tile (`index + 1 < tileQueue.length`), call `readTile(tileQueue[index + 1])`
4. Otherwise, call `stop("complete")` (natural completion)

#### Text Chunking

Chrome's `speechSynthesis` silently stops speaking utterances longer than ~15 seconds. Since CLUE text tiles can contain substantial content, all speech text must be split into chunks before speaking.

**Strategy**: Split on sentence boundaries, with a max chunk size of ~200 characters (well under the 15-second limit at normal speech rate):

```typescript
private chunkText(text: string): string[] {
  const sentencePattern = /[^.!?]+[.!?]+[\s]*/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sentencePattern.exec(text)) !== null) {
    sentences.push(match[0]);
    lastIndex = sentencePattern.lastIndex;
  }

  // Capture any trailing text without sentence-ending punctuation
  if (lastIndex < text.length) {
    const trailing = text.slice(lastIndex).trim();
    if (trailing) sentences.push(trailing);
  }

  // If no sentences found at all, treat the whole text as one chunk
  if (sentences.length === 0) sentences.push(text);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > 200 && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
```

**Speaking chunks sequentially**: Store the chunk array and current index in instance properties (`this.currentChunks`, `this.currentChunkIndex`). Extract chunk speaking into a `speakCurrentChunk()` method. After each chunk's `onend`, increment `currentChunkIndex` and check: if `this.state === "paused"`, do nothing (let `resume()` call `speakCurrentChunk()` later); if more chunks remain, call `speakCurrentChunk()`; if no more chunks, call `advanceToNextTile()`. On `stop()`, `speechSynthesis.cancel()` clears all pending speech, so no additional cleanup is needed.

**Guard against stale callbacks**: Each call to `speakCurrentChunk()` increments a generation counter (`this.readGeneration++`). Chunk `onend` callbacks capture the generation at creation time and bail out if it no longer matches, preventing stale callbacks from a cancelled tile from interfering with a new one. **Invariant**: any time `speechSynthesis.cancel()` is called *without* immediately following it with `speakCurrentChunk()` (which bumps generation itself), `readGeneration` must be incremented first. This applies in `stop()` and in the paused-selection path of the tile selection reaction.

#### Tile Selection Reaction

When `ui.selectedTileIds` changes while reading:

```typescript
reaction(
  () => [...ui.selectedTileIds],
  (newSelectedIds) => {
    if (this.state === "idle") return;
    if (this.isSelectingProgrammatically) return;  // Ignore our own selection changes

    // Determine if selection is in same pane or different pane
    const selectedInThisPane = newSelectedIds.filter(id => this.document?.getTile(id));
    const selectedInOtherPane = newSelectedIds.length > 0 && selectedInThisPane.length === 0;

    if (selectedInOtherPane) {
      this.stop("pane-switch");
      return;
    }

    // Only react to single-tile selection changes — multi-selection while reading is
    // intentionally ignored (reading continues on the current tile). Per requirements,
    // "when the user selects another tile" refers to single-tile selection.
    if (selectedInThisPane.length === 1 && selectedInThisPane[0] !== this.currentTileId) {
      // User selected a different tile in same pane — invalidate stale callbacks before cancelling
      ++this.readGeneration;
      speechSynthesis.cancel();
      if (this.state === "paused") {
        // Stay paused but prepare the new tile's text
        this.prepareTile(selectedInThisPane[0]);
      } else {
        this.readTile(selectedInThisPane[0]);
      }
    }
  }
)
```

#### Global Keyboard Listeners

Set up in constructor, active only when `state !== "idle"`:

```typescript
private handleKeyDown = (e: KeyboardEvent) => {
  if (this.state === "idle") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;  // Don't intercept modified shortcuts
  if (this.isEditableTarget(e.target)) return;

  if (e.key === " ") {  // Spacebar
    e.preventDefault();
    if (this.state === "reading") this.pause();
    else if (this.state === "paused") this.resume();
  }

  if (e.key === "Escape") {
    e.preventDefault();
    this.stop();
  }
};

private isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") return true;
  if (target.isContentEditable) return true;
  // Check for modal/menu/dropdown
  if (target.closest("[role='dialog']") || target.closest("[role='menu']") || target.closest("[role='listbox']")) return true;
  return false;
}
```

#### Singleton Pattern

Use a factory function since the service needs access to `ui` and `persistentUI` stores for reactions:

```typescript
let instance: ReadAloudService | null = null;

export function getReadAloudService(stores: IStores): ReadAloudService {
  if (!instance) {
    instance = new ReadAloudService(stores);
  }
  return instance;
}

// For test cleanup — stops reading, removes keyboard listener, and resets the cached singleton
export function resetReadAloudService() {
  if (instance) {
    instance.stop("user");
    instance.dispose();
  }
  instance = null;
}
```

### Step 5: Create ReadAloudButton Component

**File: `src/components/toolbar/read-aloud-button.tsx`**

A custom button component similar to `DeleteButton` in pattern, using a `<div>` element consistent with existing toolbar buttons:

```tsx
interface IReadAloudButtonProps {
  toolButton: IToolbarButtonModel;
  pane: "left" | "right";
  document?: DocumentModelType;
  section?: SectionModelType;
}

export const ReadAloudButton: React.FC<IReadAloudButtonProps> = observer(
  ({ toolButton, pane, document, section }) => {
    const stores = useStores();
    const service = getReadAloudService(stores);

    // Hide entirely if speech synthesis not supported
    if (!service.isSupported) return null;

    const content = document?.content ?? section?.content;
    const hasTiles = (content?.getAllTileIds(false).length ?? 0) > 0;
    const isActive = service.state !== "idle" && service.activePane === pane;
    const isDisabled = !isActive && !hasTiles;
    const tileEltClass = toolButton.id.toLowerCase();
    const className = classNames("tool", tileEltClass,
      { active: isActive }, isDisabled ? "disabled" : "enabled");

    const handleClick = () => {
      if (isDisabled) return;
      if (isActive) {
        service.stop("user");
      } else if (content) {
        const selectedIds = Array.from(stores.ui.selectedTileIds);
        service.start(pane, content, selectedIds, { document, section });
      }
    };

    return (
      <div
        className={className}
        data-testid={`tool-${tileEltClass}`}
        title={toolButton.title}
        onClick={handleClick}
      >
        {toolButton.Icon && <toolButton.Icon />}
      </div>
    );
  }
);
```

### Step 6: Integrate into ToolbarComponent

**File: `src/components/toolbar.tsx`**

Three changes:

#### 6a. Determine pane identity

The toolbar already receives either `document` or `section` as props. Use this to derive the pane:

```typescript
private get pane(): "left" | "right" {
  return this.props.section ? "left" : "right";
}
```

#### 6b. Render ReadAloudButton for the readAloud tool

In `renderToolButtons`, add a special case alongside the existing `delete` special case:

```typescript
if (toolButton.id === "readAloud") {
  return (
    <ReadAloudButton
      key={toolButton.id}
      toolButton={toolButton}
      pane={this.pane}
      document={this.props.document}
      section={this.props.section}
    />
  );
}
```

#### 6c. Add case to handleClickTool (optional fallback)

If not using a custom component, add to the switch:

```typescript
case "readAloud":
  // Handled by ReadAloudButton component directly
  break;
```

### Step 7: Tile Type Display Name Mapping

In `ReadAloudService`, a simple mapping for announcing non-text tile types:

```typescript
private getTileTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    "Text": "Text",
    "Table": "Table",
    "Geometry": "Geometry",
    "Graph": "Graph",
    "Image": "Image",
    "Drawing": "Drawing",
    "DataCard": "Data Card",
    "Expression": "Expression",
    "Diagram": "Diagram",
    "Numberline": "Number Line",
    "BarGraph": "Bar Graph",
    "Simulator": "Simulator",
    "Dataflow": "Dataflow",
  };
  return typeNames[type] || type;
}
```

### Step 8: Logging Integration

Use the existing `logToolbarEvent` helper:

```typescript
import { logToolbarEvent, IToolbarEventProps } from "../models/tiles/log/log-toolbar-event";

// documentId comes from toolbarProps (the DocumentModelType passed from the button component).
// For left-pane reads (section), document is undefined so documentId will be undefined —
// this is fine because logToolbarEvent routes through logSectionEvent when section is provided.
const documentId = this.toolbarProps?.document?.key;

// On start (this.toolbarProps is set from the button component):
logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_START,
  this.toolbarProps!,
  { pane: this.activePane, documentId, tileId: firstTileId, trigger: "user" }
);

// On tile transition:
logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_TILE_TRANSITION,
  this.toolbarProps!,
  { pane: this.activePane, documentId, tileId }
);

// On stop (called before clearing state):
logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_STOP,
  this.toolbarProps!,
  { pane: this.activePane, documentId, tileId: this.currentTileId, reason }
);
```

### Step 9: Tab/Section Switch Detection

Set up a reaction in the service when reading from the left pane:

```typescript
if (pane === "left") {
  const tabId = ENavTab.kProblems;
  this.disposers.push(
    reaction(
      () => stores.persistentUI.tabs.get(tabId)?.currentDocumentGroupId,
      () => {
        // Section changed while reading — stop
        this.stop("tab-switch");
      }
    )
  );
}
```

For the right pane, monitor the primary document key:

```typescript
if (pane === "right") {
  this.disposers.push(
    reaction(
      () => stores.persistentUI.problemWorkspace.primaryDocumentKey,
      () => {
        this.stop("tab-switch");
      }
    )
  );
}
```

## Testing Strategy

### Unit Tests for ReadAloudService

Mock `window.speechSynthesis` with a fake implementation:

```typescript
const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  speaking: false,
  paused: false,
  pending: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getVoices: jest.fn(() => []),
  onvoiceschanged: null,
};

Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
  writable: true,
});

// Mock SpeechSynthesisUtterance so tests can capture onend/onerror callbacks
class MockUtterance {
  text: string;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}
(global as any).SpeechSynthesisUtterance = MockUtterance;
```

**Test cleanup**: Call `resetReadAloudService()` in `afterEach` to stop reading, remove keyboard listeners, and clear the singleton. Reset `mockSpeechSynthesis` mock call counts between tests. The speech API mocks themselves (set up in `beforeAll`) persist for the suite. Note: `resetReadAloudService()` calls `stop("user")` which emits a STOP log event — tests that assert on log event counts should account for cleanup-emitted events or mock the logger.

**Test cases:**
- Start reading with no selected tiles → reads all tiles in order
- Start reading with one selected tile → reads only that tile
- Start reading with multiple selected tiles → reads in document order
- Selected tile IDs include IDs not in current document → filtered out, reads only matching tiles
- Toggle off while reading → stops and resets
- Toggle off while paused → stops and resets
- Spacebar while reading → pauses
- Spacebar while paused → resumes
- Escape while reading → stops
- Start on right pane while left pane is reading → stops left, starts right
- Select tile in other pane → stops
- Tab switch → stops
- No tiles in document → immediately stops
- Browser doesn't support speechSynthesis → `isSupported` is false
- `onerror` on utterance → stops silently
- Keyboard listeners suppressed in editable elements
- `chunkText`: text under 200 chars → single chunk
- `chunkText`: long text with sentence boundaries → splits at sentence boundaries
- `chunkText`: single sentence over 200 chars → still produces a chunk (no infinite loop)
- `chunkText`: text with no sentence-ending punctuation → treated as one chunk
- `chunkText`: sentences followed by trailing fragment without punctuation → fragment is included
- Pause between chunks → `resume()` speaks next chunk via `speakCurrentChunk()`
- Stale `readGeneration` callback ignored after tile switch
- Select different tile while paused → `prepareTile()` updates chunks, `resume()` reads new tile
- `stop()` invalidates pending `onend` callbacks via `readGeneration` increment

### Unit Tests for ReadAloudButton

- Renders nothing when `isSupported` is false
- Has correct CSS classes for active/inactive/disabled states
- Click toggles service start/stop
- Disabled when pane has no tiles (not active)
- Not disabled when active (even if tiles were removed mid-read)

### Cypress E2E Tests (optional, future)

- Full flow: click Read Aloud → verify `speechSynthesis.speak()` called → verify tile selection changes → verify button toggles

## Implementation Order

Recommended order for incremental development and testing:

1. **Step 1-3**: Icon, config, log events — minimal, no-risk changes
2. **Step 4**: ReadAloudService — the core logic, testable in isolation
3. **Step 5**: ReadAloudButton component
4. **Step 6**: Toolbar integration — connects everything
5. **Step 7**: Tile type names — small enhancement
6. **Step 8**: Logging — add once the flow works
7. **Step 9**: Tab/section detection reactions

## Edge Cases and Notes

- **Chrome speechSynthesis 15-second bug**: Chrome silently stops utterances after ~15 seconds. Addressed by the text chunking strategy in `readTile()` — all speech is split into ~200-character sentence-boundary chunks before speaking.
- **`speechSynthesis.cancel()` reliability**: Some browsers fire `onend` after `cancel()`, some don't. The service should handle both cases gracefully by checking `state` before acting on callbacks.
- **Stale callbacks**: After calling `cancel()`, previous utterance callbacks may still fire. Guard all callbacks with a `readGeneration` counter — each `speakCurrentChunk()` call increments the generation, and callbacks bail out if the generation no longer matches.
- **Empty voices list**: Some browsers/environments may have `speechSynthesis` available but `getVoices()` returns empty. The browser will use a default voice; this is acceptable.
- **MobX reaction disposal**: All reactions created during `start()` must be disposed in `stop()` to prevent memory leaks.
- **Toolbar button element**: The ReadAloudButton uses a `<div>` element, consistent with the existing `ToolbarButtonComponent`. ARIA attributes (`aria-pressed`, `role="button"`) will be added in a future global accessibility pass across all toolbar buttons.
- **Deleted tiles mid-read**: If a tile in the queue is deleted while reading, `prepareTile` detects the missing tile via `getTile()` returning `undefined` and skips to the next tile in the queue.
- **`getTile()` safety**: `DocumentContentModel.getTile()` is an MST map lookup (`map.get()`) which returns `undefined` for missing keys — it does not throw. This makes it safe to use as an existence check in the tile selection reaction filter and in `prepareTile()` without try/catch.
