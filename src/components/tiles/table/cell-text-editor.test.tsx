import { render, screen } from "@testing-library/react";
import React from "react";
import { gImageMap } from "../../../models/image-map";
import {
  errorEntry, kCcImgUrl, kImageUrlText, makeClipboardData, mockFile, pasteAndFlush, readyEntry
} from "../../../test/clipboard-image-test-utils";
import CellTextEditor from "./cell-text-editor";

const renderEditor = (
  onRowChange: (row: any, commit?: boolean) => void = jest.fn(),
  onClose: (commitChanges?: boolean, shouldFocusCell?: boolean) => void = jest.fn()
) => {
  const row = { __id__: "case1", attr1: "" } as any;
  const column = { key: "attr1", width: 100, appData: {} } as any;
  render(
    <CellTextEditor row={row} column={column} onRowChange={onRowChange} onClose={onClose} />
  );
  return onRowChange;
};

const pasteTextbox = (clipboardData: unknown) => pasteAndFlush(screen.getByRole("textbox"), clipboardData);

describe("CellTextEditor paste handling", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ingests a pasted image file, stores the ccimg:// url as the cell value, and commits", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl) as any);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ image: mockFile() });

    await pasteTextbox(clipboardData);
    // Committed in one call. Splitting it into onRowChange(row, false) + onClose(true) is what
    // dropped the pasted value: rdg's onClose delegates to onRowChange with the row it already
    // holds, which is still the pre-paste row within a single tick.
    expect(onRowChange).toHaveBeenCalledWith(
      expect.objectContaining({ attr1: kCcImgUrl }),
      true
    );
  });

  it("ingests a pasted image url, stores the ccimg:// url (not the raw url), and commits", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl) as any);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ text: kImageUrlText });

    await pasteTextbox(clipboardData);
    expect(onRowChange).toHaveBeenCalledWith(
      expect.objectContaining({ attr1: kCcImgUrl }),
      true
    );
    expect(onRowChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ attr1: kImageUrlText }),
      expect.anything()
    );
  });

  it("leaves plain text pastes alone: no ingestClipboardImage call, default paste not suppressed", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl) as any);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ text: "just some plain text" });

    const notPrevented = await pasteTextbox(clipboardData);

    expect(notPrevented).toBe(true);
    expect(onRowChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not change the cell value or commit when the image cannot be stored", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(errorEntry());
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(errorEntry() as any);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ image: mockFile() });

    await pasteTextbox(clipboardData);
    expect(onRowChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
