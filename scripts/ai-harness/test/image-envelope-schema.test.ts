import { validateImageEnvelope, validateRenderTarget } from "../src/schemas.js";

const file = "drawing.json";

const renderTarget = {
  clueUrl: "http://localhost:8080",
  unit: "http://127.0.0.1:5000/content.json",
  clueRevision: "9b53df828 (dirty)",
  shutterbugUrl: null,
  viewportWidthPx: 960,
  captureMode: "full-document",
  captureHeightPx: null
};

const image = {
  file: "drawing-1.png",
  sha256: "a".repeat(64),
  mimeType: "image/png",
  widthPx: 960,
  heightPx: 1420,
  bytes: 512345,
  url: null,
  tileId: null,
  purpose: "full-document"
};

const envelope = {
  schemaVersion: 1,
  docId: "drawing",
  kind: "image",
  modeId: "puppeteer-full-height",
  backendId: "puppeteer",
  backendVersion: 1,
  renderTarget,
  sourceContentSha256: "b".repeat(64),
  generatedAt: "2026-08-13T00:00:00.000Z",
  images: [image]
};

describe("the image envelope", () => {
  it("validates a complete envelope", () => {
    expect(validateImageEnvelope(envelope, file)).toEqual(envelope);
  });

  it("accepts more than one image, so per-tile capture is additive rather than a format change", () => {
    const many = {
      ...envelope,
      images: [image, { ...image, file: "drawing-2.png", tileId: "tile-1", purpose: "tile" }]
    };
    expect(validateImageEnvelope(many, file).images).toHaveLength(2);
  });

  it("rejects an envelope that is not an image representation", () => {
    expect(() => validateImageEnvelope({ ...envelope, kind: "text" }, file))
      .toThrow(/kind must be "image"/);
  });

  it.each([
    ["docId", undefined, /docId must be a string/],
    ["modeId", 3, /modeId must be a string/],
    ["backendId", null, /backendId must be a string/],
    ["backendVersion", 0, /backendVersion must be a positive integer/],
    ["sourceContentSha256", undefined, /sourceContentSha256 must be a string/],
    ["images", {}, /images must be an array/]
  ])("rejects a malformed %s", (field, value, pattern) => {
    expect(() => validateImageEnvelope({ ...envelope, [field]: value }, file)).toThrow(pattern);
  });

  it.each([
    ["file", "../escaped.png", /must be a bare filename/],
    ["file", "nested/shot.png", /must be a bare filename/],
    ["sha256", "not-a-hash", /must be a 64-character hex sha256/],
    ["widthPx", 0, /widthPx must be a positive integer/],
    ["heightPx", 1420.5, /heightPx must be a positive integer/],
    ["bytes", -1, /bytes must be a positive integer/],
    ["purpose", "thumbnail", /purpose must be one of full-document, tile/]
  ])("rejects a malformed image %s", (field, value, pattern) => {
    expect(() => validateImageEnvelope({ ...envelope, images: [{ ...image, [field]: value }] }, file))
      .toThrow(pattern);
  });

  it("accepts a hosted url on a public https host", () => {
    const hosted = { ...image, url: "https://ccshutterbug.s3.us-east-1.amazonaws.com/1787003194685.png" };
    expect(validateImageEnvelope({ ...envelope, images: [hosted] }, file).images[0].url)
      .toBe(hosted.url);
  });

  // `run` fetches this URL before dispatching anything, to check the hosted picture is still the one
  // that was evaluated. Refusing it here means a hand-edited envelope cannot make the harness issue
  // that request at all, so there is nothing to intercept downstream. `redirectDowngradeReason` does
  // not cover these: it asks whether a request ended up somewhere worse than it started, and none of
  // these started anywhere safe.
  it.each([
    ["loopback over plain http", "http://127.0.0.1:8080/shot.png"],
    ["localhost by name", "http://localhost:8080/shot.png"],
    ["the cloud metadata address", "http://169.254.169.254/latest/meta-data/"],
    ["a private address, even over https", "https://10.0.0.5/shot.png"],
    ["a public host over plain http", "http://images.example.test/shot.png"],
    ["something that is not a URL at all", "shot.png"]
  ])("rejects a hosted url on %s", (_description, url) => {
    expect(() => validateImageEnvelope({ ...envelope, images: [{ ...image, url }] }, file))
      .toThrow(/url must be a public https URL/);
  });

  it("still accepts a local capture, which has no url", () => {
    expect(validateImageEnvelope(envelope, file).images[0].url).toBeNull();
  });

  it("rejects the same filename listed twice", () => {
    // Two entries writing the same file would leave one of them describing bytes that are not there.
    expect(() => validateImageEnvelope({ ...envelope, images: [image, image] }, file))
      .toThrow(/lists the file "drawing-1.png" more than once/);
  });
});

describe("the render target", () => {
  it("validates a full-document target", () => {
    expect(validateRenderTarget(renderTarget, file, "renderTarget")).toEqual(renderTarget);
  });

  it("validates a fixed-height target", () => {
    const clipped = { ...renderTarget, captureMode: "fixed-height", captureHeightPx: 1500 };
    expect(validateRenderTarget(clipped, file, "renderTarget").captureHeightPx).toBe(1500);
  });

  it("requires a clip height on a fixed-height capture", () => {
    // A clipped capture that forgot to record how far it clipped would compare equal to a target
    // that means something else entirely.
    expect(() => validateRenderTarget({ ...renderTarget, captureMode: "fixed-height" }, file, "renderTarget"))
      .toThrow(/captureHeightPx is required when captureMode is "fixed-height"/);
  });

  it("refuses a clip height on a full-document capture", () => {
    expect(() => validateRenderTarget({ ...renderTarget, captureHeightPx: 1500 }, file, "renderTarget"))
      .toThrow(/captureHeightPx must be null when captureMode is "full-document"/);
  });

  it("allows an unknown revision, because a hosted build may not have one", () => {
    expect(validateRenderTarget({ ...renderTarget, clueRevision: null }, file, "renderTarget").clueRevision)
      .toBeNull();
  });

  it.each([
    ["clueUrl", 8080, /clueUrl must be a string/],
    ["unit", undefined, /unit must be a string/],
    ["viewportWidthPx", 0, /viewportWidthPx must be a positive integer/],
    ["captureMode", "tile", /captureMode must be one of full-document, fixed-height/]
  ])("rejects a malformed %s", (field, value, pattern) => {
    expect(() => validateRenderTarget({ ...renderTarget, [field]: value }, file, "renderTarget"))
      .toThrow(pattern);
  });
});
