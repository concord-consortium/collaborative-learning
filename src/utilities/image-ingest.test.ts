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
