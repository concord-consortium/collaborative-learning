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
  const onComplete = jest.fn();
  const mockConsoleError = jest.fn();
  const mockImageResponse = {
    contentUrl: "test/test.png",
    displayUrl: "https://example.com/test/test.png",
    filename: "test.png",
    height: 100,
    retries: 0,
    status: EntryStatus.Ready,
    width: 100
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(mockConsoleError);
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(mockImageResponse);
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(mockImageResponse);
  });

  it ("does not call addFileImage or getImage when the clipboard does not contain an image or text item", () => {
    pasteClipboardImage({image: null, text: null}, onComplete);
    expect(gImageMap.addFileImage).not.toHaveBeenCalled();
    expect(gImageMap.getImage).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith("ERROR: unknown clipboard content type");
  });
  it ("calls addFileImage when the clipboard contains an image item", () => {
    const image = { image: "test.png" };
    pasteClipboardImage(image, onComplete);
    expect(gImageMap.addFileImage).toHaveBeenCalled();
  });
  it ("calls getImage when the clipboard contains a text item with a valid value", () => {
    const image = { text: "curriculum/test/images/test.png" };
    pasteClipboardImage(image, onComplete);
    expect(gImageMap.getImage).toHaveBeenCalled();
  });
  it ("does not call getImage when the clipboard contains a text item with an invalid value", () => {
    const image = { text: "not-a-valid-url-value" };
    pasteClipboardImage(image, onComplete);
    expect(gImageMap.getImage).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith("ERROR: invalid image URL");
  });
});
