import { EntryStatus, gImageMap, ImageMapEntry } from "../models/image-map";
import { clipboardHasImage, ingestClipboardImage } from "./image-ingest";

const kCcImgUrl = "ccimg://fbrtdb.concord.org/classhash123/imagekey456";
const kImageUrlText = "https://example.com/photo.png";

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

const makeClipboardData = (opts: { image?: File; text?: string }) => {
  const items: Array<{ type: string; getAsFile: () => File | null }> = [];
  if (opts.image) items.push({ type: "image/png", getAsFile: () => opts.image! });
  if (opts.text !== undefined) items.push({ type: "text/plain", getAsFile: () => null });
  return {
    items,
    types: items.map(item => item.type),
    getData: (format: string) => (format === "text/plain" ? opts.text ?? "" : "")
  } as unknown as DataTransfer;
};

describe("clipboardHasImage", () => {
  it("is true when the clipboard carries an image/png item", () => {
    expect(clipboardHasImage(makeClipboardData({ image: mockFile() }))).toBe(true);
  });

  it("is true when the clipboard carries text that is an image url", () => {
    expect(clipboardHasImage(makeClipboardData({ text: kImageUrlText }))).toBe(true);
  });

  it("is false for plain text", () => {
    expect(clipboardHasImage(makeClipboardData({ text: "just some plain text" }))).toBe(false);
  });

  it("is false for an empty clipboard", () => {
    expect(clipboardHasImage(makeClipboardData({}))).toBe(false);
  });
});

describe("ingestClipboardImage", () => {
  afterEach(() => jest.restoreAllMocks());

  it("stores a pasted image file and resolves to its ccimg:// url", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const result = await ingestClipboardImage(makeClipboardData({ image: mockFile() }));
    expect(result).toBe(kCcImgUrl);
  });

  it("stores a pasted image url and resolves to its ccimg:// url, not the raw url", async () => {
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const result = await ingestClipboardImage(makeClipboardData({ text: kImageUrlText }));
    expect(result).toBe(kCcImgUrl);
    expect(result).not.toBe(kImageUrlText);
  });

  it("resolves to undefined for plain text: nothing is ingested", async () => {
    const addFileImage = jest.spyOn(gImageMap, "addFileImage");
    const getImage = jest.spyOn(gImageMap, "getImage");
    const result = await ingestClipboardImage(makeClipboardData({ text: "just some plain text" }));
    expect(result).toBeUndefined();
    expect(addFileImage).not.toHaveBeenCalled();
    expect(getImage).not.toHaveBeenCalled();
  });

  it("resolves to undefined when storing the image fails", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(errorEntry());
    const result = await ingestClipboardImage(makeClipboardData({ image: mockFile() }));
    expect(result).toBeUndefined();
  });
});
