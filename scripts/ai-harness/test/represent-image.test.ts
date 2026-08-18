import fs from "node:fs";
import path from "node:path";
import { corpusPaths } from "../src/corpus.js";
import {
  imageRepresentationDir, imageRepresentationFreshness, imageRepresentationPath, readImageEnvelope,
  removeImageRepresentation, renderErrorDir, resolveImageFile, sha256Bytes, singleImageOf,
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
    // Another document's files are left strictly alone.
    const { envelopeFile: other } = writeOne("bystander");
    writeOne("shrinking");
    expect(fs.existsSync(resolveImageFile(other, readImageEnvelope(other).images[0]))).toBe(true);
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

  it("leaves no temporary files behind", () => {
    const { envelopeFile } = writeOne("tidy");
    const directory = path.dirname(envelopeFile);
    expect(fs.readdirSync(directory).filter((name) => name.endsWith(".tmp"))).toEqual([]);
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
    swapped[swapped.length - 5] ^= 0xff;
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
    // Milestone 2 always writes one, but the checks handle N so milestone 3's per-tile capture is
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

describe("building a request from an envelope", () => {
  it("takes the one image when there is exactly one", () => {
    const { envelopeFile, envelope } = writeOne("single");
    expect(singleImageOf(envelope, envelopeFile).file).toBe("single-1.png");
  });

  it.each([0, 2])("refuses an envelope with %i images, naming milestone 3", (count) => {
    const { envelopeFile, envelope } = writeOne("counted");
    const images = count === 0
      ? []
      : [envelope.images[0], { ...envelope.images[0], file: "counted-2.png" }];
    expect(() => singleImageOf({ ...envelope, images }, envelopeFile))
      .toThrow(/records \d+ images.*milestone 3/s);
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
