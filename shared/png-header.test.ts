import { readPngDimensions } from "./png-header";
import { pngHeaderBytes as pngHeader } from "./png-header-test-helpers";

describe("readPngDimensions", () => {
  it("reads width and height from a hand-built header", () => {
    expect(readPngDimensions(pngHeader(960, 3668))).toEqual({ widthPx: 960, heightPx: 3668 });
  });

  it("reads a height at the frame ceiling", () => {
    expect(readPngDimensions(pngHeader(960, 4000))).toEqual({ widthPx: 960, heightPx: 4000 });
  });

  it("rejects a wrong signature", () => {
    const bytes = pngHeader(960, 1500);
    bytes[0] = 0x00;
    expect(() => readPngDimensions(bytes)).toThrow(/does not start with the PNG signature/);
  });

  it("rejects a chunk that is not IHDR", () => {
    const bytes = pngHeader(960, 1500);
    bytes.set([0x49, 0x44, 0x41, 0x54], 12); // "IDAT"
    expect(() => readPngDimensions(bytes)).toThrow(/first chunk is "IDAT", not IHDR/);
  });

  it("rejects too few bytes", () => {
    expect(() => readPngDimensions(pngHeader(960, 1500).slice(0, 20)))
      .toThrow(/got only 20 byte\(s\), need at least 24/);
  });
});
