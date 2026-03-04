# TTS (Read Aloud) for Sketch Comments and Table Values

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-417

**Status**: **Closed**

## Overview

This story extends CLUE's Read Aloud feature to read sketch tile text annotations and table tile data, building on the content-agnostic queue architecture from CLUE-418. For sketch tiles, text objects on the canvas are read in depth-first array structure order with period separators; for table tiles, column headers are announced first, then cell values are read row by row with "blank" for empty cells. The change is contained entirely within `buildTileSpeechText()` — no new queue item types or service modifications are needed.

## Requirements

### Sketch Tile Read Aloud

- When Read Aloud encounters a sketch tile, it reads any text objects (annotations/comments) on the canvas in addition to the tile title. The concatenated text objects form the "content" portion of the tile's speech, composed with the title using the existing `buildTileSpeechText()` pattern: `"{title}. {content}"` when both exist, `"{typeName} tile: {title}"` when only title, `"{content}"` when only text objects, `"{typeName} tile"` when neither
- Text objects are read in array structure order — the order they appear in the `objects` array of `DrawingContentModel`, traversed depth-first pre-order when groups are present (when a group is encountered, its children are traversed before continuing with the next sibling in the parent array)
- Each text object's `text` property is trimmed and read as plain text, with a period inserted between text objects to create a natural pause. If a text object already ends with sentence-ending punctuation (`.`, `!`, `?`, `…`, or `...`), no additional period is added to avoid double punctuation
- Empty or whitespace-only text objects are skipped silently
- Non-text drawing objects (lines, rectangles, ellipses, images, vectors, stamps) are skipped — only text objects contribute to speech. Groups are not spoken themselves but their children are traversed for text objects
- If a sketch tile has no text objects, or all text objects are empty/whitespace, Read Aloud announces the tile type and title as it does today (e.g., "Sketch tile: My Drawing")

### Table Tile Read Aloud

- When Read Aloud encounters a table tile, it reads the table's column headers followed by cell values row by row
- Column headers (attribute names) are always read first as a comma-separated list, using singular/plural grammar (e.g., "Columns: Name, Age, Score." or "Column: Observations."). Header names are trimmed before speaking. Columns with empty/whitespace names are announced as "unnamed"
- Each row is read as a comma-separated list of values with a period at the end for a natural pause between rows (e.g., "Alice, 12, 95.")
- All cell values are trimmed before speaking. Empty or whitespace-only cells are announced as "blank" to maintain positional context for listeners (e.g., "Alice, blank, 95.")
- Rows are read in case order (the order they appear in `dataSet.cases`)
- If a table has no data (no cases), Read Aloud reads only the column headers
- If a table has no columns, Read Aloud announces the tile type and title (e.g., "Table tile: My Data"), or just the tile type if no title is set (e.g., "Table tile")
- Column headers and row data are combined into a single "content" string (e.g., "Columns: Name, Age. Alice, 12. Bob, 14."), composed with the tile title using the same `buildTileSpeechText()` pattern as sketch and text tiles

### Integration with Existing Read Aloud Behavior

- These changes apply whenever Read Aloud reads a sketch or table tile — both in single-tile selected mode and full-page sequential mode
- The existing behavior for text tiles, tile titles, comments, section headers, and all service controls (pause, resume, stop, jump, etc.) is unchanged
- The reactive queue rebuild (from CLUE-418) automatically picks up content changes in sketch text objects and table cells during active reading
- When a sketch or table tile is selected and the comments panel is open, the tile content is read first (including sketch text/table values), then the tile's comment thread — matching the CLUE-418 pattern
- Right pane Read Aloud includes sketch and table content for right-pane documents
- The content-only pattern (no tile type announced when content exists without a title) is inherited from the existing `buildTileSpeechText()` logic and applies consistently across text, sketch, and table tiles

### Logging

- No new log events are needed — existing `TOOLBAR_READ_ALOUD_TILE_TRANSITION` events already capture tile ID and type
- The spoken text content is not logged (consistent with existing behavior)

## Technical Notes

### Sketch Text Extraction

To preserve array structure order, use a recursive walk of the `objects` array — not `objectMap` (which is a dictionary and doesn't guarantee insertion order). For each object: if it's a text object, collect its `text`; if it's a group, recurse into its `objects` array; all other object types are silently skipped (fail-closed).

**Import note:** `isTextObject()` and `isGroupObject()` live in `.tsx` files that import React and component dependencies. To avoid pulling React into the service layer, use structural checks instead: `object.type === "text"` for text objects and `object.type === "group"` for groups, accessing properties via cast. This mirrors how `buildTileSpeechText()` already casts `tile.content` for text tiles.

### Table Text Extraction

Table data is accessed via `TableContentModel.dataSet` which returns either the shared or imported DataSet. Column names come from `dataSet.attributes[].name`; cell values from `dataSet.getStrValue(caseId, attrId)`. `getStrValue()` always returns a string (`""` for missing/undefined values), so `!value.trim()` reliably catches both empty and whitespace-only cells for the "blank" substitution.

### Note on Table Reading vs WCAG Table Accessibility

The "Columns: Name, Age, Score" announcement followed by unlabeled row values is a Read Aloud convenience pattern for ELL students, not a WCAG-compliant table navigation mechanism. Screen reader users access tables via standard ARIA table roles and cell-by-cell navigation, which is separate from the Read Aloud feature.

### Accepted Limitation: Header Chunking for Wide Tables

The "Columns: …" header list is a single sentence. For very wide tables (>~20 columns), this sentence may exceed the ~200-char chunk boundary and split mid-header list. This is a pre-existing characteristic of the sentence-based chunking mechanism and is acceptable — very wide tables are uncommon in CLUE student work.

### Where Changes Are Needed

The primary change is in `buildTileSpeechText()` in `src/models/services/read-aloud-queue-items.ts`. This function needs additional branches for `kDrawingTileType` and `kTableTileType` to compose speech text from their respective content models. No changes needed to `ReadAloudService`, queue item types, `ReadAloudButton`, or `replaceQueue()`.

## Out of Scope

- Reading non-text drawing objects (describing shapes, images, etc.)
- Reading table formulas or expression definitions aloud
- Per-cell or per-text-object highlighting during reading (current highlighting is at tile level)
- New queue item types for individual sketch text objects or table cells (content is composed into a single `TileReadAloudItem` per tile)
- Voice/language selection for reading table data
- Reading linked table data from other tiles
- Reading column header types or units
- Localization/i18n of TTS strings ("Columns:", "blank", etc.) — no i18n infrastructure exists for Read Aloud strings currently

## Decisions

### How should sketch text objects be ordered for reading?
**Context**: Text objects on a sketch canvas have x,y positions but are stored in the `objects` array in creation order. Users may expect spatial reading order (top-to-bottom, left-to-right) rather than creation order.
**Options considered**:
- A) Read in creation order (order in the `objects` array) — simplest, matches internal data model
- B) Read in spatial order (sorted by y position, then x position) — more intuitive for listeners
- C) Read in the order they appear in the object list view (if the list view has a specific ordering)

**Decision**: A — Array structure order. Text objects are read in the order they appear in the `objects` array, traversed depth-first when groups are present. Note: grouping can change an object's position in the tree relative to its original creation time — "array structure order" is the precise term.

---

### Should table rows have any verbal separator or row numbering?
**Context**: When reading many rows of data, it may be hard for listeners to distinguish where one row ends and another begins without visual cues.
**Options considered**:
- A) No separator — read rows as continuous comma-separated values
- B) Brief pause between rows (insert period in speech text so TTS pauses naturally)
- C) Number rows explicitly (e.g., "Row 1: Alice, 12, 95. Row 2: Bob, 14, 88")
- D) Just natural sentence breaks between rows without numbering

**Decision**: B — Brief pause between rows via natural sentence breaks (period at end of each row).

---

### How should empty table cells be announced?
**Context**: When a cell has no value, listeners need to maintain positional awareness of which column they're hearing.
**Options considered**:
- A) Say "empty" for each empty cell
- B) Skip empty cells silently
- C) Say "blank" for each empty cell
- D) Announce the column name with "empty"

**Decision**: C — Say "blank" for each empty cell (e.g., "Alice, blank, 95").

---

### Should the column headers be announced before row data?
**Context**: Hearing column headers first helps listeners understand the data structure, but adds verbosity for small or familiar tables.
**Options considered**:
- A) Always announce column headers first
- B) Skip column headers, read only row data
- C) Announce headers only if the table has more than one column

**Decision**: A — Always announce column headers first.

---

### Should text objects within groups be read?
**Context**: Drawing objects can be grouped (`GroupObject`). Groups contain nested objects that may include text objects. Reading grouped text objects requires recursively traversing groups.
**Options considered**:
- A) Yes, read text objects inside groups (requires recursive traversal)
- B) No, only read top-level text objects (simpler, but may miss content)

**Decision**: A — Yes, read text objects inside groups. Requires recursive traversal of the objects array.

---

### Large table speech text may hit Chrome's ~15-second utterance cutoff
**Context**: The existing `chunkText()` in the service splits at sentence boundaries (~200 chars). Each table row ends with a period, so rows become individual chunks.
**Options considered**:
- A) Add a row limit to truncate large tables
- B) Accept that long rows split mid-row at chunk boundaries

**Decision**: B — No row limit needed. Users can stop reading anytime. The chunking mechanism handles arbitrarily long text. Long rows with many columns split mid-row at the 200-char boundary, which is acceptable.

---

### Import of drawing/table types creates coupling in read-aloud-queue-items.ts
**Context**: Adding `kDrawingTileType` and `kTableTileType` imports creates direct coupling between the queue item builder and specific tile types.
**Options considered**:
- A) Accept direct imports for 3 tile types
- B) Add a generic `getReadableText()` interface per tile content model

**Decision**: A — Direct imports are acceptable at this scale. A generic interface would be over-engineering. Refactor if/when more tile types are added.

---

### `objectMap` vs recursive `objects` traversal for sketch text extraction
**Context**: `objectMap` is a dictionary that doesn't guarantee insertion order. The `objects` array preserves array structure order.
**Options considered**:
- A) Use `objectMap` (simpler access but unordered)
- B) Use recursive `objects` array walk (preserves order)

**Decision**: B — Recursive `objects` array traversal to preserve array structure order. Updated Technical Notes to specify this.

---

### Numeric table values may be spoken oddly by TTS
**Context**: Raw `getStrValue()` output includes numbers as strings. The Web Speech API may pronounce some numeric patterns unexpectedly.
**Options considered**:
- A) Format numeric values before speaking
- B) Pass raw string values to TTS

**Decision**: B — Raw `getStrValue()` output is acceptable. The Web Speech API handles common numeric strings reasonably well, and formatting would add complexity. Consistent with how text tile content is passed unprocessed.

---

### `extractTableText` JSDoc comment wording
**Context**: The JSDoc described the approach as avoiding a "static TableContentModel import" but the real motivation is avoiding tight coupling.
**Options considered**:
- A) Keep original wording
- B) Update to clarify it's about avoiding an import dependency

**Decision**: B — Updated comment to clarify it's about avoiding an import dependency, not a `.tsx` issue.

---

### New `if` branches should be `else if` for mutual exclusivity
**Context**: The `kDrawingTileType` and `kTableTileType` branches in `buildTileSpeechText()` are mutually exclusive with `kTextTileType`.
**Options considered**:
- A) Use separate `if` statements
- B) Use `else if` chain

**Decision**: B — Use `else if` for mutual exclusivity and clarity.
