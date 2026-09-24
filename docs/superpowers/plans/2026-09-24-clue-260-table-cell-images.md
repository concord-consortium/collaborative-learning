# CLUE-260: Images in Table Cells — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students put images into Table tile cells via a toolbar upload button and via Ctrl-V in the cell editor, with every image stored behind CLUE's class-scoped Firebase wall.

**Architecture:** A new shared helper, `ingestImage`, wraps `gImageMap` and returns a persistable `ccimg://` reference. The table's toolbar button and cell-editor paste handler both call it and write the result through the existing `onUpdateRow` change handler, which already logs and supports undo. Data Cards' paste path is switched to the same helper, replacing a branch that stored raw external URLs. The table tile already renders image cells and sizes rows for them, so no rendering work is needed beyond making the selection highlight visible on image cells.

**Tech Stack:** TypeScript, React 17, MobX State Tree, react-data-grid, Jest + @testing-library/react, Cypress.

**Spec:** `docs/superpowers/specs/2026-09-24-clue-260-table-cell-images-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utilities/image-ingest.ts` *(create)* | The single sanctioned path from a File/URL to a persistable `ccimg://` value |
| `src/utilities/image-ingest.test.ts` *(create)* | Storage-invariant tests — the regression guard for the whole ticket |
| `src/components/tiles/table/table-toolbar-context.ts` *(modify)* | Add `uploadImage` to the toolbar context interface |
| `src/components/tiles/table/table-tile.tsx` *(modify)* | Implement `uploadImage`, add it to the context value |
| `src/components/tiles/table/table-toolbar-registration.tsx` *(modify)* | New `TableImageUploadButton`, registered as `image-upload` |
| `src/components/tiles/table/table-tile-image.test.tsx` *(create)* | Stale-selection guard for the async upload |
| `src/components/tiles/table/table-image-upload-button.test.tsx` *(create)* | Button enable/disable and click behavior |
| `src/components/tiles/table/cell-text-editor.tsx` *(modify)* | `onPaste` handler routing images to `ingestImage` |
| `src/components/tiles/table/cell-text-editor.test.tsx` *(create)* | Paste branch coverage |
| `src/components/tiles/table/cell-formatter.scss` *(modify)* | Visible selection highlight on image cells |
| `src/plugins/data-card/components/case-attribute.tsx` *(modify)* | Route both paste branches through `ingestImage` |
| `src/plugins/data-card/case-attribute-paste.test.tsx` *(create)* | First paste tests for Data Cards |
| `src/public/demo/units/qa/content.json` *(modify)* | Opt the QA unit's table into `image-upload` so Cypress can exercise it |
| `cypress/e2e/functional/tile_tests/table_tool_spec.js` *(modify)* | E2E upload + highlight assertions |

`table_tool_spec.js` is already listed in `.github/workflows/manual-regression.yml:60`, so adding to it rather than creating a new spec avoids a workflow change.

---

## Task 1: The `ingestImage` helper

**Files:**
- Create: `src/utilities/image-ingest.ts`
- Test: `src/utilities/image-ingest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utilities/image-ingest.test.ts`:

```ts
import { EntryStatus, gImageMap, ImageMapEntry } from "../models/image-map";
import { ingestImage } from "./image-ingest";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";

const readyEntry = (contentUrl: string) => ImageMapEntry.create({
  contentUrl,
  displayUrl: "blob:http://localhost/abc-123",
  filename: "test.png",
  height: 100,
  retries: 0,
  status: EntryStatus.Ready,
  width: 100
});

const errorEntry = () => ImageMapEntry.create({
  displayUrl: "",
  retries: 0,
  status: EntryStatus.Error
});

const mockFile = () => new File(["x"], "test.png", { type: "image/png" });

describe("ingestImage", () => {
  afterEach(() => jest.restoreAllMocks());

  it("stores a File via addFileImage and returns the ccimg:// contentUrl", async () => {
    const spy = jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const result = await ingestImage(mockFile());
    expect(spy).toHaveBeenCalled();
    expect(result).toBe(kCcImgUrl);
  });

  it("never returns the ephemeral displayUrl", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const result = await ingestImage(mockFile());
    expect(result).not.toMatch(/^blob:/);
    expect(result).not.toMatch(/^data:/);
  });

  it("ingests an external image URL via getImage and returns the ccimg:// contentUrl", async () => {
    const spy = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const result = await ingestImage("https://example.com/photo.png");
    expect(spy).toHaveBeenCalledWith("https://example.com/photo.png");
    expect(result).toBe(kCcImgUrl);
  });

  it("ingests a data: URI via getImage", async () => {
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    const result = await ingestImage(dataUri);
    expect(result).toBe(kCcImgUrl);
  });

  it("returns undefined when the store fails", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(errorEntry());
    expect(await ingestImage(mockFile())).toBeUndefined();
  });

  it("warns but still returns the value when CORS forced a fallback to the original url", async () => {
    const externalUrl = "https://example.com/photo.png";
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(externalUrl));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await ingestImage(externalUrl);
    expect(result).toBe(externalUrl);
    expect(warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/utilities/image-ingest.test.ts`
Expected: FAIL — `Cannot find module './image-ingest'`

- [ ] **Step 3: Write the implementation**

Create `src/utilities/image-ingest.ts`:

```ts
import { EntryStatus, gImageMap } from "../models/image-map";

const kCcImgPrefix = "ccimg://";

/**
 * The single sanctioned path from a user-supplied image to a value safe to persist in a
 * document. Both arms resize the image and push it to class-scoped storage, returning a
 * `ccimg://` reference. Never returns the entry's `displayUrl`, which is a session-local
 * blob URL that would be dead for every other user.
 *
 * Returns undefined if the image could not be stored.
 */
export async function ingestImage(source: File | string): Promise<string | undefined> {
  const entry = source instanceof File
    ? await gImageMap.addFileImage(source)
    : await gImageMap.getImage(source);

  if (entry.status === EntryStatus.Error) return undefined;

  const { contentUrl } = entry;
  if (contentUrl && !contentUrl.startsWith(kCcImgPrefix)) {
    // The external-url handler falls back to the original url when it cannot fetch the
    // image (usually CORS). The value still works, but it stays outside our storage.
    console.warn(`ingestImage: image was not stored in CLUE, using original url: ${contentUrl}`);
  }
  return contentUrl;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/utilities/image-ingest.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/utilities/image-ingest.ts src/utilities/image-ingest.test.ts
git commit -m "CLUE-260: add ingestImage helper for storing images behind the class wall"
```

---

## Task 2: Wire `uploadImage` into the table's toolbar context

**Files:**
- Modify: `src/components/tiles/table/table-toolbar-context.ts`
- Modify: `src/components/tiles/table/table-tile.tsx:464-468`

No test in this task — it is pure plumbing with no behavior of its own. Task 3 tests the button that consumes it, Task 7 covers it end to end.

- [ ] **Step 1: Add `uploadImage` to the context interface**

In `src/components/tiles/table/table-toolbar-context.ts`, change the interface to:

```ts
export interface ITableToolbarContext {
  showExpressionsDialog: () => void;
  deleteSelected: () => void;
  importData: (file: File) => void;
  uploadImage: (file: File) => void;
}
```

- [ ] **Step 2: Implement `uploadImage` in table-tile.tsx**

In `src/components/tiles/table/table-tile.tsx`, add this import alongside the other utility imports:

```ts
import { ingestImage } from "../../../utilities/image-ingest";
```

Then, immediately above the existing `const toolbarContext = {` (currently line 464), add:

```ts
  // The target cell is captured here rather than read inside the promise, because ingesting
  // an image is async and the selection can move while it is in flight.
  const uploadImage = useCallback((file: File) => {
    const cell = dataSet.firstSelectedCell;
    if (!cell) return;
    ingestImage(file).then(contentUrl => {
      if (contentUrl) {
        changeHandlers.onUpdateRow({ __id__: cell.caseId, [cell.attributeId]: contentUrl });
      }
    });
  }, [dataSet, changeHandlers]);
```

- [ ] **Step 3: Add it to the context value**

Change the `toolbarContext` object (line 464) to:

```ts
  const toolbarContext = {
    showExpressionsDialog: handleToolbarShowExpressionsDialog,
    deleteSelected,
    importData,
    uploadImage
  };
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors referencing `table-tile.tsx` or `table-toolbar-context.ts`.

If `changeHandlers` is not the local name in scope at that point in `table-tile.tsx`, find the variable holding the result of `useContentChangeHandlers(...)` and use its name. The method needed is `onUpdateRow`.

- [ ] **Step 5: Commit**

```bash
git add src/components/tiles/table/table-toolbar-context.ts src/components/tiles/table/table-tile.tsx
git commit -m "CLUE-260: add uploadImage to the table toolbar context"
```

---

## Task 3: The toolbar upload button

**Files:**
- Modify: `src/components/tiles/table/table-toolbar-registration.tsx`
- Test: `src/components/tiles/table/table-image-upload-button.test.tsx`

The two sibling buttons in this file (`LinkTableButton` at line 51, `LinkGraphButton` at line 83)
both read the dataSet with the same two lines. Follow that pattern exactly rather than
introducing a hook — CLAUDE.md asks for consistency with surrounding code.

- [ ] **Step 1: Write the failing test**

Create `src/components/tiles/table/table-image-upload-button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ITileModel, TileModel } from "../../../models/tiles/tile-model";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { TileModelContext } from "../tile-api";
import { TableToolbarContext, ITableToolbarContext } from "./table-toolbar-context";
import { TableImageUploadButton } from "./table-toolbar-registration";
import { defaultTableContent } from "../../../models/tiles/table/table-content";

// getTileDataSet walks the tile's shared models via the shared model manager. Stubbing it is
// far cheaper here than standing up a full container; table-content.test.ts:44-95 shows the
// full-fidelity version if this ever needs to be more realistic.
let mockDataSet: any;
jest.mock("../../../models/shared/shared-data-utils", () => ({
  ...jest.requireActual("../../../models/shared/shared-data-utils"),
  getTileDataSet: () => mockDataSet
}));

const makeDataSet = (withSelection: boolean) => {
  const shared = SharedDataSet.create({ dataSet: { attributes: [{ id: "attr1", name: "photo" }] } });
  const { dataSet } = shared;
  dataSet.addCanonicalCasesWithIDs([{ __id__: "case1", attr1: "" }]);
  if (withSelection) dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case1" }]);
  return dataSet;
};

const renderButton = (withSelection: boolean, overrides: Partial<ITableToolbarContext> = {}) => {
  mockDataSet = makeDataSet(withSelection);
  const context = {
    showExpressionsDialog: jest.fn(),
    deleteSelected: jest.fn(),
    importData: jest.fn(),
    uploadImage: jest.fn(),
    ...overrides
  } as ITableToolbarContext;
  const tile: ITileModel = TileModel.create({ content: defaultTableContent() });
  render(
    <TileModelContext.Provider value={tile}>
      <TableToolbarContext.Provider value={context}>
        <TableImageUploadButton name="image-upload" />
      </TableToolbarContext.Provider>
    </TileModelContext.Provider>
  );
  return context;
};

describe("TableImageUploadButton", () => {
  it("is disabled when no cell is selected", () => {
    renderButton(false);
    expect(screen.getByRole("button", { name: /upload image/i }))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("is enabled when a cell is selected", () => {
    renderButton(true);
    expect(screen.getByRole("button", { name: /upload image/i }))
      .not.toHaveAttribute("aria-disabled");
  });

  it("calls uploadImage with the chosen file", async () => {
    const uploadImage = jest.fn();
    renderButton(true, { uploadImage });
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(uploadImage).toHaveBeenCalledWith(file);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/tiles/table/table-image-upload-button.test.tsx`
Expected: FAIL — `TableImageUploadButton` is not exported from `table-toolbar-registration`.

- [ ] **Step 3: Add the button component**

In `src/components/tiles/table/table-toolbar-registration.tsx`, add this import:

```ts
import { ImageUploadButton } from "../image/image-toolbar";
```

Then add the component above the `registerTileToolbarButtons` call, matching the shape of
`LinkTableButton` directly above it:

```tsx
export const TableImageUploadButton = observer(function TableImageUploadButton(
  { name }: IToolbarButtonComponentProps
) {
  const toolbarContext = useContext(TableToolbarContext);

  // Assume we always have a model
  const model = useContext(TileModelContext)!;
  const dataSet = getTileDataSet(model.content);

  // The image lands in the selected cell, so there must be one.
  const disabled = !dataSet?.isAnyCellSelected;

  return (
    <TileToolbarButton name={name} title="Upload image" disabled={disabled}>
      <ImageUploadButton onUploadImageFile={file => toolbarContext?.uploadImage(file)} />
    </TileToolbarButton>
  );
});
```

- [ ] **Step 4: Register the button**

Add this entry to the array passed to `registerTileToolbarButtons("table", [...])`:

```ts
  {
    name: "image-upload",
    component: TableImageUploadButton
  }
```

Do **not** add `"image-upload"` to `settings.table.tools` in `src/clue/app-config.json`. The
button is author opt-in; adding it to the default would turn it on for every existing unit.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/components/tiles/table/table-image-upload-button.test.tsx`
Expected: PASS, 3 tests

If `TileToolbarButton` swallows the nested file input's click, render `ImageUploadButton`
directly instead of nesting it, passing `extraClasses` for styling and gating the
`onUploadImageFile` callback on the same `isAnyCellSelected` check. Keep an `aria-disabled`
attribute on the rendered button so the first two tests still hold.

- [ ] **Step 6: Verify the drift guard still passes**

Run: `npx jest src/components/toolbar/toolbar-config-registration.test.ts`
Expected: PASS. This test only checks configured → registered, so a registered-but-not-defaulted
button is fine.

- [ ] **Step 7: Commit**

```bash
git add src/components/tiles/table/table-toolbar-registration.tsx \
        src/components/tiles/table/table-image-upload-button.test.tsx
git commit -m "CLUE-260: add author-opt-in image upload button to the table toolbar"
```

---

## Task 3b: Stale-selection guard

**Files:**
- Test: `src/components/tiles/table/table-tile-image.test.tsx`

`ingestImage` is async. If the student moves the selection while an upload is in flight, the
image must still land in the cell that was selected when they clicked. Task 2 implements this by
capturing the cell before awaiting; this task proves it.

- [ ] **Step 1: Write the failing test**

Create `src/components/tiles/table/table-tile-image.test.tsx`:

```tsx
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import * as imageIngest from "../../../utilities/image-ingest";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";

// Mirrors the uploadImage implementation in table-tile.tsx. If that changes, change this too.
const makeUploadImage = (dataSet: any, onUpdateRow: (values: any) => void) => (file: File) => {
  const cell = dataSet.firstSelectedCell;
  if (!cell) return Promise.resolve();
  return imageIngest.ingestImage(file).then(contentUrl => {
    if (contentUrl) onUpdateRow({ __id__: cell.caseId, [cell.attributeId]: contentUrl });
  });
};

describe("table image upload", () => {
  afterEach(() => jest.restoreAllMocks());

  it("writes the image to the cell selected at click time, not the current one", async () => {
    const shared = SharedDataSet.create({
      dataSet: { attributes: [{ id: "attr1", name: "photo" }] }
    });
    const { dataSet } = shared;
    dataSet.addCanonicalCasesWithIDs([
      { __id__: "case1", attr1: "" },
      { __id__: "case2", attr1: "" }
    ]);
    dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case1" }]);

    let resolveIngest: (v: string) => void = () => undefined;
    jest.spyOn(imageIngest, "ingestImage")
        .mockReturnValue(new Promise<string>(res => { resolveIngest = res; }));

    const onUpdateRow = jest.fn();
    const uploadImage = makeUploadImage(dataSet, onUpdateRow);
    const pending = uploadImage(new File(["x"], "photo.png", { type: "image/png" }));

    // Student clicks a different cell while the upload is still in flight.
    dataSet.setSelectedCells([{ attributeId: "attr1", caseId: "case2" }]);
    resolveIngest(kCcImgUrl);
    await pending;

    expect(onUpdateRow).toHaveBeenCalledWith({ __id__: "case1", attr1: kCcImgUrl });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/components/tiles/table/table-tile-image.test.tsx`
Expected: PASS, because Task 2 already captured the cell before awaiting.

To confirm the test actually guards anything, temporarily change `makeUploadImage` to read
`dataSet.firstSelectedCell` *inside* the `.then()` and re-run — it must then FAIL with
`case2`. Revert that change before committing.

- [ ] **Step 3: Commit**

```bash
git add src/components/tiles/table/table-tile-image.test.tsx
git commit -m "CLUE-260: guard against stale cell selection during async upload"
```

---

## Task 4: Paste in the cell editor

**Files:**
- Modify: `src/components/tiles/table/cell-text-editor.tsx`
- Test: `src/components/tiles/table/cell-text-editor.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/tiles/table/cell-text-editor.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { gImageMap } from "../../../models/image-map";
import * as clipboardUtils from "../../../utilities/clipboard-utils";
import * as imageIngest from "../../../utilities/image-ingest";
import CellTextEditor from "./cell-text-editor";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";

const renderEditor = (onRowChange = jest.fn()) => {
  const row = { __id__: "case1", attr1: "" } as any;
  const column = { key: "attr1", width: 100, appData: {} } as any;
  render(
    <CellTextEditor row={row} column={column} onRowChange={onRowChange} onClose={jest.fn()} />
  );
  return { onRowChange, row };
};

const setClipboard = (contents: { image: File | null, text: string | null }) => {
  jest.spyOn(clipboardUtils, "getClipboardContent")
      .mockResolvedValue({ ...contents, types: [] });
};

describe("CellTextEditor paste handling", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ingests a pasted image file and writes the ccimg:// value", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    setClipboard({ image: file, text: null });
    const ingest = jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(kCcImgUrl);
    const { onRowChange, row } = renderEditor();

    screen.getByRole("textbox").dispatchEvent(new Event("paste", { bubbles: true }));

    await waitFor(() => expect(ingest).toHaveBeenCalledWith(file));
    await waitFor(() => expect(onRowChange).toHaveBeenCalledWith({ ...row, attr1: kCcImgUrl }, false));
  });

  it("ingests pasted text that is an image url", async () => {
    setClipboard({ image: null, text: "https://example.com/photo.png" });
    jest.spyOn(gImageMap, "isImageUrl").mockReturnValue(true);
    const ingest = jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(kCcImgUrl);
    renderEditor();

    screen.getByRole("textbox").dispatchEvent(new Event("paste", { bubbles: true }));

    await waitFor(() => expect(ingest).toHaveBeenCalledWith("https://example.com/photo.png"));
  });

  it("leaves plain text to the default paste behavior", async () => {
    setClipboard({ image: null, text: "just some text" });
    jest.spyOn(gImageMap, "isImageUrl").mockReturnValue(false);
    const ingest = jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(kCcImgUrl);
    renderEditor();

    screen.getByRole("textbox").dispatchEvent(new Event("paste", { bubbles: true }));

    await waitFor(() => expect(ingest).not.toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/tiles/table/cell-text-editor.test.tsx`
Expected: FAIL — `ingestImage` is never called; there is no paste handler yet.

- [ ] **Step 3: Add the paste handler**

In `src/components/tiles/table/cell-text-editor.tsx`, add these imports:

```ts
import { gImageMap } from "../../../models/image-map";
import { getClipboardContent } from "../../../utilities/clipboard-utils";
import { ingestImage } from "../../../utilities/image-ingest";
```

Add this handler above the `return`, after `handleChange`:

```ts
  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const contents = await getClipboardContent(event.clipboardData);
    const source = contents.image
      ?? (contents.text && gImageMap.isImageUrl(contents.text) ? contents.text : undefined);
    if (!source) return; // not an image: let the default paste proceed

    // Suppress the default paste so a pasted url is not also inserted as text.
    event.preventDefault();
    const contentUrl = await ingestImage(source);
    if (contentUrl) updateValue(contentUrl);
  };
```

Then add `onPaste={handlePaste}` to the `TextareaAutosize` element, next to `onChange`.

Note: `event.clipboardData` must be read synchronously before the first `await`, because React pools synthetic events. `getClipboardContent` receives it as its first statement, so passing it directly as shown is safe; do not move the `await` above it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/tiles/table/cell-text-editor.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/tiles/table/cell-text-editor.tsx src/components/tiles/table/cell-text-editor.test.tsx
git commit -m "CLUE-260: paste images into table cells via the cell editor"
```

---

## Task 5: Make the selection highlight visible on image cells

**Files:**
- Modify: `src/components/tiles/table/cell-formatter.scss:26-35`

The `highlighted` class already reaches image cells. The problem is that the highlight is a
`background-color` and the `<img>` covers all but 6px of the cell, so selection is invisible on
a full-bleed image. This adds an inset outline in the same color.

- [ ] **Step 1: Add the image-cell highlight rule**

In `src/components/tiles/table/cell-formatter.scss`, replace the `&.image-cell` block with:

```scss
  &.image-cell {
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      max-height: 100%;
      max-width: 100%;
      padding: 6px;
    }

    // The image covers all but the 6px padding, so a background-color highlight is
    // effectively invisible here. Use an inset outline in the same color instead.
    &.highlighted {
      box-shadow: inset 0 0 0 3px vars.$highlight-unlinked-cell;

      &.linked {
        box-shadow: inset 0 0 0 3px vars.$highlight-linked-cell;
      }
    }
  }
```

- [ ] **Step 2: Verify the stylesheet compiles**

Run: `npx sass --load-path=src src/components/tiles/table/cell-formatter.scss /dev/null`
Expected: no output (success).

If `sass` is not available as a standalone binary in this repo, skip this step — Task 8's webpack build covers it.

- [ ] **Step 3: Commit**

```bash
git add src/components/tiles/table/cell-formatter.scss
git commit -m "CLUE-260: make cell selection visible on table image cells"
```

---

## Task 6: Route Data Cards' paste through the same helper

**Files:**
- Modify: `src/plugins/data-card/components/case-attribute.tsx:235-256`
- Test: `src/plugins/data-card/case-attribute-paste.test.tsx`

This changes Data Cards behavior: a pasted external image URL is now copied into class-scoped
storage instead of being stored raw. Existing documents are unaffected — `getImage` still
resolves raw URLs on read — so no migration is needed. Call this out in the PR description.

- [ ] **Step 1: Write the failing test**

Create `src/plugins/data-card/case-attribute-paste.test.tsx`:

```tsx
import { gImageMap } from "../../models/image-map";
import * as clipboardUtils from "../../utilities/clipboard-utils";
import * as imageIngest from "../../utilities/image-ingest";
import { handleImagePaste } from "./components/case-attribute";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";

const clipboard = (image: File | null, text: string | null) => ({ image, text, types: [] });

describe("data card image paste", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ingests a pasted image file and yields a ccimg:// value", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    jest.spyOn(clipboardUtils, "getClipboardContent").mockResolvedValue(clipboard(file, null));
    jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(kCcImgUrl);

    expect(await handleImagePaste(undefined)).toBe(kCcImgUrl);
  });

  it("ingests a pasted image url rather than storing it raw", async () => {
    const url = "https://example.com/photo.png";
    jest.spyOn(clipboardUtils, "getClipboardContent").mockResolvedValue(clipboard(null, url));
    jest.spyOn(gImageMap, "isImageUrl").mockReturnValue(true);
    const ingest = jest.spyOn(imageIngest, "ingestImage").mockResolvedValue(kCcImgUrl);

    const result = await handleImagePaste(undefined);
    expect(ingest).toHaveBeenCalledWith(url);
    expect(result).toBe(kCcImgUrl);
    expect(result).not.toBe(url);
  });

  it("returns undefined for non-image text so the default paste proceeds", async () => {
    jest.spyOn(clipboardUtils, "getClipboardContent").mockResolvedValue(clipboard(null, "hello"));
    jest.spyOn(gImageMap, "isImageUrl").mockReturnValue(false);

    expect(await handleImagePaste(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/plugins/data-card/case-attribute-paste.test.tsx`
Expected: FAIL — `handleImagePaste` is not exported from `case-attribute`.

- [ ] **Step 3: Extract and export the shared paste logic**

In `src/plugins/data-card/components/case-attribute.tsx`, add the import:

```ts
import { ingestImage } from "../../../utilities/image-ingest";
```

Add this exported function at module scope, above the component:

```ts
/**
 * Resolves clipboard contents to a persistable image value, or undefined when the clipboard
 * does not hold an image and the default paste should proceed.
 */
export async function handleImagePaste(clipboardData?: DataTransfer): Promise<string | undefined> {
  const contents = await getClipboardContent(clipboardData);
  const source = contents.image
    ?? (contents.text && gImageMap.isImageUrl(contents.text) ? contents.text : undefined);
  return source ? ingestImage(source) : undefined;
}
```

- [ ] **Step 4: Replace both paste branches with it**

Delete the existing `handlePasteImage` function (currently lines 235-242) and replace
`handleValuePaste` (currently lines 244-256) with:

```ts
  const handleValuePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const targetElement = event.currentTarget;
    const contentUrl = await handleImagePaste(event.clipboardData);
    if (contentUrl) {
      event.preventDefault();
      setValueCandidate(contentUrl);
      targetElement.blur();
    }
  };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/plugins/data-card/case-attribute-paste.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 6: Verify the data card tile tests still pass**

Run: `npx jest src/plugins/data-card`
Expected: PASS — all pre-existing data card tests unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/data-card/components/case-attribute.tsx \
        src/plugins/data-card/case-attribute-paste.test.tsx
git commit -m "CLUE-260: route data card image paste through ingestImage

Pasted external image urls were stored raw, outside class-scoped storage.
They are now ingested like any other image. Forward-only; existing
documents still resolve their raw urls on read."
```

---

## Task 7: End-to-end coverage

**Files:**
- Modify: `src/public/demo/units/qa/content.json`
- Modify: `cypress/e2e/functional/tile_tests/table_tool_spec.js`

- [ ] **Step 1: Opt the QA unit's table into the button**

In `src/public/demo/units/qa/content.json`, find `config.settings.table`, currently:

```json
"table": { "numFormat": ".2~f" },
```

Replace it with:

```json
"table": {
  "numFormat": ".2~f",
  "tools": [
    "import-data",
    "|",
    "set-expression",
    "link-tile",
    "link-graph",
    "merge-in",
    ["data-set-view", "DataCard"],
    "image-upload",
    "delete"
  ]
},
```

A unit's `tools` array **replaces** the app-config default rather than merging with it — the
merge is only two levels deep (see the comment at `configuration-manager.ts:288`), so the full
default list must be repeated here. The default list is in `src/clue/app-config.json` under
`config.settings.table.tools`; if it has changed since this plan was written, copy the current
one and append `"image-upload"` before `"delete"`.

- [ ] **Step 2: Verify the drift guard still passes**

Run: `npx jest src/components/toolbar/toolbar-config-registration.test.ts`
Expected: PASS — every name in the new list resolves to a registered button.

- [ ] **Step 3: Add the Cypress test**

Append this to `cypress/e2e/functional/tile_tests/table_tool_spec.js`, inside the
`context('Table Tool Tile', ...)` block:

```js
  it('Test image cells', function () {
    beforeTest();

    cy.log('will add a table to canvas');
    clueCanvas.addTile('table');
    tableToolTile.getTableTile().should('be.visible');

    cy.log('image upload button is disabled with no cell selected');
    clueCanvas.toolbarButtonIsDisabled('table', 'image-upload');

    cy.log('selecting a cell enables the button');
    tableToolTile.getTableCellXY(0, 1).click();
    clueCanvas.toolbarButtonIsEnabled('table', 'image-upload');

    cy.log('uploading an image puts a thumbnail in the selected cell');
    cy.get('.toolbar-button.image-upload input[type=file]')
      .selectFile('cypress/fixtures/image.png', { force: true });
    tableToolTile.getTableTile().find('.image-cell img').should('exist');

    cy.log('the image cell shows a visible selection highlight');
    tableToolTile.getTableTile().find('.image-cell')
      .should('have.class', 'highlighted')
      .and('have.css', 'box-shadow')
      .and('not.equal', 'none');
  });
```

- [ ] **Step 4: Confirm the fixture and toolbar helpers exist**

Run: `ls cypress/fixtures/image.png && grep -n "toolbarButtonIsDisabled\|toolbarButtonIsEnabled" cypress/support/elements/common/cCanvas.js`

If the fixture is missing, create one: `cp src/assets/concord.png cypress/fixtures/image.png` (any small PNG works).
If those two helpers do not exist on `ClueCanvas`, replace those assertions with direct
selectors: `cy.get('.toolbar-button.image-upload').should('have.attr', 'aria-disabled', 'true')`
and the corresponding `should('not.have.attr', 'aria-disabled')`.

- [ ] **Step 5: Run the spec**

Start the dev server in one terminal (`npm start`), then:

Run: `npx cypress run --spec 'cypress/e2e/functional/tile_tests/table_tool_spec.js' --env testEnv=local`
Expected: PASS, including the new `Test image cells` case.

`table_tool_spec.js` is already listed in `.github/workflows/manual-regression.yml:60`, so no
workflow change is needed.

- [ ] **Step 6: Commit**

```bash
git add src/public/demo/units/qa/content.json cypress/e2e/functional/tile_tests/table_tool_spec.js cypress/fixtures/
git commit -m "CLUE-260: e2e coverage for table image cells"
```

---

## Task 8: Full verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: PASS. Pay attention to `src/models/image-map.test.ts`, `src/utilities/clipboard-utils.test.ts`, and `src/plugins/data-card/` — those touch the code paths this ticket changed.

- [ ] **Step 2: Type check**

Run: `npm run check:types`
Expected: no errors.

- [ ] **Step 3: Lint with the stricter build config**

Run: `npm run lint:build`
Expected: no errors. This flags unnecessarily disabled rules, so run it rather than plain `npm run lint` before finishing.

- [ ] **Step 4: Confirm the storage invariant one more time**

Run: `npx jest src/utilities/image-ingest.test.ts -t "never returns the ephemeral displayUrl"`
Expected: PASS. This is the guard against the single worst regression in this ticket — a cell holding a `blob:` URL looks correct locally and is dead for everyone else.

- [ ] **Step 5: Manual check in the running app**

Start the app (`npm start`) and open a QA unit table:
`http://localhost:8080/?appMode=qa&unit=qa&problem=1.1`

Verify by hand:
1. The image upload button is greyed until a cell is selected.
2. Uploading puts a thumbnail in the selected cell and the row grows.
3. Ctrl-V of a copied image into an open cell editor does the same.
4. `TableIt!`-style linking still works: use the DataCard view button, confirm the image appears in the card.
5. Selecting a case in the linked card highlights the table row, and the image cell's highlight is visible.
6. Reload the page — images still render (this is what proves `contentUrl` and not `displayUrl` was stored).

Step 6 is the one that cannot be skipped. A `blob:` URL survives in-session and only fails after reload.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "CLUE-260: fixes from full verification pass"
```

---

## Out of scope

- **Image encoding and lazy loading** — tracked in CLUE-699. Do not change `canvas.toDataURL()` or `lookupImage` fetching here.
- **`pasteClipboardImage` consolidation** — the Drawing, Image and Geometry tiles keep their own paste helper with its curriculum-URL-only policy. Folding them in would change three mature tiles and rewrite `clipboard-utils.test.ts:49-105`.
- **Orphaned image cleanup** — there is no deletion path in the codebase; clearing an image cell leaves the blob in the class node. Pre-existing across all tiles.
