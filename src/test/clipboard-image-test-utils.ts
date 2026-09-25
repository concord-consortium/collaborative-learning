import { act, fireEvent } from "@testing-library/react";
import { EntryStatus, ImageMapEntry } from "../models/image-map";

export const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";
export const kImageUrlText = "https://example.com/photo.png";

export const mockFile = () => new File(["x"], "photo.png", { type: "image/png" });

export const readyEntry = (contentUrl: string) => ImageMapEntry.create({
  contentUrl,
  displayUrl: "blob:http://localhost/abc-123",
  filename: "test.png",
  height: 100,
  retries: 0,
  status: EntryStatus.Ready,
  width: 100
});

export const errorEntry = () => ImageMapEntry.create({
  displayUrl: "",
  retries: 0,
  status: EntryStatus.Error
});

// A minimal fake of the DataTransfer shape read by clipboardHasImage()'s synchronous checks
// and ingestClipboardImage()'s async ones.
export const makeClipboardData = (opts: { image?: File; text?: string; imageType?: string }) => {
  const items: Array<{ type: string; getAsFile: () => File | null }> = [];
  if (opts.image) items.push({ type: opts.imageType ?? "image/png", getAsFile: () => opts.image! });
  if (opts.text !== undefined) items.push({ type: "text/plain", getAsFile: () => null });
  return {
    items,
    types: items.map(item => item.type),
    getData: (format: string) => (format === "text/plain" ? opts.text ?? "" : "")
  } as unknown as DataTransfer;
};

// Lets the microtasks chained inside the (async) paste handler settle before we assert.
export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Fires a paste on `element` and flushes the async ingest chain. Returns fireEvent.paste's
// result: false only if the handler called preventDefault().
export const pasteAndFlush = async (element: Element, clipboardData: unknown) => {
  let notPrevented = false;
  await act(async () => {
    notPrevented = fireEvent.paste(element, { clipboardData });
    await flushPromises();
  });
  return notPrevented;
};
