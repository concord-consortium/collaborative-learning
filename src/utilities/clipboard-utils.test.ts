import { EntryStatus, gImageMap } from "../models/image-map";
import { getClipboardContent, pasteClipboardImage } from "./clipboard-utils";

describe("getClipboardContent", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  it("returns null values when the clipboard is empty", async () => {
    Object.assign(navigator, {
      clipboard: {
        read: () => { return []; }
      },
    });
    jest.spyOn(navigator.clipboard, "read");
    const clipboardContent = await getClipboardContent();
    expect(clipboardContent.image).toBe(null);
    expect(clipboardContent.text).toBe(null);
  });
  it("returns a text item when the clipboard contains a text item", async () => {
    const mockBlob = {
      arrayBuffer: jest.fn(),
      size: 1024,
      text: jest.fn().mockResolvedValue("test"),
      type: "text/plain",
      slice: jest.fn(),
      stream: jest.fn()
    };
    const mockReturnValue = {
      types: ["text/plain"], getType: jest.fn().mockResolvedValue(mockBlob)
    };
    jest.spyOn(navigator.clipboard, "read").mockResolvedValue([mockReturnValue]);
    jest.spyOn(global, "Blob").mockImplementation(() => mockBlob);
    const clipboardContent = await getClipboardContent();
    expect(clipboardContent.image).toBe(null);
    expect(clipboardContent.text).not.toBe(null);
  });
  it("returns an image item when the clipboard contains an image item", async () => {
    const mockReturnValue = {
      types: ["image/png"], getType: jest.fn()
    };
    jest.spyOn(navigator.clipboard, "read").mockResolvedValue([mockReturnValue]);
    const clipboardContent = await getClipboardContent();
    expect(clipboardContent.image).not.toBe(null);
    expect(clipboardContent.text).toBe(null);
  });
});

describe("pasteClipboardImage", () => {
  it ("calls addFileImage when the clipboard contains an image item", () => {
    const image = { image: "test.png" };
    const mockImageResponse = {
      contentUrl: "test/test.png",
      displayUrl: "https://example.com/test/test.png",
      filename: "test.png",
      height: 100,
      retries: 0,
      status: EntryStatus.Ready,
      width: 100
    };
    const onComplete = jest.fn();
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(mockImageResponse);
    pasteClipboardImage(image, onComplete);
    expect(gImageMap.addFileImage).toHaveBeenCalled();
  });
  it ("calls getImage when the clipboard contains a text item", () => {
    const image = { text: "curriculum/test/images/test.png" };
    const mockImageResponse = {
      contentUrl: "test/test.png",
      displayUrl: "https://example.com/test/test.png",
      filename: "test.png",
      height: 100,
      retries: 0,
      status: EntryStatus.Ready,
      width: 100
    };
    const onComplete = jest.fn();
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(mockImageResponse);
    pasteClipboardImage(image, onComplete);
    expect(gImageMap.getImage).toHaveBeenCalled();
  });
});
