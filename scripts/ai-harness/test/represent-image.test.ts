import fs from "node:fs";
import path from "node:path";
import { corpusPaths } from "../src/corpus.js";
import {
  imageRepresentationDir, imageRepresentationFreshness, imageRepresentationPath, readImageEnvelope,
  imagesForSet, removeImageRepresentation, renderErrorDir, resolveImageFile, sha256Bytes,
  writeImageRepresentation
} from "../src/represent-image.js";
import { ImageEnvelope, RenderTarget, validateImageEnvelope } from "../src/schemas.js";
import { makeTestDataRoot, makeTestPng } from "./helpers.js";

const dataRoot = makeTestDataRoot("represent-image");
const paths = corpusPaths(dataRoot, "image-corpus");

const renderTarget: RenderTarget = {
  clueUrl: "http://localhost:8080",
  unit: "http://127.0.0.1:5000/content.json",
  clueRevision: "9b53df828 (dirty)",
  shutterbugUrl: null,
  viewportWidthPx: 960,
  captureMode: "full-document",
  captureHeightPx: null
};

const identity = {
  docId: "drawing-only",
  modeId: "puppeteer-full-height",
  backendId: "puppeteer",
  backendVersion: 1,
  contentSha256: "f".repeat(64),
  renderTarget
};

function writeOne(docId = "drawing-only", overrides: Partial<typeof identity> = {}) {
  const merged = { ...identity, ...overrides, docId };
  const envelopeFile = imageRepresentationPath(paths, merged.modeId, docId);
  const bytes = makeTestPng(960, 1420);
  const envelope = writeImageRepresentation({
    envelopeFile,
    docId,
    modeId: merged.modeId,
    backendId: merged.backendId,
    backendVersion: merged.backendVersion,
    renderTarget: merged.renderTarget,
    sourceContentSha256: merged.contentSha256,
    generatedAt: "2026-08-13T00:00:00.000Z",
    images: [{ bytes, url: null, tileId: null, purpose: "full-document" }]
  });
  return { envelopeFile, envelope, bytes, identity: merged };
}

describe("where image representations live", () => {
  it("files them by mode, so two Shutterbug modes do not overwrite each other", () => {
    expect(imageRepresentationDir(paths, "shutterbug-production-current"))
      .not.toBe(imageRepresentationDir(paths, "shutterbug-parameterized"));
    expect(imageRepresentationPath(paths, "puppeteer-full-height", "drawing"))
      .toBe(path.join(paths.representations, "image-puppeteer-full-height", "drawing.json"));
  });

  it("keeps render errors out of the representations tree", () => {
    expect(renderErrorDir(paths, "puppeteer-full-height", "drawing"))
      .toBe(path.join(paths.root, "render-errors", "puppeteer-full-height", "drawing"));
  });
});

describe("writing an image representation", () => {
  it("writes the PNG beside the envelope and records what it wrote", () => {
    const { envelopeFile, envelope, bytes } = writeOne("written");
    const image = envelope.images[0];
    expect(image).toEqual({
      file: "written-1.png",
      sha256: sha256Bytes(bytes),
      mimeType: "image/png",
      widthPx: 960,
      heightPx: 1420,
      bytes: bytes.length,
      url: null,
      tileId: null,
      purpose: "full-document"
    });
    expect(fs.readFileSync(resolveImageFile(envelopeFile, image))).toEqual(bytes);
    expect(readImageEnvelope(envelopeFile)).toEqual(envelope);
  });

  it("refuses bytes that are not a PNG, before anything is committed", () => {
    const envelopeFile = imageRepresentationPath(paths, "puppeteer-full-height", "not-a-png");
    expect(() => writeImageRepresentation({
      envelopeFile,
      docId: "not-a-png",
      modeId: "puppeteer-full-height",
      backendId: "puppeteer",
      backendVersion: 1,
      renderTarget,
      sourceContentSha256: identity.contentSha256,
      generatedAt: "2026-08-13T00:00:00.000Z",
      images: [{ bytes: Buffer.from("<html>503</html>"), url: null, tileId: null, purpose: "full-document" }]
    })).toThrow(/is not a usable PNG/);
    // Neither the envelope nor a half-written image: the decode happens before anything is stored,
    // so a backend that handed back an HTML error body leaves no trace to be mistaken for a render.
    expect(fs.existsSync(envelopeFile)).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(envelopeFile), "not-a-png-1.png"))).toBe(false);
  });

  it("removes PNGs an earlier render left behind for the same document", () => {
    // Filenames come from the image index, so a render producing fewer images than the one before
    // would strand the surplus — unreferenced by the envelope, and so invisible to --prune. Those
    // are rendered student documents, and they would survive pruning.
    const { envelopeFile } = writeOne("shrinking");
    const directory = path.dirname(envelopeFile);
    const orphan = path.join(directory, "shrinking-2.png");
    fs.writeFileSync(orphan, makeTestPng(100, 100));
    writeOne("shrinking");
    expect(fs.existsSync(orphan)).toBe(false);
  });

  it("does not delete another document's PNG whose id shares a prefix", () => {
    // Document ids may contain hyphens, so a `startsWith(`${docId}-`)` test made writing `a` treat
    // `a-b-1.png` — document `a-b`'s picture — as its own orphan and delete it.
    const { envelopeFile: neighbour } = writeOne("aa-bb");
    const victim = resolveImageFile(neighbour, readImageEnvelope(neighbour).images[0]);
    expect(fs.existsSync(victim)).toBe(true);
    writeOne("aa");
    expect(fs.existsSync(victim)).toBe(true);
  });

  it("leaves nothing behind but the envelope and its picture", () => {
    // The whole listing rather than a `.tmp` filter: the filter was coupled to `files.ts`'s naming
    // with nothing anchoring the two, so a differently named temporary file — a dot-prefixed one,
    // say — would empty it and the assertion would pass having checked nothing.
    const directory = path.join(dataRoot, "tidy-only");
    fs.mkdirSync(directory, { recursive: true });
    const envelopeFile = path.join(directory, "tidy.json");
    writeImageRepresentation({
      envelopeFile,
      docId: "tidy",
      modeId: "puppeteer-full-height",
      backendId: "puppeteer",
      backendVersion: 2,
      renderTarget,
      sourceContentSha256: "0".repeat(64),
      generatedAt: "2026-08-13T00:00:00.000Z",
      images: [{ bytes: makeTestPng(60, 80), url: null, tileId: null, purpose: "full-document" }]
    });
    expect(fs.readdirSync(directory).sort()).toEqual(["tidy-1.png", "tidy.json"]);
  });
});

describe("freshness", () => {
  it("reuses an envelope that matches on everything", () => {
    const { envelopeFile, envelope, identity: expected } = writeOne("fresh");
    expect(imageRepresentationFreshness(envelope, expected, envelopeFile))
      .toEqual({ fresh: true, reasons: [] });
  });

  it.each([
    ["docId", { docId: "someone-else" }, /docId is "fresh-mismatch", expected "someone-else"/],
    ["modeId", { modeId: "shutterbug-parameterized" }, /modeId is "puppeteer-full-height"/],
    ["backendId", { backendId: "shutterbug" }, /backendId is "puppeteer"/],
    ["backendVersion", { backendVersion: 2 }, /backendVersion is 1, expected 2/],
    ["content hash", { contentSha256: "0".repeat(64) }, /document content has changed/]
  ])("regenerates when the %s changes", (_label, override, pattern) => {
    const { envelopeFile, envelope } = writeOne("fresh-mismatch");
    const result = imageRepresentationFreshness(envelope, { ...identity, docId: "fresh-mismatch", ...override },
      envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(pattern);
  });

  it("checks every field of the render target, so a new one cannot be forgotten", () => {
    // The comparison walks the expected target's own keys. This asserts the set it walks is the
    // whole target — a field added to RenderTarget and left out of the checks would be invisible.
    const { envelopeFile, envelope } = writeOne("target-fields");
    for (const field of Object.keys(renderTarget) as (keyof RenderTarget)[]) {
      const changed = { ...renderTarget, [field]: field === "viewportWidthPx" ? 1 : "changed" };
      const result = imageRepresentationFreshness(
        envelope, { ...identity, docId: "target-fields", renderTarget: changed as RenderTarget }, envelopeFile);
      expect({ field, fresh: result.fresh }).toEqual({ field, fresh: false });
      expect(result.reasons.join("\n")).toContain(`renderTarget.${field} is`);
    }
  });

  it.each([
    ["clueUrl", { clueUrl: "http://localhost:8081" }],
    ["unit", { unit: "qa" }],
    ["clueRevision", { clueRevision: "0000000" }],
    ["shutterbugUrl", { shutterbugUrl: "https://api.concord.org/shutterbug-production" }],
    ["viewportWidthPx", { viewportWidthPx: 1200 }],
    ["captureHeightPx", { captureHeightPx: 1500 }],
    ["captureMode", { captureMode: "fixed-height" as const, captureHeightPx: 1500 }]
  ])("regenerates when renderTarget.%s changes", (field, override) => {
    // http://localhost:8080 serves different code tomorrow, and a mutable branch deployment does
    // too, so every field of the render target is part of identity — the revision included.
    const { envelopeFile, envelope } = writeOne("target-mismatch");
    const result = imageRepresentationFreshness(
      envelope, { ...identity, docId: "target-mismatch", renderTarget: { ...renderTarget, ...override } },
      envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toContain(`renderTarget.${field} is`);
  });

  it("regenerates when the PNG has been deleted", () => {
    const { envelopeFile, envelope, identity: expected } = writeOne("deleted");
    fs.rmSync(resolveImageFile(envelopeFile, envelope.images[0]));
    const result = imageRepresentationFreshness(envelope, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/deleted-1\.png is missing or unreadable/);
  });

  it("regenerates when the PNG has been truncated", () => {
    const { envelopeFile, envelope, bytes, identity: expected } = writeOne("truncated");
    fs.writeFileSync(resolveImageFile(envelopeFile, envelope.images[0]), bytes.subarray(0, 100));
    const result = imageRepresentationFreshness(envelope, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/is 100 byte\(s\) on disk, expected/);
  });

  it("regenerates when the PNG has been replaced by different bytes of the same length", () => {
    // Same byte count, different pixels: only the hash catches this one.
    const { envelopeFile, envelope, bytes, identity: expected } = writeOne("replaced");
    const swapped = Buffer.from(bytes);
    // A different value in the same number of bytes: only the hash catches this.
    swapped[swapped.length - 5] = (swapped[swapped.length - 5] + 1) % 256;
    fs.writeFileSync(resolveImageFile(envelopeFile, envelope.images[0]), swapped);
    const result = imageRepresentationFreshness(envelope, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/hashes to [0-9a-f]{64}, expected/);
  });

  it("regenerates when the PNG has been resized", () => {
    const { envelopeFile, envelope, identity: expected } = writeOne("resized");
    const resized = makeTestPng(480, 700);
    fs.writeFileSync(resolveImageFile(envelopeFile, envelope.images[0]), resized);
    const stale: ImageEnvelope = {
      ...envelope,
      // The hash and byte count are patched to match, so only the dimension check can catch it.
      images: [{ ...envelope.images[0], sha256: sha256Bytes(resized), bytes: resized.length }]
    };
    const result = imageRepresentationFreshness(stale, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/is 480×700 on disk, expected 960×1420/);
  });

  it("regenerates when the file is no longer a PNG", () => {
    const { envelopeFile, envelope, identity: expected } = writeOne("degraded");
    const html = Buffer.from("<html>gone</html>");
    fs.writeFileSync(resolveImageFile(envelopeFile, envelope.images[0]), html);
    const stale: ImageEnvelope = {
      ...envelope,
      images: [{ ...envelope.images[0], sha256: sha256Bytes(html), bytes: html.length }]
    };
    const result = imageRepresentationFreshness(stale, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/is not a usable PNG/);
  });

  it("regenerates when the recorded mime type is not the one that gets stored", () => {
    const { envelopeFile, envelope, identity: expected } = writeOne("wrong-type");
    const stale: ImageEnvelope = {
      ...envelope, images: [{ ...envelope.images[0], mimeType: "image/jpeg" }]
    };
    const result = imageRepresentationFreshness(stale, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/records mimeType "image\/jpeg"/);
  });

  it("regenerates when the envelope records no images at all", () => {
    const { envelopeFile, envelope, identity: expected } = writeOne("empty-list");
    const result = imageRepresentationFreshness({ ...envelope, images: [] }, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons).toContain("it records no images");
  });

  it("checks every image, not just the first", () => {
    // Every render writes one today, but the checks handle N so a per-tile capture is
    // additive — and a second image nobody looked at would be exactly the hole this guards.
    const { envelopeFile, envelope, identity: expected } = writeOne("second-image");
    const stale: ImageEnvelope = {
      ...envelope,
      images: [envelope.images[0], { ...envelope.images[0], file: "second-image-2.png" }]
    };
    const result = imageRepresentationFreshness(stale, expected, envelopeFile);
    expect(result.fresh).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/second-image-2\.png is missing or unreadable/);
  });

  it("reports every reason at once, rather than stopping at the first", () => {
    // `render` prints these, so "the content changed and so did the CLUE revision" is more useful
    // than "something is stale".
    const { envelopeFile, envelope } = writeOne("many-reasons");
    const result = imageRepresentationFreshness(envelope, {
      ...identity, docId: "many-reasons", contentSha256: "0".repeat(64), backendVersion: 9,
      renderTarget: { ...renderTarget, clueRevision: "different" }
    }, envelopeFile);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("containment", () => {
  it("refuses an image file that resolves outside the envelope's directory", () => {
    const { envelopeFile, envelope } = writeOne("escape");
    // The validator refuses a path separator outright, so this is the belt to that braces: an
    // envelope constructed in memory still cannot reach outside its own directory.
    expect(() => resolveImageFile(envelopeFile, { ...envelope.images[0], file: "../../escaped.png" }))
      .toThrow(/resolves outside the envelope's directory/);
  });

  it("refuses a path separator in the envelope on read", () => {
    const { envelopeFile, envelope } = writeOne("separator");
    const tampered = { ...envelope, images: [{ ...envelope.images[0], file: "../escaped.png" }] };
    expect(() => validateImageEnvelope(tampered, envelopeFile))
      .toThrow(/must be a bare filename beside the envelope/);
  });
});

describe("choosing which of an envelope's images a run sends", () => {
  const tile = (tileId: string | null, file: string) => ({
    file, sha256: "a".repeat(64), mimeType: "image/png", widthPx: 100, heightPx: 100,
    bytes: 10, url: null, tileId, purpose: "tile" as const
  });

  it("takes the one full-document image for a full-document run", () => {
    const { envelopeFile, envelope } = writeOne("single");
    const { images, warnings } = imagesForSet(envelope, envelopeFile, "full-document");
    expect(images.map((image) => image.file)).toEqual(["single-1.png"]);
    expect(warnings).toEqual([]);
  });

  it.each([0, 2])("refuses %i full-document images, rather than picking one", (count) => {
    // Picking whatever is there would produce a row that looks like an ordinary full-document run
    // and is not.
    const { envelopeFile, envelope } = writeOne("counted");
    const images = count === 0
      ? []
      : [envelope.images[0], { ...envelope.images[0], file: "counted-2.png" }];
    expect(() => imagesForSet({ ...envelope, images }, envelopeFile, "full-document"))
      .toThrow(new RegExp(`records ${count} full-document image\\(s\\)`));
  });

  it("takes every tile image, in envelope order, for a per-tile run", () => {
    const { envelopeFile, envelope } = writeOne("tiles");
    const withTiles = {
      ...envelope,
      images: [tile("t1", "tiles-1.png"), tile("t2", "tiles-2.png"), tile("t3", "tiles-3.png")]
    };
    expect(imagesForSet(withTiles, envelopeFile, "per-tile").images.map((image) => image.tileId))
      .toEqual(["t1", "t2", "t3"]);
  });

  it("tells the caller to render per-tile first when the envelope has no tile images", () => {
    const { envelopeFile, envelope } = writeOne("no-tiles");
    for (const imageSet of ["per-tile", "visual-tiles-only"] as const) {
      expect(() => imagesForSet(envelope, envelopeFile, imageSet, new Set()))
        .toThrow(/records no per-tile images.*--mode puppeteer-per-tile/s);
    }
  });

  it("keeps only the tiles the classification says need a picture", () => {
    const { envelopeFile, envelope } = writeOne("visual");
    const withTiles = {
      ...envelope,
      images: [tile("text-tile", "visual-1.png"), tile("drawing-tile", "visual-2.png")]
    };
    const { images, warnings } = imagesForSet(
      withTiles, envelopeFile, "visual-tiles-only", new Set(["drawing-tile"]));
    expect(images.map((image) => image.tileId)).toEqual(["drawing-tile"]);
    expect(warnings).toEqual([]);
  });

  it("warns, rather than fails, when a visual tile has no capture of its own", () => {
    // Classification walks into Question tiles; the per-tile capture photographs top-level tiles
    // only. The images that exist are still the right ones to send.
    const { envelopeFile, envelope } = writeOne("nested");
    const withTiles = { ...envelope, images: [tile("outer", "nested-1.png")] };
    const { images, warnings } = imagesForSet(
      withTiles, envelopeFile, "visual-tiles-only", new Set(["outer", "inside-a-question"]));
    expect(images.map((image) => image.tileId)).toEqual(["outer"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("inside-a-question");
    expect(warnings[0]).toContain("nested inside a Question");
  });

  it("selects nothing when no captured tile needs a picture", () => {
    // The caller turns this into a skipped row: it is a fact about the document, not a failure.
    const { envelopeFile, envelope } = writeOne("all-text");
    const withTiles = { ...envelope, images: [tile("text-tile", "all-text-1.png")] };
    expect(imagesForSet(withTiles, envelopeFile, "visual-tiles-only", new Set()).images).toEqual([]);
  });
});

describe("pruning", () => {
  it("deletes the envelope and every PNG it names", () => {
    const { envelopeFile, envelope } = writeOne("pruned");
    const image = resolveImageFile(envelopeFile, envelope.images[0]);
    expect(removeImageRepresentation(envelopeFile).sort()).toEqual([envelopeFile, image].sort());
    expect(fs.existsSync(envelopeFile)).toBe(false);
    expect(fs.existsSync(image)).toBe(false);
  });

  it("does nothing when there is nothing there", () => {
    expect(removeImageRepresentation(imageRepresentationPath(paths, "puppeteer-full-height", "absent")))
      .toEqual([]);
  });

  it("deletes orphaned PNGs left by a crash, which have no envelope at all", () => {
    // The PNGs are written first and the envelope last, so a crash mid-render leaves pictures with
    // nothing naming them. Returning early on a missing envelope left them there, and --prune then
    // kept a rendered picture of a document that is no longer in the corpus.
    const envelopeFile = imageRepresentationPath(paths, "puppeteer-full-height", "crashed");
    const directory = path.dirname(envelopeFile);
    fs.mkdirSync(directory, { recursive: true });
    const orphans = ["crashed-1.png", "crashed-2.png"].map((name) => path.join(directory, name));
    for (const orphan of orphans) fs.writeFileSync(orphan, makeTestPng(8, 8));
    // Another document's picture, which must survive.
    const bystander = path.join(directory, "crashed-later-1.png");
    fs.writeFileSync(bystander, makeTestPng(8, 8));

    expect(removeImageRepresentation(envelopeFile).sort()).toEqual(orphans.sort());
    for (const orphan of orphans) expect(fs.existsSync(orphan)).toBe(false);
    expect(fs.existsSync(bystander)).toBe(true);
  });

  it("deletes a temporary file left by an interrupted write of a picture", () => {
    // A kill during `writeFileAtomically` leaves `<docId>-1.png.<pid>.<uuid>.tmp` holding the same
    // pixels as the picture it was about to become. Nothing else ever looks at it again.
    const envelopeFile = imageRepresentationPath(paths, "puppeteer-full-height", "interrupted");
    const directory = path.dirname(envelopeFile);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = path.join(directory,
      `interrupted-1.png.${process.pid}.f81d4fae-7dec-11d0-a765-00a0c91e6bf6.tmp`);
    fs.writeFileSync(temporary, makeTestPng(8, 8));
    expect(removeImageRepresentation(envelopeFile)).toEqual([temporary]);
    expect(fs.existsSync(temporary)).toBe(false);
  });

  it("deletes the PNGs of an envelope it cannot parse, not just the envelope", () => {
    // Leaving the images while deleting the only file that names them is exactly what --prune
    // exists to prevent: an unreachable picture of a student's document.
    const { envelopeFile, envelope } = writeOne("corrupt-with-png");
    const image = resolveImageFile(envelopeFile, envelope.images[0]);
    fs.writeFileSync(envelopeFile, "{ not json");
    const removed = removeImageRepresentation(envelopeFile);
    expect(fs.existsSync(image)).toBe(false);
    expect(removed).toEqual(expect.arrayContaining([image, envelopeFile]));
  });

  it("still deletes an envelope it cannot parse", () => {
    // --prune exists so no unreachable copy of a student's document lingers. An envelope that has
    // become unreadable must not be the one thing that survives it.
    const envelopeFile = imageRepresentationPath(paths, "puppeteer-full-height", "corrupt");
    fs.mkdirSync(path.dirname(envelopeFile), { recursive: true });
    fs.writeFileSync(envelopeFile, "{ not json");
    expect(removeImageRepresentation(envelopeFile)).toEqual([envelopeFile]);
    expect(fs.existsSync(envelopeFile)).toBe(false);
  });
});
