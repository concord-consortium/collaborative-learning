import { render, screen } from "@testing-library/react";
import React from "react";
import * as imageIngest from "../../../utilities/image-ingest";
import {
  kCcImgUrl, kImageUrlText, makeClipboardData, mockFile, pasteAndFlush
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
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ image: mockFile() });

    await pasteTextbox(clipboardData);

    expect(ingest).toHaveBeenCalledWith(clipboardData);
    expect(onRowChange).toHaveBeenCalledWith(
      expect.objectContaining({ attr1: kCcImgUrl }),
      false
    );
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("ingests a pasted image url, stores the ccimg:// url (not the raw url), and commits", async () => {
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ text: kImageUrlText });

    await pasteTextbox(clipboardData);

    expect(ingest).toHaveBeenCalledWith(clipboardData);
    expect(onRowChange).toHaveBeenCalledWith(
      expect.objectContaining({ attr1: kCcImgUrl }),
      false
    );
    expect(onRowChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ attr1: kImageUrlText }),
      false
    );
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("leaves plain text pastes alone: no ingestClipboardImage call, default paste not suppressed", async () => {
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ text: "just some plain text" });

    const notPrevented = await pasteTextbox(clipboardData);

    expect(notPrevented).toBe(true);
    expect(ingest).not.toHaveBeenCalled();
    expect(onRowChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not change the cell value or commit when ingestClipboardImage fails to store the image", async () => {
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(undefined);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ image: mockFile() });

    await pasteTextbox(clipboardData);

    expect(ingest).toHaveBeenCalled();
    expect(onRowChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
