# CLUE-260: Insert image data in Table cell

## Goal

Let a student (or an ML data production tile) put an image into a Table tile cell the same
way they already can in a Data Card: via a toolbar upload button targeting the selected
cell, and via Ctrl-V into an open cell editor. Every image so added must land behind CLUE's
existing class-scoped storage wall, and the cell must hold a durable reference to it rather
than the image data or a session-local URL.

Secondary goal, pulled in because it is a small change and removes a live inconsistency: make
Data Cards' paste path use the same helper, so the two data tiles behave identically.

## Scope correction

Three of the ticket's five bullets are already satisfied in `master`. This is an **input-only**
change; nothing about rendering, row sizing, sharing or logging needs new code.

| Ticket bullet | Status |
|---|---|
| Image upload button on toolbar puts an image (thumbnail) into active cell | **To build** |
| Button disabled if not editing a cell | **To build** (reinterpreted — see Decisions) |
| Ctrl-V pastes clipboard into cell including images | **To build** |
| Images can be viewed in data deck tiles if shared | Already works — `sort-card-attribute.tsx:22-68` |
| Logged action | Already works — see Logging |

Already present on the render side:

- `cell-formatter.tsx:60-68` branches on `gImageMap.isImageUrl(value)` and renders
  `.image-cell` with an `<img>`.
- `use-row-height.ts:41-43` raises the row to `kDefaultImageCellHeight` for image cells.
- Table and Data Cards share one `DataSet`, and an image cell value is just a `ccimg://`
  string, so an image added from either tile is visible in the other.

## Context: the storage wall

This is the constraint the design is built around, and the part easiest to get wrong.

### Write path

`gImageMap.addFileImage(file)`
→ `storeFileImage` (`src/utilities/image-utils.ts:68`)
→ `resizeImage`, capped at 512×512 (`ImageConstants`, `image-utils.ts:7-8`)
→ `db.addImage` (`src/lib/db.ts:1449`)
→ RTDB push under `firebase.getImagesPath(user)` = `/authed/portals/{portal}/classes/{classHash}/images/{imageKey}`
  (`src/lib/firebase.ts:296`)

Image bytes are stored **base64 in the Realtime Database**, not in a public bucket. That node
is gated in `database.rules.json`:

```json
".read":  "auth != null && auth.class_hash == $class_hash",
".write": "auth != null && auth.class_hash == $class_hash"
```

So the bytes are reachable only by a client holding a Firebase token whose `class_hash` custom
claim matches the owning class.

### Two URLs, and why conflating them breaks everything

`addFileImage` / `getImage` return an `ImageMapEntry` carrying both:

| Field | Value | Lifetime |
|---|---|---|
| `contentUrl` | `ccimg://fbrtdb.concord.org/{classHash}/{imageKey}` | **Persistent reference — this is what gets stored** |
| `displayUrl` | `blob:…` from `URL.createObjectURL` (`image-utils.ts:51`) | Ephemeral, session-local, per-client |

Storing `displayUrl` in a cell would render correctly on the authoring machine and appear as a
broken image for every other user and after any reload. **The cell always stores `contentUrl`.**

### Read path (already correct, no change needed)

`lookupImage` (`table-tile.tsx:100-114`) calls `gImageMap.getImage(value)`, which runs the full
handler chain. `firebaseRealTimeDBImagesHandler.store` (`image-map.ts:639-664`) picks the door:

- same class → `db.getImageBlob(imageKey)`, a direct authenticated RTDB read;
- different class → `db.getCloudImageBlob(normalized)` → the `getImageData_v1` callable cloud
  function (`db.ts:1503-1515`), which performs its own server-side authorization.

Cross-class sharing therefore works, and both doors are authenticated.

### External URLs are ingested too

`externalUrlImagesHandler.store` (`image-map.ts:449-491`) already pulls an `https://` or
`data:` image into CLUE's own Firebase via `storeImage`, returning the resulting `ccimg://` as
`contentUrl`. On a CORS failure it falls back to `{ contentUrl: url, displayUrl: url, success: true }`
— i.e. the original public URL. That fallback is pre-existing and deliberate; this design keeps
it but makes it detectable and logged.

## Decisions

Confirmed with product before writing:

1. **Button enablement keys off cell *selection*, not editing.** The ticket says "disabled if
   not editing a cell", but clicking a toolbar button blurs the open editor, which commits and
   closes it — a literal reading fights the UI and would need mousedown-suppression machinery.
   The button is enabled whenever `dataSet.isAnyCellSelected` is true and writes into
   `dataSet.firstSelectedCell` (`data-set.ts:491` and `:497`). This matches Data Cards' effective
   behavior.

2. **Author opt-in.** The button is registered for the `table` tile type but **not** added to
   `settings.table.tools` in `src/clue/app-config.json`. Units opt in by listing `"image-upload"`
   in their table tools, the same name Data Cards already uses. Existing math units are
   unchanged. The drift-guard test (`toolbar-config-registration.test.ts:26`) only checks
   configured → registered, so a registered-but-not-defaulted button passes.

3. **Paste is scoped to the open cell editor.** Mirrors Data Cards. No grid-level paste
   listener.

4. **An image replaces any existing cell value**, like typing over a cell.

5. **External image URLs and `data:` URIs pasted as text are ingested at paste time**, not
   stored raw. The cell receives the resulting `ccimg://` reference. This is the one place the
   design deliberately diverges from Data Cards' current behavior — and Data Cards is being
   brought along to match (see Consolidation).

## Design

### Shared helper — `src/utilities/image-ingest.ts` (new)

One function, used by both tiles, covering all input paths:

```ts
// Returns a value safe to persist in a cell, or undefined if the image could not be stored.
export async function ingestImage(source: File | string): Promise<string | undefined> {
  const entry = source instanceof File
    ? await gImageMap.addFileImage(source)   // toolbar upload, pasted image data
    : await gImageMap.getImage(source);      // pasted http(s) URL or data: URI
  if (entry.status === EntryStatus.Error) return undefined;
  return entry.contentUrl;
}
```

Both arms resize to 512×512 and push to class-scoped RTDB before returning. The `File` arm is
guaranteed walled. The `string` arm is walled unless CORS blocked the fetch, in which case
`contentUrl` comes back as the original URL — detected with a `ccimg://` prefix check and
logged as a warning rather than failed, matching the handler's existing tolerance.

No circular import: this module imports `models/image-map`, which imports
`utilities/image-utils`; nothing in `image-map` imports this.

### Table — toolbar button

`TableImageUploadButton` in `table-toolbar-registration.tsx`, shaped like the existing
`ImportDataButton` in that file, reusing `ImageUploadButton` (`image-toolbar.tsx:19`) for the
hidden-file-input mechanics it already shares with three tiles. Registered under the name
`"image-upload"`.

Enabled via `dataSet.isAnyCellSelected`, passed to `TileToolbarButton`'s existing `disabled`
prop, which keeps the button keyboard-focusable and announces on disabled click
(`tile-toolbar-button.tsx:65-74`).

**The target cell is captured at click time**, not re-read inside the promise callback —
`ingestImage` is async and the selection can move while it is in flight.

### Table — change handler

`ITableToolbarContext` (`table-toolbar-context.ts`) gains one method, `uploadImage(file: File)`.
It calls `ingestImage`, then writes the result through the existing `setAttributeValue` handler
(`use-content-change-handlers.ts:103`). The toolbar button stays presentational; the write lives
with the other change handlers.

### Table — paste

An `onPaste` handler on the existing `TextareaAutosize` in `cell-text-editor.tsx`, mirroring
`case-attribute.tsx:244-256`:

- `getClipboardContent(event.clipboardData)` (`clipboard-utils.ts:33`)
- clipboard image file → `ingestImage(file)`
- text matching `gImageMap.isImageUrl` (covers `https://…png` and `data:image/…`) → `ingestImage(text)`
- anything else → default paste proceeds untouched

When either image branch handles the event it calls `event.preventDefault()`. Data Cards omits
this, so a pasted URL is both stored as the value *and* inserted as text into the textarea; the
table should not inherit that quirk.

On a successful ingest the handler calls the editor's existing `updateValue(contentUrl)`, so no
new write plumbing. The handler is async; the editor stays open until the ingest resolves rather
than committing a half-written value.

### Consolidation — Data Cards

`case-attribute.tsx` currently splits its paste handling:

- image file branch (`:236-238`) — already correct, stores `image.contentUrl`;
- text-URL branch (`:253-254`) — `setValue(clipboardContents.text)`, storing a raw public URL.

Only the second branch changes, to route through `ingestImage` and store the returned
`contentUrl`. `handlePasteImage` is rewritten to call `ingestImage` as well so both branches
share one path.

**Behavior change, forward-only.** Newly pasted external URLs in Data Cards are copied into
class-scoped Firebase instead of being stored raw. Existing documents are unaffected —
`getImage` still resolves raw URLs on read — so no migration is required. To be called out in
the PR description, since a ticket titled for Table is touching Data Cards.

### Explicitly out of scope

`pasteClipboardImage` (`clipboard-utils.ts:13-30`) is a *third* paste implementation, used by
the Drawing, Image and Geometry tiles, whose text branch accepts only curriculum-relative URLs
(`curriculum/…/images/…`) and `console.error`s on anything else. Those three tiles consume an
`ImageMapEntry` rather than a cell string, their `onComplete` shape differs, and their
curriculum-only restriction appears deliberate. Folding them into `ingestImage` would change
behavior in three mature tiles and rewrite `clipboard-utils.test.ts:49-105`. **Follow-up ticket,
not this one.**

## Logging

No new logging code. `setAttributeValue` routes to `TableContentModel.setCanonicalCaseValues`,
which already emits `logTileChangeEvent(LogEventName.TABLE_TOOL_CHANGE, …)` with
`action: "update", target: "rows"` and the new value in `props` (`table-content.ts:272-281`).
The `ccimg://` value is identifiable in the log payload. Undo/redo comes along the same path.

## Testing

**Storage-invariant regression test (the important one).** For each of the four input paths —
toolbar upload, pasted image file, pasted external URL, pasted `data:` URI — assert the value
written to the cell matches `^ccimg://` and is **not** a `blob:` or `data:` URL. This is the test
that catches a future regression to storing `displayUrl`.

Additional Jest coverage:

- CORS-failure path: mocked handler returns the original URL; assert the cell still receives a
  value and a warning is logged.
- Toolbar button: disabled with no selection, enabled with one cell selected, invokes context
  `uploadImage` on file choice.
- Stale-selection: selection changes while `ingestImage` is in flight; assert the image lands in
  the cell selected at click time.
- Paste handler branches, with `getClipboardContent` mocked: image file / image-URL text /
  `data:` URI / plain text falls through.
- Data Cards paste: first paste tests this component has had. Same branch matrix, asserting
  `contentUrl` is stored in all image cases.

Cypress:

- Upload into a selected cell, assert `.image-cell img` appears.
- Add the new spec to the `test` choice list in `.github/workflows/manual-regression.yml` in the
  same change (per CLAUDE.md, a spec absent from that list cannot be dispatched).

## Known limitation (recorded, not addressed)

Images live as base64 in the Realtime Database rather than a storage bucket, so each one costs
roughly its resized size in the class's RTDB. A table invites many more images than a data card
does, so a heavily-imaged table is correspondingly heavier. This is existing platform behavior
that CLUE-260 does not change, but it is worth knowing before a unit is authored around
image-per-row tables.
