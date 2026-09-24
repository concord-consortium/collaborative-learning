import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import * as imageIngest from "../../../utilities/image-ingest";
import CellTextEditor from "./cell-text-editor";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";
const kImageUrlText = "https://example.com/photo.png";

const mockFile = () => new File(["x"], "photo.png", { type: "image/png" });

// A minimal fake of the DataTransfer shape read by clipboardHasImage()'s synchronous checks.
// ingestClipboardImage() itself is mocked below, so its own clipboardData reads never run.
const makeClipboardData = (opts: { image?: File; text?: string }) => {
  const items: Array<{ type: string; getAsFile: () => File | null }> = [];
  if (opts.image) items.push({ type: "image/png", getAsFile: () => opts.image! });
  if (opts.text !== undefined) items.push({ type: "text/plain", getAsFile: () => null });
  return {
    items,
    types: items.map(item => item.type),
    getData: (format: string) => (format === "text/plain" ? opts.text ?? "" : "")
  };
};

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

// Lets the microtasks chained inside the (async) paste handler settle before we assert.
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Returns fireEvent.paste's result: false only if the handler called preventDefault().
const pasteAndFlush = async (clipboardData: unknown) => {
  let notPrevented = false;
  await act(async () => {
    notPrevented = fireEvent.paste(screen.getByRole("textbox"), { clipboardData });
    await flushPromises();
  });
  return notPrevented;
};

describe("CellTextEditor paste handling", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ingests a pasted image file, stores the ccimg:// url as the cell value, and commits", async () => {
    const ingest = jest.spyOn(imageIngest, "ingestClipboardImage").mockResolvedValue(kCcImgUrl);
    const onClose = jest.fn();
    const onRowChange = renderEditor(jest.fn(), onClose);
    const clipboardData = makeClipboardData({ image: mockFile() });

    await pasteAndFlush(clipboardData);

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

    await pasteAndFlush(clipboardData);

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

    const notPrevented = await pasteAndFlush(clipboardData);

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

    await pasteAndFlush(clipboardData);

    expect(ingest).toHaveBeenCalled();
    expect(onRowChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
