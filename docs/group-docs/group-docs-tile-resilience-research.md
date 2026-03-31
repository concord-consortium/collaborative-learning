# Tile Resilience to Remote Updates — Research

This document analyzes each CLUE tile for how well it would handle remote model changes (from another user editing the same group document) while a user is actively interacting with the tile. This covers changes to both the tile's own content model and any shared models it uses.

The goal is to identify which tiles are most at risk and help prioritize work on tile locking, shared model conflict resolution, and per-tile resilience hardening.

## Read-only vs edit mode: not a factor for rendering

All CLUE tiles render model changes regardless of whether they are in read-only or edit mode. Every tile uses MobX `observer()` and reacts to MST model changes in both modes. The `readOnly` prop only controls whether interactive controls (buttons, inputs, drag handles) are enabled — it does not stop the tile from rendering updates.

This is mostly good news for group documents: remote changes from other users **will generally be rendered** in edit mode. Tiles have already been tested extensively as real-time "views" in read-only documents (used by teachers and researchers), and the history replay scrubber also applies and reverses changes to read-only documents. So tiles already handle their model changing "under them" — the new challenge is that this now happens while the user is also interacting.

**Caveat**: Some tiles have bugs where certain model changes don't trigger UI updates regardless of mode. For example, the table's column definitions are built in a `useMemo` whose dependencies don't include attribute names — so renaming an attribute doesn't update the column header in any view (edit or read-only) until something else happens to invalidate the memo (see `group-docs-current-state.md` for the full root cause). These bugs affect both group documents and single-user undo equally, since both apply changes via patches. No cases of special read-only-only handling have been found.

The Text tile is a notable example: its Slate editor syncs from the model using a `reaction()` that fires whenever the model text changes, guarded by an `isHandlingUserChange` flag to avoid feedback loops. This sync happens in both read-only and edit mode.

## Undo as a proxy for remote updates

Single-user undo is the closest existing analog to what happens when an edit-mode tile receives a remote update in a group document. Both undo and group document sync work by applying patches to the MST tree (not by re-running the original action). This means:

- When undo works correctly for a tile, that tile is likely to handle remote updates correctly too — the model changes, and the tile re-renders the new state.
- When undo fails for a tile (like the table attribute rename case), that same failure will occur with remote updates.

The main difference is that when a user clicks undo, they typically click away from whatever they were editing first (to reach the undo button or use a keyboard shortcut). This means focus and editing state are already lost before the undo happens, which masks some of the transient state issues listed below. With remote updates, the user is still actively interacting with the tile when the model changes — focus, cursor, selection, and mid-drag state are all live and can be disrupted.

So undo is a useful but incomplete testing proxy: if undo breaks a tile's rendering, remote updates will too. But if undo works, remote updates may still cause problems due to transient UI state that undo doesn't exercise (because the user has already disengaged from the tile).

## What makes a tile vulnerable

Given that all tiles already render remote changes, the vulnerabilities are specifically about **transient component state** being disrupted:

- **Draft / uncommitted input**: Text the user has typed but hasn't been committed to the model yet (debounced saves, rich text editors with their own DOM state). A model update can overwrite this uncommitted input.
- **Focus / selection / cursor**: UI state that tracks what the user is interacting with. Re-renders from model changes can reset these.
- **Drag operations**: Mid-drag state that references model objects. If those objects are deleted or reindexed, the drag breaks.
- **Object references**: Local state that stores IDs or references to model objects (selected point, editing attribute). If those objects are deleted remotely, the references become stale.
- **Independent editing surfaces**: Libraries like Slate, MathLive, JSXGraph, and Rete maintain their own internal state. Syncing between MST and these editors requires careful coordination to avoid overwriting user input.

See `group-docs-potential-ui-issues.md` for concrete examples with reproduction steps.

## Risk summary

| Tile | Risk | Internal State | Draft/Input | Focus/Selection | Drag | Key Concern |
|---|---|---|---|---|---|---|
| Drawing | High | voice typing, title editing | interim text held locally | object selection | extensive object manipulation | Many forms of uncommitted state; array-indexed objects |
| Table | High | selected cell, row add state | cell editing (rdg grid) | cell focus, column resize | row drag | Cell editing + focus loss on update; array-indexed attributes; confirmed useMemo caching bug for attribute names |
| Geometry | High | board state, dialog state, redo stack | dialog text fields | selected objects (comment, line) | point dragging, board interaction | Extensive JSXGraph state |
| Expression | Moderate-High | MathLive editor instance | LaTeX in editor | cursor position tracked | none | Independent editor state |
| Text | Moderate-High | Slate editor instance | Slate DOM state | cursor, selection | Slate internal | Slate is a separate editing surface |
| Dataflow | Moderate-High | Rete manager, playback state | none | playback index | node editor interaction | Rete node editor is opaque |
| Data Card | Moderate | editing attr ID, edit facet | attribute/cell editing | current edit context | none | Edit context refs can become stale |
| Numberline | Moderate | hover/selected point IDs | none | selected point | d3 point dragging | Point refs invalidated by deletion |
| iframe Interactive | Moderate | cached interactive state | debounced state (500ms) | none (opaque) | none (opaque) | Debounced state + iframe isolation |
| AI | Moderate | update request state | textarea (immediate commit) | none | none | Textarea input during remote change |
| Simulator | Moderate | simulation interval state | none | none | none | Simulation runs independently of model |
| Starter | Moderate | none | textarea (immediate commit) | none | none | Textarea overwritten by remote change |
| Diagram Viewer | Low | interaction locked flag | none | none | dnd-kit variable placement | Drag is structured |
| Bar Graph | Low | none | none | none | none | Model-driven |
| Graph | Low | none | none | none | attribute dnd | Model-driven with good sync |
| Wave Runner | Low | resize state only | depends on children | depends on children | none | Wrapper tile |
| Timeline | Low | none | none | none | none | Simple rendering |
| Image | Minimal | none | none | none | none | Static content |
| Question | Minimal | none | none | none | none | Container for other tiles |

## Detailed analysis by tile

### High Risk

#### Drawing

- **Internal state**: `voiceTypingActive`, `interimText` (interim voice transcription held locally), `titleEditing`, `titleTextInserter`, `objectListHoveredObject`, `tileVisibleBoundingBox`
- **Draft input**: Voice typing interim text is held in React state before being committed. Title edits similarly held locally.
- **Selection**: Drawing maintains selected objects via `contentRef.current.selectedObjects`. Remote deletion of selected objects would leave stale references.
- **Drag**: Extensive — moving, resizing, rotating drawing objects. Drag state references object indices in an array. As noted in `group-docs-current-state.md`, objects are stored in an array so index-based patches break when objects are deleted by another user.
- **Shared model sync**: `updateAfterSharedModelChanges` is a stub, but the content model doesn't store references to SharedVariables objects, so this may not need implementation. The concern is the component/UI level, not the content model.
- **Read-only handling**: Has extensive read-only checks, different rendering for read-only (fit-to-view).

#### Table

- **Internal state**: `selectedCell` ref, `addingNewRow` ref, `resizeColumn`/`resizeColumnWidth` refs, `gridRef`, `inputRowId`, column sort direction state.
- **Draft input**: Cell editing happens through the rdg (React Data Grid) component which manages its own input state. User edits to a cell are not immediately committed to the model.
- **Selection**: Cell selection and focus are managed by the grid. There is commented-out code (`savedFocusedCell`, `getFocusedCell`) suggesting previous attempts to save/restore focus — indicating this is a known problem.
- **Drag**: Row drag with overlay rendering. Column resize tracked in refs.
- **Shared model sync**: `updateAfterSharedModelChanges` is a stub. The content model's `columnWidths` map is keyed by attribute IDs from SharedDataSet — deleted attributes leave orphaned entries, but this is minor. The main concern is the component/UI level (cell editing, focus), not content model consistency.
- **Known issue**: `group-docs-current-state.md` documents that cell editing focus is lost when remote updates arrive, even in different cells. Also documents that attribute name changes don't propagate.
- **Additional risk**: Attributes stored in arrays — same index-shifting problem as Drawing objects (documented in current-state).

#### Geometry

- **Internal state**: Class component with extensive state: `board` (JSXGraph instance), `selectedComment`, `selectedLine`, `redoStack`, dialog open states (`showPointLabelDialog`, `showSegmentLabelDialog`, etc.), `isEditingTitle`, `disableRotate`.
- **Draft input**: Dialogs for labeling points/segments/polygons hold uncommitted text.
- **Selection**: `selectedComment` and `selectedLine` are references to JSXGraph board objects. Remote deletion or modification would leave stale references.
- **Drag**: Extensive — `dragPts` map tracks drag state for multiple geometry points. `lastBoardDown`, `lastPointDown` track pointer events. JSXGraph interaction is deeply integrated.
- **Shared model sync**: `updateAfterSharedModelChanges` calls `forceSharedModelUpdate()` — a full reset approach. Effective but disruptive (would interrupt any in-progress interaction).
- **Complex init**: JSXGraph board creation is expensive. Full re-initialization on model change would be costly and visually jarring.

### Moderate-High Risk

#### Expression

- **Internal state**: MathLive editor instance (`mf` ref), `trackedCursorPos` ref.
- **Draft input**: MathLive maintains its own internal LaTeX editing state, separate from the MST model. User types in the math field; changes are committed via `content.setLatexStr()`.
- **Cursor**: Cursor position tracked in `trackedCursorPos.current`. There's an `onSnapshot` watcher that tries to restore cursor position when the model changes: `mf.current.position = trackedCursorPos.current - 1`. This would break if the LaTeX length changes from a remote update.
- **Shared model sync**: No explicit `updateAfterSharedModelChanges`. Has implicit sync via `onSnapshot` watcher on the content model.

#### Text

- **Internal state**: Uses Slate editor which maintains its own DOM state and editing model, separate from the MST content model.
- **Draft input**: Slate has its own representation of the document content. Changes may not be immediately synced to MST.
- **Cursor/selection**: Slate manages cursor position and text selection internally. Remote model changes would require the Slate editor to be updated, which could reset cursor and selection.
- **Shared model sync**: `updateAfterSharedModelChanges` delegates to text plugins — this is implemented and handles plugin-specific shared model changes (like variable chips).
- **Note**: Making Slate handle concurrent edits gracefully is a substantial challenge. Collaborative text editing is one of the hardest problems in this space.

#### Dataflow

- **Internal state**: Class component with `reteManager` (Rete node editor instance), `isRecording`, `isPlaying`, `playBackIndex`, `recordIndex`, `isEditingTitle`.
- **Draft input**: No direct text inputs, but the Rete node editor manages its own visual/interaction state.
- **Playback**: `playBackIndex` and `recordIndex` track position in recorded data. Remote changes to the program could make these indices invalid.
- **Drag**: Rete node editor supports dragging nodes and connections — this is opaque to CLUE's state management.
- **Shared model sync**: `updateAfterSharedModelChanges` is a stub. DataSet attributes are derived from program nodes at recording time (`prepareRecording()`), so if nodes change remotely the recorded attributes may drift. Uses 3 shared models (SharedDataSet, SharedVariables, SharedProgramData).

### Moderate Risk

#### Data Card

- **Internal state**: `currEditAttrId`, `currEditFacet`, `imageUrlToAdd` in React state.
- **Draft input**: Editing context tracked by attribute ID. If that attribute is deleted remotely, the editing context is invalid.
- **Shared model sync**: Good implementation — validates case index bounds and resets to selected case when data changes.

#### Numberline

- **Internal state**: `hoverPointId`, `_selectedPointId`, `toolbarOption`.
- **Drag**: d3 drag behavior on points. Drag in progress could reference a point deleted remotely.
- **Selection**: Selected/hovered point IDs become invalid if those points are deleted.

#### iframe Interactive

- **Internal state**: `currentInteractiveState` ref caches state for comparison.
- **Draft input**: State updates debounced at 500ms — recent changes may not be committed.
- **Note**: iframe content is opaque to CLUE. Remote changes to `interactiveState` are not automatically propagated into the iframe.

#### AI

- **Draft input**: Textarea with immediate model commit (`content.setPrompt(event.target.value)`). No buffering, but a remote model change during typing could reset the input.

#### Simulator

- **Internal state**: Simulation runs on an interval independently of the model.
- **Shared model sync**: `updateAfterSharedModelChanges` is a stub. Looks up variables by name in SharedVariables — if names change remotely, lookups fail silently. Uses SharedVariables and SharedProgramData.

#### Starter

- **Draft input**: Textarea with immediate commit. Does not check the `readOnly` prop — always editable.

### Low Risk

#### Diagram Viewer, Bar Graph, Graph

These tiles are primarily model-driven with minimal local state. Bar Graph and Graph both have good `updateAfterSharedModelChanges` implementations. Diagram Viewer uses dnd-kit for variable placement which is structured.

#### Wave Runner, Timeline, Image, Question

Minimal or no local state. Wave Runner is a wrapper whose resilience depends on its children. Timeline and Image are simple rendering tiles. Question is a container.

## `updateAfterSharedModelChanges` — what it means

This method is only needed when the tile's **content model** stores references or derived state that must stay in sync with a shared model. If the tile's components simply render data from the shared model, MobX reactivity handles updates automatically and this method doesn't need to do anything.

Four tiles have stubbed implementations. Here's whether they actually need it:

| Tile | Stub | Content Model References | Actual Risk |
|---|---|---|---|
| Drawing | `// TODO: need to implement yet` | No stored references to SharedVariables. Drawing objects don't store variable IDs. | Low — components likely observe SharedVariables directly via MobX. Stub may be fine. |
| Table | `// updateAfterSharedModelChanges hasn't been implemented...` | `columnWidths` map keyed by attribute IDs from SharedDataSet. | Low — orphaned width entries for deleted attributes won't crash, just leave stale data. |
| Dataflow | `//do nothing` | DataSet attributes derived from program nodes at recording time via `prepareRecording()`. | Moderate — if nodes change remotely, recorded attributes drift from current node set. This is a recording-time concern. |
| Simulator | `// nothing to do here` | Looks up variables by **name** in SharedVariables (`self.variables?.find(v => v.name === name)`). | Moderate — if variable names change in SharedVariables, lookups fail silently. |

## Testing approach: undo as a first pass

Single-user undo testing can efficiently validate whether tiles correctly re-render after patch application, without needing a multi-user setup. Any tile that doesn't correctly update its UI after undo will definitely fail with remote updates in a group document.

**What undo testing can expose:**
- Rendering/caching bugs where model changes aren't reflected in the UI (like the table attribute name issue)
- Array-index shifting problems (undo a deletion, check if subsequent data is in the right place)
- Stale object references after undo (e.g., redo stack pointing to invalid state)
- Shared model sync issues (undo a shared model change, check if dependent tiles update)

**What undo testing cannot expose:**
- Focus, cursor, or selection loss (the user has already clicked away to hit undo)
- Mid-drag interruptions (can't be dragging while clicking undo)
- Uncommitted input being overwritten (draft text is already committed or abandoned before undo)
- Multi-user specific issues (simulation state divergence, debounce race conditions)

See `group-docs-potential-ui-issues.md` for which specific issues can be tested via undo.

## Observations

1. **The hardest tiles are the ones with independent editing surfaces**: Drawing (SVG canvas), Geometry (JSXGraph), Expression (MathLive), Text (Slate), Dataflow (Rete). These all maintain their own state that's separate from MST and require careful synchronization. For these tiles, the core challenge isn't the content model staying in sync — it's the editing UI handling model changes while the user is interacting.

2. **Array-indexed state is a recurring problem**: Drawing objects and Table attributes are both stored in arrays. Index-based patches break when items are deleted by another user. This is documented in `group-docs-current-state.md` and affects any tile that stores ordered collections in arrays rather than maps.

3. **The Table is a high priority**: It's one of the most commonly used tiles, and the focus/cell-editing problems are already documented. The commented-out `savedFocusedCell` code suggests this has been attempted before.

4. **Tile locking would help most tiles but not all**: For tiles with independent editing surfaces (Slate, MathLive, JSXGraph, Rete), even locking the tile doesn't help if shared model changes arrive. The editing surface needs to handle the update regardless.

5. **Risk assessment is for code analysis only**: Actual testing with the pause/resume debug tools (GD-3) would likely reveal additional issues not visible from code inspection, particularly around rendering order, MobX reaction timing, and component lifecycle edge cases.
