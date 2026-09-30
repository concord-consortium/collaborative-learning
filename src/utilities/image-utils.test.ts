import { toCompactDataUrl } from "./image-utils";

// jest-canvas-mock gives us a real-enough 2d context; each test controls what getImageData
// reports so we can drive the opaque/transparent branches.
function makeCanvas(alphaFor: (i: number) => number, width = 4, height = 4) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let px = 0; px < width * height; px++) {
    data[px * 4 + 3] = alphaFor(px);
  }
  jest.spyOn(context, "getImageData").mockReturnValue({ data } as ImageData);
  return { canvas, context };
}

describe("toCompactDataUrl", () => {
  afterEach(() => jest.restoreAllMocks());

  it("encodes a fully opaque image as jpeg", () => {
    const { canvas } = makeCanvas(() => 255);
    const toDataURL = jest.spyOn(canvas, "toDataURL").mockReturnValue("data:image/jpeg;base64,x");

    toCompactDataUrl(canvas);

    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", expect.any(Number));
  });

  it("keeps png when any pixel is transparent, since jpeg has no alpha channel", () => {
    const { canvas } = makeCanvas(px => (px === 5 ? 0 : 255));
    const toDataURL = jest.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,x");

    toCompactDataUrl(canvas);

    expect(toDataURL).toHaveBeenCalledWith();
  });

  it("keeps png for partial transparency, not just fully transparent pixels", () => {
    const { canvas } = makeCanvas(px => (px === 2 ? 128 : 255));
    const toDataURL = jest.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,x");

    toCompactDataUrl(canvas);

    expect(toDataURL).toHaveBeenCalledWith();
  });

  it("falls back to png when the canvas cannot be inspected", () => {
    const { canvas, context } = makeCanvas(() => 255);
    jest.spyOn(context, "getImageData").mockImplementation(() => {
      throw new Error("SecurityError: tainted canvas");
    });
    const toDataURL = jest.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,x");

    toCompactDataUrl(canvas);

    expect(toDataURL).toHaveBeenCalledWith();
  });
});
