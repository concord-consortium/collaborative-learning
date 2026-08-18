/**
 * Image representations: where their envelopes and PNGs live, how they are written, and when one may
 * be reused.
 *
 * The text side can decide staleness from the envelope alone, because the envelope *is* the
 * representation. An image envelope only describes files that sit beside it, so freshness has to
 * check those files too: without that, a deleted, truncated, replaced or resized PNG passes as fresh
 * and the run either crashes later or, worse, sends the wrong picture.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
// Type-only, deliberately: corpus.ts imports this module to delete rendered PNGs on --prune, so a
// value import here would be a cycle. The helpers come from files.ts instead.
import type { CorpusPaths } from "./corpus.js";
import { isContainedBy, kTemporaryFilePattern, readJsonFile, writeFileAtomically } from "./files.js";
import { NotAPngError, readPngInfo } from "./png.js";
import {
  EnvelopeImage, ImageEnvelope, RenderTarget, kSchemaVersion, validateImageEnvelope
} from "./schemas.js";

export const kPngMimeType = "image/png";

/**
 * Envelopes are filed under the **mode** id rather than the backend id, so
 * `shutterbug-production-current` and `shutterbug-parameterized` can both exist at once instead of
 * overwriting each other and each looking stale to the other. See DEVIATIONS in the README.
 */
export function imageRepresentationDir(paths: CorpusPaths, modeId: string): string {
  return path.join(paths.representations, `image-${modeId}`);
}

export function imageRepresentationPath(paths: CorpusPaths, modeId: string, docId: string): string {
  return path.join(imageRepresentationDir(paths, modeId), `${docId}.json`);
}

/** Where a failed render leaves its evidence: an error screenshot and the captured console output. */
export function renderErrorDir(paths: CorpusPaths, modeId: string, docId: string): string {
  return path.join(paths.root, "render-errors", modeId, docId);
}

export function imageFileName(docId: string, index: number): string {
  return `${docId}-${index + 1}.png`;
}

/**
 * Matches the files `imageFileName` produces for one document, and the temporary files an
 * interrupted write of one of them leaves behind.
 *
 * A `startsWith(`${docId}-`)` test is not enough: document ids may contain hyphens, so writing `a`
 * would treat `a-b-1.png` — document `a-b`'s picture — as its own orphan and delete it.
 *
 * The temporary form is included because a kill mid-write leaves `<docId>-1.png.<pid>.<uuid>.tmp`
 * holding the same pixels as the picture it was going to become, and nothing else would ever look
 * at it again: it is not the envelope's file, so freshness ignores it, and without this `--prune`
 * would leave it behind.
 */
export function isImageFileFor(docId: string, name: string): boolean {
  const escaped = docId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}-\\d+\\.png(${kTemporaryFilePattern})?$`).test(name);
}

export function readImageEnvelope(file: string): ImageEnvelope {
  return validateImageEnvelope(readJsonFile(file), file);
}

/** sha256 of file bytes — the "file bytes" rule, distinct from `sha256Canonical` of a JSON value. */
export function sha256Bytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Resolves an envelope image's `file` inside the envelope's own directory, refusing anything that
 * escapes — through the same symlink-resolving check `resolveCorpusFile` and `resolveDataPath` use,
 * rather than a lexical one that a symlinked representations directory would walk straight past.
 */
export function resolveImageFile(envelopeFile: string, image: EnvelopeImage): string {
  const directory = path.dirname(path.resolve(envelopeFile));
  const resolved = path.resolve(directory, image.file);
  if (!isContainedBy(resolved, directory)) {
    throw new Error(`${envelopeFile}: image file "${image.file}" resolves outside the envelope's ` +
      `directory (${resolved})`);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Freshness
// ---------------------------------------------------------------------------

/** What `run` and `plan` check: is this stored render still the right one for this document? */
export interface ImageRepresentationUsability {
  docId: string;
  modeId: string;
  backendId: string;
  backendVersion: number;
  contentSha256: string;
}

/** What `render` checks additionally: would rendering again produce the same thing? */
export interface ImageRepresentationIdentity extends ImageRepresentationUsability {
  renderTarget: RenderTarget;
}

export interface FreshnessResult {
  fresh: boolean;
  /** Every reason it is not fresh, so `render` can say what changed rather than just "stale". */
  reasons: string[];
}

function compareRenderTargets(actual: RenderTarget, expected: RenderTarget, reasons: string[]): void {
  const keys = Object.keys(expected) as (keyof RenderTarget)[];
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      reasons.push(`renderTarget.${key} is ${JSON.stringify(actual[key])}, expected ` +
        `${JSON.stringify(expected[key])}`);
    }
  }
}

/**
 * Whether a stored render may be used for a run: it was produced for this document, by this mode and
 * backend at this version, from this exact content — and every file it names is still on disk, still
 * decodes as a PNG, and still has the byte count, hash and dimensions the envelope recorded.
 *
 * The render *target* is deliberately not compared here. Which CLUE build a picture was taken
 * against decides whether `render` should take it again; it does not make the stored pixels the
 * wrong pixels to send. The row records the whole target either way, so provenance is kept. See
 * DEVIATIONS in the README.
 */
export function imageRepresentationIsUsable(
  envelope: ImageEnvelope, expected: ImageRepresentationUsability, envelopeFile: string
): FreshnessResult {
  return checkImageRepresentation(envelope, expected, envelopeFile, null);
}

/**
 * Whether `render` may skip re-rendering: everything `imageRepresentationIsUsable` checks, plus every
 * field of the render target — `http://localhost:8080` serves different code tomorrow, and a mutable
 * branch deployment does too, so the CLUE revision is part of the target rather than a footnote.
 */
export function imageRepresentationFreshness(
  envelope: ImageEnvelope, expected: ImageRepresentationIdentity, envelopeFile: string
): FreshnessResult {
  return checkImageRepresentation(envelope, expected, envelopeFile, expected.renderTarget);
}

function checkImageRepresentation(
  envelope: ImageEnvelope, expected: ImageRepresentationUsability, envelopeFile: string,
  renderTarget: RenderTarget | null
): FreshnessResult {
  const reasons: string[] = [];
  if (envelope.docId !== expected.docId) {
    reasons.push(`docId is "${envelope.docId}", expected "${expected.docId}"`);
  }
  if (envelope.modeId !== expected.modeId) {
    reasons.push(`modeId is "${envelope.modeId}", expected "${expected.modeId}"`);
  }
  if (envelope.backendId !== expected.backendId) {
    reasons.push(`backendId is "${envelope.backendId}", expected "${expected.backendId}"`);
  }
  if (envelope.backendVersion !== expected.backendVersion) {
    reasons.push(`backendVersion is ${envelope.backendVersion}, expected ${expected.backendVersion}`);
  }
  if (envelope.sourceContentSha256 !== expected.contentSha256) {
    reasons.push("the document content has changed since this was rendered");
  }
  if (renderTarget) compareRenderTargets(envelope.renderTarget, renderTarget, reasons);

  if (envelope.images.length === 0) reasons.push("it records no images");
  for (const image of envelope.images) {
    let resolved: string;
    try {
      resolved = resolveImageFile(envelopeFile, image);
    } catch (error) {
      reasons.push((error as Error).message);
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = fs.readFileSync(resolved);
    } catch {
      reasons.push(`${image.file} is missing or unreadable`);
      continue;
    }
    if (bytes.length !== image.bytes) {
      reasons.push(`${image.file} is ${bytes.length} byte(s) on disk, expected ${image.bytes}`);
      continue;
    }
    const digest = sha256Bytes(bytes);
    if (digest !== image.sha256) {
      reasons.push(`${image.file} hashes to ${digest}, expected ${image.sha256}`);
      continue;
    }
    if (image.mimeType !== kPngMimeType) {
      reasons.push(`${image.file} records mimeType "${image.mimeType}", and only ${kPngMimeType} is stored`);
      continue;
    }
    try {
      const info = readPngInfo(bytes, image.file);
      if (info.widthPx !== image.widthPx || info.heightPx !== image.heightPx) {
        reasons.push(`${image.file} is ${info.widthPx}×${info.heightPx} on disk, ` +
          `expected ${image.widthPx}×${image.heightPx}`);
      }
    } catch (error) {
      reasons.push(error instanceof NotAPngError ? error.message : `${image.file}: ${(error as Error).message}`);
    }
  }
  return { fresh: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export interface ImageToStore {
  bytes: Buffer;
  /** The hosted URL a Shutterbug render came from; `null` for a locally captured image. */
  url: string | null;
  tileId: string | null;
  purpose: EnvelopeImage["purpose"];
}

export interface WriteImageRepresentationOptions {
  envelopeFile: string;
  docId: string;
  modeId: string;
  backendId: string;
  backendVersion: number;
  renderTarget: RenderTarget;
  sourceContentSha256: string;
  generatedAt: string;
  images: ImageToStore[];
}

/**
 * Writes the PNGs and then the envelope, each atomically and the envelope last, so a crash can leave
 * orphaned images (harmless — the next render overwrites them) but never an envelope pointing at
 * files that were never written.
 *
 * Every image is decoded before anything is committed. A backend that handed back HTML, a JSON error
 * body or a truncated download must fail here rather than have that discovered halfway through a run
 * that has already spent money.
 */
export function writeImageRepresentation(options: WriteImageRepresentationOptions): ImageEnvelope {
  const directory = path.dirname(path.resolve(options.envelopeFile));
  const images: EnvelopeImage[] = options.images.map((image, index) => {
    const info = readPngInfo(image.bytes, `${options.docId} image ${index + 1}`);
    return {
      file: imageFileName(options.docId, index),
      sha256: sha256Bytes(image.bytes),
      mimeType: kPngMimeType,
      widthPx: info.widthPx,
      heightPx: info.heightPx,
      bytes: image.bytes.length,
      url: image.url,
      tileId: image.tileId,
      purpose: image.purpose
    };
  });

  images.forEach((image, index) => {
    writeFileAtomically(path.join(directory, image.file), options.images[index].bytes);
  });

  // Filenames come from the image index, so a render that produces fewer images than the one before
  // would leave the surplus files behind — unreferenced by the envelope, and therefore invisible to
  // `removeImageRepresentation` when `--prune` runs. Rendered student work would survive pruning.
  // Milestone 2 always writes exactly one image; milestone 3's per-tile capture makes this reachable.
  const written = new Set(images.map((image) => image.file));
  for (const name of fs.existsSync(directory) ? fs.readdirSync(directory) : []) {
    if (isImageFileFor(options.docId, name) && !written.has(name)) {
      fs.rmSync(path.join(directory, name), { force: true });
    }
  }

  const envelope: ImageEnvelope = {
    schemaVersion: kSchemaVersion,
    docId: options.docId,
    kind: "image",
    modeId: options.modeId,
    backendId: options.backendId,
    backendVersion: options.backendVersion,
    renderTarget: options.renderTarget,
    sourceContentSha256: options.sourceContentSha256,
    generatedAt: options.generatedAt,
    images
  };
  writeFileAtomically(options.envelopeFile, `${JSON.stringify(envelope, null, 2)}\n`);
  return envelope;
}

/**
 * The one image a milestone-2 request is built from.
 *
 * Zero and many both fail, and the first image is never quietly selected: an envelope with two
 * images means per-tile capture, which is milestone 3's job, and picking one of them would produce a
 * result row that looks like a normal full-document run and is not.
 */
export function singleImageOf(envelope: ImageEnvelope, envelopeFile: string): EnvelopeImage {
  if (envelope.images.length !== 1) {
    throw new Error(`${envelopeFile} records ${envelope.images.length} images. Milestone 2 builds ` +
      "requests from exactly one full-document image; multi-image requests (per-tile capture and " +
      "mixed messages) arrive in milestone 3.");
  }
  return envelope.images[0];
}

/** The base64 data URL a locally captured PNG is sent as — what production does with a local file. */
export function dataUrlFor(bytes: Buffer): string {
  return `data:${kPngMimeType};base64,${bytes.toString("base64")}`;
}

/**
 * Deletes every deterministically named image file for a document, whatever the envelope says.
 *
 * Filenames come from the document id and the image index, so the document's own pictures can be
 * found without an envelope to list them.
 */
function sweepImageFiles(envelopeFile: string, removed: string[]): void {
  const docId = path.basename(envelopeFile, path.extname(envelopeFile));
  const directory = path.dirname(path.resolve(envelopeFile));
  for (const name of fs.existsSync(directory) ? fs.readdirSync(directory) : []) {
    if (!isImageFileFor(docId, name)) continue;
    const orphan = path.join(directory, name);
    fs.rmSync(orphan, { force: true });
    removed.push(orphan);
  }
}

/** Deletes an image representation's envelope and every PNG it names. Used by `import --prune`. */
export function removeImageRepresentation(envelopeFile: string): string[] {
  const removed: string[] = [];
  if (!fs.existsSync(envelopeFile)) {
    // No envelope does not mean no pictures. `writeImageRepresentation` writes the PNGs first and
    // the envelope last, so a crash mid-render leaves `<docId>-N.png` with nothing naming it —
    // and `--prune` would then leave a rendered picture of a document that is no longer in the
    // corpus, which is the one outcome pruning exists to prevent.
    sweepImageFiles(envelopeFile, removed);
    return removed;
  }
  try {
    for (const image of readImageEnvelope(envelopeFile).images) {
      const resolved = resolveImageFile(envelopeFile, image);
      if (fs.existsSync(resolved)) {
        fs.rmSync(resolved);
        removed.push(resolved);
      }
    }
  } catch {
    // The envelope is unreadable, so its images cannot be listed — but leaving them while deleting
    // the only file that names them is the same unreachable-picture outcome as above.
    sweepImageFiles(envelopeFile, removed);
  }
  fs.rmSync(envelopeFile);
  removed.push(envelopeFile);
  return removed;
}
