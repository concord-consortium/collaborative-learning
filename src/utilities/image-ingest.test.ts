import { gImageMap, ImageMapEntry, EntryStatus } from "../models/image-map";
import {
  errorEntry, kCcImgUrl, kImageUrlText, makeClipboardData, mockFile, readyEntry
} from "../test/clipboard-image-test-utils";
import { clipboardHasImage, ingestClipboardImage, ingestImage } from "./image-ingest";

describe("ingestImage", () => {
  afterEach(() => jest.restoreAllMocks());

  it("stores a File via addFileImage and returns the ccimg:// contentUrl", async () => {
    const spy = jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const file = mockFile();
    const result = await ingestImage(file);
    expect(spy).toHaveBeenCalledWith(file);
    expect(result).toBe(kCcImgUrl);
  });

  it("never returns the ephemeral displayUrl", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const result = await ingestImage(mockFile());
    expect(result).not.toMatch(/^blob:/);
  });

  it("ingests an external image URL via getImage and returns the ccimg:// contentUrl", async () => {
    const spy = jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl));
    const result = await ingestImage(kImageUrlText);
    expect(spy).toHaveBeenCalledWith(kImageUrlText);
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

  it("warns but still returns the value when CORS forced a fallback to the original http(s) url", async () => {
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kImageUrlText));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await ingestImage(kImageUrlText);
    expect(result).toBe(kImageUrlText);
    expect(warn).toHaveBeenCalled();
  });

  it("warns and returns undefined when storage was unavailable and the fallback is a data: url", async () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(dataUri));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await ingestImage(dataUri);
    expect(result).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("returns undefined when storing throws", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockRejectedValue(new Error("Error loading image: bad.png"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await ingestImage(mockFile())).toBeUndefined();
  });

  it("returns undefined for a string no handler can resolve", async () => {
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(
      ImageMapEntry.create({ displayUrl: "", retries: 0, status: EntryStatus.Ready }));
    expect(await ingestImage("not a url")).toBeUndefined();
  });
});

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
});
