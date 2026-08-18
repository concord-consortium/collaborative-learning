import { NotAPngError, readPngInfo } from "../src/png.js";
import { makeTestPng } from "./helpers.js";

describe("reading a PNG header", () => {
  it("reads width and height out of the IHDR chunk", () => {
    expect(readPngInfo(makeTestPng(960, 1420), "test")).toEqual({ widthPx: 960, heightPx: 1420 });
  });

  it("reads a one-pixel image", () => {
    const info = readPngInfo(makeTestPng(1, 1), "test");
    expect([info.widthPx, info.heightPx]).toEqual([1, 1]);
  });

  it("refuses bytes that are not a PNG", () => {
    // A `.png` suffix is not evidence of PNG bytes: a Shutterbug URL can serve an HTML error page.
    const html = Buffer.from("<!doctype html><html><body>503 Service Unavailable</body></html>");
    expect(() => readPngInfo(html, "https://example.test/image.png"))
      .toThrow(/https:\/\/example\.test\/image\.png is not a usable PNG/);
    expect(() => readPngInfo(html, "x")).toThrow(NotAPngError);
  });

  it("refuses a JPEG", () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)]);
    expect(() => readPngInfo(jpeg, "photo.jpg")).toThrow(/not the PNG signature/);
  });

  it("refuses a file that has a valid header but no image after it", () => {
    // Signature plus IHDR and nothing else: the shape a truncated download takes. Accepting it
    // meant storing it and eventually sending it to the model.
    const headerOnly = makeTestPng(64, 64).subarray(0, 8 + 12 + 13);
    expect(() => readPngInfo(headerOnly, "truncated.png"))
      .toThrow(/chunk stream does not end with a complete IEND chunk/);
  });

  it("refuses a PNG whose trailing chunks were cut off", () => {
    const whole = makeTestPng(64, 64);
    expect(() => readPngInfo(whole.subarray(0, whole.length - 20), "cut.png"))
      .toThrow(/truncated or is not a whole PNG/);
    // The whole file still reads.
    expect(readPngInfo(whole, "whole.png")).toEqual({ widthPx: 64, heightPx: 64 });
  });

  it("refuses a file truncated before its header is complete", () => {
    expect(() => readPngInfo(makeTestPng(10, 10).subarray(0, 12), "truncated.png"))
      .toThrow(/only 12 byte\(s\) long/);
  });

  it("refuses a PNG whose first chunk is not IHDR", () => {
    const png = makeTestPng(4, 4);
    png.write("IDAT", 12, "latin1");
    expect(() => readPngInfo(png, "odd.png")).toThrow(/first chunk is "IDAT"/);
  });

  it("refuses a zero dimension", () => {
    const png = makeTestPng(4, 4);
    png.writeUInt32BE(0, 20);
    expect(() => readPngInfo(png, "flat.png")).toThrow(/reports a 4×0 image/);
  });

});
