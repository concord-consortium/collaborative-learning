/**
 * The side-by-side HTML review report: one section per document, showing the input the model was
 * given and every run's output beside it, for a human to compare.
 *
 * `report.ts` answers aggregate questions — tokens, cost, category counts per group. It cannot
 * answer the one a judge is asked: *for this document, which output is better?* That takes seeing
 * the document the way the model saw it, next to what each run said about it.
 *
 * Three rules run through the whole file:
 *
 * 1. **Student-authored content is untrusted input, everywhere it appears** — in summaries, in model
 *    outputs quoting the document, in refusal strings, in error messages. Every value that reaches
 *    the page goes through the `html` tagged template below, which escapes anything that is not an
 *    already-escaped fragment. Nothing derived from a document is ever inlined as markup; the only
 *    non-text content is PNG bytes as `data:` URLs.
 * 2. **Show the input that was sent, or a notice — never a stand-in.** A representation is displayed
 *    as a run's input only when its full descriptor still matches. Anything less renders a notice
 *    and shows nothing: a report that pairs today's screenshot with last week's output invites a
 *    judgement about the wrong thing.
 * 3. **The blind mapping lives only in the key file.** Card order is derived from a random seed
 *    generated at report time and stored only there, so the mapping cannot be reconstructed from the
 *    HTML plus this source.
 */
import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import {
  CorpusPaths, readCorpusDocument, readManifest, readRepresentation, representationPath
} from "./corpus.js";
import {
  imageRepresentationIsUsable, imageRepresentationPath, imagesForSet, readImageEnvelope,
  resolveImageFile, sha256Bytes
} from "./represent-image.js";
import { classifyDocument } from "./capability.js";
import { visualTileIdsOf } from "./execute.js";
import { partitionSuperseded } from "./report.js";
import {
  EnvelopeImage, ExperimentFile, ExperimentRun, ExtrasMode, ImageDetail, ImageRepresentation,
  ImageSet, ManifestDocument, MessageShape, Modality, ResultRow, ReviewKeyFile, ReviewKeyPair,
  TextRepresentation, canonicalJson, kSchemaVersion, modalities, sendsImages, sendsText,
  sha256Canonical
} from "./schemas.js";

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/**
 * The one escape function. Every string that reaches the page goes through it, with no exceptions
 * for "safe-looking" fields — a document id is student-adjacent data too, and the day one of these
 * fields stops being safe is the day nobody remembers which ones were exempt.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    // U+2028 and U+2029 are ordinary text in HTML — a browser decodes these references back to the
    // same characters and renders the page identically — but a file containing them raw makes
    // editors warn about unusual line terminators, and student text really does contain them (the
    // `adversarial-text` fixture has one of each). Written as regex escapes rather than literal
    // characters: an invisible line separator in this source would be impossible to review. These
    // two replacements introduce `&`, so they run after the `&` above rather than before it.
    .replace(/\u2028/g, "&#8232;")
    .replace(/\u2029/g, "&#8233;");
}

/** Markup that is already escaped, and so may be interpolated as-is. Only `html` produces one. */
class HtmlFragment {
  constructor(readonly markup: string) {}
}

export type Html = HtmlFragment;

function interpolate(value: unknown): string {
  if (value instanceof HtmlFragment) return value.markup;
  if (Array.isArray(value)) return value.map(interpolate).join("");
  // `false`, `null` and `undefined` render as nothing, so `condition && html\`…\`` reads naturally.
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(String(value));
}

/**
 * Builds markup with every interpolated value escaped unless it is itself an `HtmlFragment`.
 *
 * This is the reason the escaping rule can be checked by reading rather than by remembering:
 * composing markup *requires* the tag, and anything else that lands in a hole is escaped. Forgetting
 * to escape is not a thing this file can do by omission — it would take deliberately building a
 * fragment out of raw text, which happens exactly once, for the stylesheet constant.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  let markup = strings[0];
  values.forEach((value, index) => {
    markup += interpolate(value) + strings[index + 1];
  });
  return new HtmlFragment(markup);
}

// ---------------------------------------------------------------------------
// Output paths
// ---------------------------------------------------------------------------

export interface ReviewModes {
  shareable: boolean;
  blind: boolean;
}

/**
 * The report sits beside its results file and is named after it, the way `summary.json` is — with a
 * distinct name per mode, so a shareable or blinded report can never overwrite the team-internal
 * one, or each other.
 */
export function reviewOutputPathFor(resultsFile: string, modes: ReviewModes): string {
  const directory = path.dirname(resultsFile);
  const base = path.basename(resultsFile, path.extname(resultsFile));
  const suffix = `${modes.blind ? "-blind" : ""}${modes.shareable ? "-shareable" : ""}`;
  return path.join(directory, `${base}.review${suffix}.html`);
}

export interface ReviewSidecarPaths {
  /** The mapping from what a reader sees to what produced it. Written only in shareable/blind modes. */
  key: string;
  /** Where a judge writes their answers. Written only in blind modes. */
  ratings: string;
}

/**
 * Both sidecars are named from the **resolved** output HTML path, never from the results basename.
 *
 * Naming them after the results file would give a blind report and a blind+shareable one the same
 * key path, and two `--out` targets over one results file the same one again — so generating the
 * second report would either be refused for a collision it did not cause, or quietly rotate the
 * first report's labels.
 */
export function reviewSidecarPaths(htmlFile: string): ReviewSidecarPaths {
  const stem = htmlFile.replace(/\.html$/, "");
  return { key: `${stem}.key.json`, ratings: `${stem}.ratings-template.csv` };
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/** A run's configuration, as the experiment file defines it. `null` fields mean "the default". */
export interface ReviewRunConfiguration {
  runId: string;
  message: MessageShape;
  textVariant: string | null;
  imageMode: string | null;
  detail: ImageDetail | null;
  imageSet: ImageSet | null;
  extras: ExtrasMode | null;
  promptName: string;
  /**
   * The prompt this run's rows actually used. `null` when the experiment defines a run this file
   * has no rows for, and — the case worth knowing about — when its rows disagree.
   */
  promptSha256: string | null;
  /**
   * How many distinct prompt hashes this run's current rows carry.
   *
   * Normally 1. It can be more: a prompt file's content is not part of the experiment hash, but it
   * *is* part of the request key, so editing a prompt and re-running into the same results file
   * re-runs every pair — and a re-run that stops early (the spend ceiling, an error, an interrupt)
   * leaves some pairs on the new prompt and some on the old, all of them current. The header then
   * cannot honestly name one prompt for the run, and each card carries its own instead.
   */
  promptVersions: number;
}

/** One picture a document's runs actually sent, with the bytes that were sent. */
export interface ReviewImageInput {
  sha256: string;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  bytes: number;
  /**
   * Which tile a per-tile capture is a picture of. `null` in shareable mode: a tile id is a document
   * identifier, and in this corpus it literally contains the document id (`wave-runner-tile`), so
   * printing it beside a pseudonym would undo the pseudonym.
   */
  tileId: string | null;
  /** Which mode and image set sent it. Empty in blind mode, where it would name a configuration. */
  labels: string[];
}

/** One summary a document's runs actually sent. */
export interface ReviewTextInput {
  variantId: string;
  variantVersion: number;
  markdown: string;
  /** Empty in blind mode. */
  labels: string[];
}

export type ReviewOutcome =
  | {
    kind: "success";
    category: string | null;
    keyIndicators: string[] | null;
    discussion: string | null;
    /**
     * Whatever else the parsed response carried, as canonical JSON. Every field of the prompt's
     * response schema is optional, so a response that answered differently is shown rather than
     * dropped by a renderer that assumed a shape.
     */
    remainingJson: string | null;
  }
  | { kind: "refusal"; refusal: string }
  | { kind: "error"; type: string; message: string; attempts: number };

/** One run's outcome for one document: what a judge reads. */
export interface ReviewCard {
  docId: string;
  /** `null` in blind mode — this is the thing the labels hide. */
  runId: string | null;
  /** `A`, `B`, `C`… in blind mode; `null` otherwise. */
  label: string | null;
  status: "success" | "refusal" | "error";
  /** `null` in blind mode: a configuration beside a labelled card is a decoding aid. */
  configuration: ReviewRunConfiguration | null;
  outcome: ReviewOutcome;
  /** `null` in blind mode. */
  usage: { promptTokens: number; completionTokens: number; source: "api" | "cache" } | null;
  /** `null` in blind mode. */
  modeledUsd: number | null;
  /**
   * The prompt this row actually used. `null` in blind mode, where it would identify the run.
   * Rendered only when its run's rows disagree — see `ReviewRunConfiguration.promptVersions`.
   */
  promptSha256: string | null;
  /** This row sent a mixed message with its text half dropped: it saw half the input. */
  textPartOmitted: boolean;
  /** Empty in blind and shareable modes; see `cardFor`. */
  representationWarnings: string[];
}

/** A (run, document) pair that was never sent. There is nothing here to judge. */
export interface ReviewSkipped {
  /** `null` in blind mode. */
  runId: string | null;
  /**
   * Empty in blind **and** shareable modes; only the team-internal report carries them.
   *
   * A skip reason is not a fixed vocabulary. It names the shape and settings of the run that
   * declined ("image-only run with imageSet …"), which is a configuration standing beside labelled
   * cards; and it carries whatever `imagesForSet` and `expectedRenderFailure` put in it, which is up
   * to five tile ids and a line of author-written prose. A tile id contains the document id outright
   * in this corpus, so a shareable report printed `wave-runner-tile` under the heading `doc-02`.
   * Same leak as DEVIATIONS 33, one path further along. See DEVIATIONS in the README.
   */
  skipReasons: string[];
}

export interface ReviewDocumentMetadata {
  unit: string | null;
  investigation: string | null;
  problem: string | null;
  contextId: string | null;
  source: string;
  file: string;
}

export interface ReviewDocument {
  docId: string;
  /** What the report calls this document: its id, or its pseudonym in shareable mode. */
  displayName: string;
  modality: Modality;
  computedModality: Modality;
  /** True when a human's `modalityOverride` put this document in its group, not the classifier. */
  overridden: boolean;
  /** `null` in shareable mode, and for a document the manifest no longer lists. */
  metadata: ReviewDocumentMetadata | null;
  /** True when the results name a document the corpus manifest does not. */
  missingFromManifest: boolean;
  images: ReviewImageInput[];
  texts: ReviewTextInput[];
  /** Why an input a run sent is not shown: it no longer exists, or no longer matches this run. */
  inputNotices: string[];
  /** Judgeable outcomes: experiment-file order, or shuffled label order in blind mode. */
  cards: ReviewCard[];
  skipped: ReviewSkipped[];
}

export interface ReviewModel {
  generatedAt: string;
  corpus: string;
  experimentName: string;
  experimentSha256: string;
  /** `null` in shareable mode, where file paths are stripped. */
  resultsFile: string | null;
  /** `null` in shareable mode. */
  gitCommit: string | null;
  modes: ReviewModes;
  /** `null` in blind mode, where the header carries the run *count* instead. */
  runs: ReviewRunConfiguration[] | null;
  runCount: number;
  counts: { success: number; refusal: number; error: number; skipped: number };
  supersededRows: number;
  groups: { modality: Modality; documents: ReviewDocument[] }[];
  /** Presentation order — what the pseudonyms number, and what the key records. */
  documents: ReviewDocument[];
  judgeable: ReviewKeyPair[];
  pseudonyms: Record<string, string> | null;
  seed: string | null;
  labels: Record<string, Record<string, string>> | null;
}

// ---------------------------------------------------------------------------
// Blind ordering
// ---------------------------------------------------------------------------

/**
 * `A`…`Z`, then `AA`, `AB`… — enough labels for any run list, in an order a reader can follow.
 *
 * Sort them with `compareLabels`, never with `localeCompare` alone: see below.
 */
export function labelForIndex(index: number): string {
  let label = "";
  let remaining = index;
  for (;;) {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
    if (remaining < 0) return label;
  }
}

/**
 * Orders labels the way `labelForIndex` issues them.
 *
 * Plain lexicographic ordering is wrong past `Z`: it puts `AA` immediately after `A`, so a document
 * with more than 26 outcomes would render `A, AA, AB, …, B`. Length first, because the labels are
 * bijective base-26 and their length rises with the index, so length-then-lexicographic *is* index
 * order. It lives here rather than at the sort, so the sequence and its ordering cannot drift apart.
 */
export function compareLabels(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b);
}

/**
 * The shuffled label order for one document's judgeable runs.
 *
 * Keyed on a secret: a seeded HMAC rather than a hash of the row data, because anything derived from
 * the results file alone is reconstructible by whoever reads this function. Without the key file,
 * the HTML plus this source says nothing about which card came from which run; with it, regeneration
 * is exact.
 */
export function blindLabelsFor(seed: string, docId: string, runIds: string[]): Map<string, string> {
  const sortKey = (runId: string) =>
    createHmac("sha256", Buffer.from(seed, "hex")).update(`${docId} ${runId}`).digest("hex");
  const keyed = runIds.map((runId) => ({ runId, key: sortKey(runId) }));
  // The run id breaks a tie, so the order is total even in the impossible case of a digest
  // collision — a report whose card order depended on input order would not regenerate.
  keyed.sort((a, b) => (a.key === b.key ? a.runId.localeCompare(b.runId) : a.key < b.key ? -1 : 1));
  return new Map(keyed.map((entry, index) => [entry.runId, labelForIndex(index)]));
}

// ---------------------------------------------------------------------------
// Reading the inputs back
// ---------------------------------------------------------------------------

/**
 * Why an input cannot be shown, as a fixed vocabulary rather than a sentence.
 *
 * The sentences these become are written at the rendering boundary, where the mode is known. That
 * matters: the underlying errors carry absolute paths (which contain the corpus and document id),
 * image filenames (which contain the document id) and freshness reasons (which name the mode,
 * backend and version). Interpolating any of them would put a document identifier in a shareable
 * report or a run configuration in a blinded one — the two things those modes exist to prevent.
 */
export type UnavailableReason =
  | "missing"
  | "unreadable"
  | "wrong-document"
  | "variant-changed"
  | "document-changed"
  | "render-changed"
  | "bytes-changed"
  | "selection-unknown";

/** What went wrong, plus detail that only the team-internal report is allowed to print. */
export interface UnavailableInput {
  unavailable: UnavailableReason;
  /** Never shown in a shareable or blind report; it may name a path, a file or a configuration. */
  detail?: string;
}

/**
 * The summary a text-carrying row sent, or why it cannot be shown.
 *
 * Every part of the descriptor has to match: the variant that produced it, the version of that
 * variant, and the content it was produced from. A representation regenerated since the run is a
 * different summary, and pairing it with that run's output — even with a warning — invites a
 * judgement about text the model never saw.
 */
function readSentText(
  paths: CorpusPaths, docId: string, descriptor: TextRepresentation
): { markdown: string } | UnavailableInput {
  const file = representationPath(paths, descriptor.variantId, docId);
  if (!fs.existsSync(file)) return { unavailable: "missing" };
  let envelope;
  try {
    envelope = readRepresentation(file);
  } catch (error) {
    return { unavailable: "unreadable", detail: (error as Error).message };
  }
  if (envelope.docId !== docId) return { unavailable: "wrong-document" };
  if (envelope.variantId !== descriptor.variantId) return { unavailable: "wrong-document" };
  if (envelope.variantVersion !== descriptor.variantVersion) {
    return {
      unavailable: "variant-changed",
      detail: `version ${envelope.variantVersion} on disk, ${descriptor.variantVersion} was sent`
    };
  }
  if (envelope.sourceContentSha256 !== descriptor.sourceContentSha256) {
    return { unavailable: "document-changed" };
  }
  return { markdown: envelope.markdown };
}

interface SentImage {
  image: EnvelopeImage;
  bytes: Buffer;
}

/**
 * The pictures an image-carrying row sent, or why they cannot be shown.
 *
 * Two checks, both required. The envelope has to still be usable for this row —
 * `imageRepresentationIsUsable` covers mode, backend, backend version, source content and every
 * file-level property, which is the same bar `run` applies before sending one. And every hash the
 * row recorded has to be one of the pictures that envelope now holds, with the bytes on disk still
 * hashing to it. The second check is stated directly rather than inferred from the first: "these are
 * the bytes that were sent" is the claim the report makes, so it is the claim that gets tested.
 */
/**
 * A document's content, but only when it still hashes to what the run was given.
 *
 * `visual-tiles-only` is the one image set whose membership is not structural: it is the tiles the
 * *classifier* marked as needing a picture, so reconstructing what a run sent means classifying the
 * same content it classified. Anything else is a guess dressed as provenance.
 */
export type ContentMatching = (sourceContentSha256: string) => unknown | null;

function readSentImages(
  paths: CorpusPaths, docId: string, descriptor: ImageRepresentation,
  contentMatching: ContentMatching
): { images: SentImage[] } | UnavailableInput {
  const file = imageRepresentationPath(paths, descriptor.modeId, docId);
  if (!fs.existsSync(file)) return { unavailable: "missing" };
  let envelope;
  try {
    envelope = readImageEnvelope(file);
  } catch (error) {
    return { unavailable: "unreadable", detail: (error as Error).message };
  }
  const usable = imageRepresentationIsUsable(envelope, {
    docId,
    modeId: descriptor.modeId,
    backendId: descriptor.backendId,
    backendVersion: descriptor.backendVersion,
    contentSha256: descriptor.sourceContentSha256
  }, file);
  if (!usable.fresh) {
    return { unavailable: "render-changed", detail: usable.reasons[0] };
  }
  // `imageSha256s` is every picture the envelope holds — the render's provenance — and `imageSet`
  // says which of them the run actually sent. Showing all of them displayed tile captures a
  // `visual-tiles-only` run never received, labelled as though it had. The selection goes through
  // the same function execution selects with, so the two cannot disagree about what a set means.
  const imageSet = descriptor.imageSet ?? "full-document";
  let selected;
  try {
    if (imageSet === "visual-tiles-only") {
      const content = contentMatching(descriptor.sourceContentSha256);
      if (content === null) return { unavailable: "selection-unknown" };
      selected = imagesForSet(envelope, file, imageSet, visualTileIdsOf(classifyDocument(content)));
    } else {
      selected = imagesForSet(envelope, file, imageSet);
    }
  } catch (error) {
    return { unavailable: "selection-unknown", detail: (error as Error).message };
  }

  const recorded = new Set(descriptor.imageSha256s);
  const images: SentImage[] = [];
  for (const image of selected.images) {
    // Belt and braces: a selected picture the row's provenance does not list would mean the
    // envelope has changed under us in a way the freshness check did not catch.
    if (!recorded.has(image.sha256)) return { unavailable: "bytes-changed" };
    let bytes: Buffer;
    try {
      bytes = fs.readFileSync(resolveImageFile(file, image));
    } catch {
      return { unavailable: "unreadable", detail: `${image.file} could not be read` };
    }
    if (sha256Bytes(bytes) !== image.sha256) {
      return { unavailable: "bytes-changed", detail: `${image.file} holds different bytes` };
    }
    images.push({ image, bytes });
  }
  return { images };
}

// ---------------------------------------------------------------------------
// Building the model
// ---------------------------------------------------------------------------

export interface BuildReviewOptions {
  /** Every row in the results file; superseded ones are partitioned out here. */
  rows: ResultRow[];
  resultsFile: string;
  experiment: ExperimentFile;
  experimentSha256: string;
  paths: CorpusPaths;
  now: Date;
  modes: ReviewModes;
  /** A fresh random seed. Ignored when `existingKey` supplies one. */
  seed: string;
  /** The key a `--reuse-key` run is regenerating against, already validated as a file. */
  existingKey?: { key: ReviewKeyFile; file: string };
}

/**
 * Result rows deliberately do not carry the whole run configuration — `detail`, `imageSet` and
 * `extras` live only in the experiment file, a skipped row carries no representation descriptor at
 * all, and the header needs experiment-file run order. So the experiment file is a required input,
 * and this is what stops it being a *different* experiment file: a name match proves nothing,
 * because the file can be edited after a run.
 */
export function assertExperimentMatchesRows(
  rows: ResultRow[], experimentSha256: string, experimentFile: string, resultsFile: string
): void {
  const mismatched = rows.find((row) => row.experimentSha256 !== experimentSha256);
  if (!mismatched) return;
  throw new Error(`${experimentFile} hashes to ${experimentSha256}, but ${resultsFile} was run ` +
    `against ${mismatched.experimentSha256} (experiment "${mismatched.experiment}"). The file has ` +
    "been edited since the run, so its run list no longer describes these rows. Check out the " +
    "definition the rows were produced with, or re-run the current one into a fresh --output.");
}

/**
 * What a label was put on: the request that was sent, what it was built from, and what came back.
 *
 * A (document, run) pair does not identify an outcome — a re-run appends a replacement row for the
 * same pair. `runMeta`, `usage` and `cost` are left out on purpose: a re-run served from the cache
 * changes all three while the card a judge read stays identical.
 */
function judgeableFingerprint(row: ResultRow): string {
  if (row.status === "skipped") throw new Error("A skipped row is not judgeable");
  return sha256Canonical({
    requestKey: row.requestKey,
    representation: row.representation,
    status: row.status,
    textPartOmitted: row.textPartOmitted === true,
    // The answer itself, by status. `response.raw` is excluded: it carries a per-call id that
    // differs between two calls that returned the same thing.
    parsed: row.status === "success" ? row.response.parsed : undefined,
    refusal: row.status === "refusal" ? row.refusal : undefined,
    error: row.status === "error" ? row.error : undefined
  });
}

/** The last row per (document, run) — the outcome that still stands. */
function currentRowsByDocument(rows: ResultRow[]): Map<string, Map<string, ResultRow>> {
  const byDocument = new Map<string, Map<string, ResultRow>>();
  for (const row of rows) {
    let forDocument = byDocument.get(row.docId);
    if (!forDocument) {
      forDocument = new Map();
      byDocument.set(row.docId, forDocument);
    }
    forDocument.set(row.runId, row);
  }
  return byDocument;
}

function configurationFor(
  run: ExperimentRun, promptShas: Set<string>
): ReviewRunConfiguration {
  return {
    runId: run.id,
    message: run.message,
    textVariant: sendsText(run.message) ? run.textVariant ?? null : null,
    imageMode: sendsImages(run.message) ? run.imageMode ?? null : null,
    detail: run.detail ?? null,
    imageSet: run.imageSet ?? null,
    extras: sendsText(run.message) ? run.extras ?? "all" : null,
    promptName: run.prompt,
    // One hash only when the rows agree on one. Reporting the last row's hash for a run whose rows
    // disagree told a reader that every card came from that prompt, which was false for some.
    promptSha256: promptShas.size === 1 ? [...promptShas][0] : null,
    promptVersions: promptShas.size
  };
}

/**
 * The recognized fields of a parsed response, with everything else kept rather than dropped.
 *
 * A field leaves the JSON fallback only when it was actually rendered in its recognized form. A
 * `category` that came back as a number, or a `discussion` that came back as an object, is not
 * something the typed renderer can show — so it stays in the fallback, where it is at least
 * visible. Dropping it by *name* lost the model's answer outright: a response of
 * `{ category: 42 }` rendered as "the response parsed to an empty object", which is a card that
 * says something untrue about what came back.
 */
function outcomeForSuccess(parsed: unknown): ReviewOutcome {
  const record = (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : null;
  // Not an object at all: there is nothing to pick fields out of, so the whole value is shown.
  if (!record) {
    return {
      kind: "success", category: null, keyIndicators: null, discussion: null,
      remainingJson: canonicalJson(parsed)
    };
  }
  const category = typeof record.category === "string" ? record.category : null;
  const keyIndicators = Array.isArray(record.keyIndicators)
    ? record.keyIndicators.map((value) => typeof value === "string" ? value : canonicalJson(value))
    : null;
  const discussion = typeof record.discussion === "string" ? record.discussion : null;
  const rendered = new Set([
    ...(category === null ? [] : ["category"]),
    ...(keyIndicators === null ? [] : ["keyIndicators"]),
    ...(discussion === null ? [] : ["discussion"])
  ]);
  const remaining = Object.fromEntries(
    Object.entries(record).filter(([field]) => !rendered.has(field)));
  return {
    kind: "success",
    category,
    keyIndicators,
    discussion,
    remainingJson: Object.keys(remaining).length > 0 ? canonicalJson(remaining) : null
  };
}

function outcomeFor(row: ResultRow): ReviewOutcome {
  switch (row.status) {
    case "success": return outcomeForSuccess(row.response.parsed);
    case "refusal": return { kind: "refusal", refusal: row.refusal };
    case "error": return {
      kind: "error", type: row.error.type, message: row.error.message, attempts: row.error.attempts
    };
    default: throw new Error(`A ${row.status} row has no outcome to review`);
  }
}

/** Which mode and set sent a picture — the label an unblinded report puts under it. */
function imageLabelFor(descriptor: ImageRepresentation): string {
  return `${descriptor.modeId}, ${descriptor.imageSet ?? "full-document"}`;
}

function addLabel(labels: string[], label: string): void {
  if (!labels.includes(label)) labels.push(label);
}

/**
 * What each reason says on the page. Every sentence is safe in every mode: no path, no filename, no
 * variant, mode, backend or version.
 */
const kUnavailableSentences: Record<UnavailableReason, string> = {
  missing: "the file it was generated into is no longer on disk",
  unreadable: "the stored file could not be read",
  "wrong-document": "the stored file describes something other than this run's input",
  "variant-changed": "the representation has been regenerated by a newer version of its variant",
  "document-changed": "the document has changed since this run, so what is on disk now describes " +
    "the newer content",
  "render-changed": "the render on disk no longer matches the one this run sent",
  "bytes-changed": "the picture on disk no longer holds the bytes this run sent",
  "selection-unknown": "which of the document's pictures this run sent cannot be established " +
    "from what is on disk now"
};

/**
 * The inputs a document's runs sent, deduplicated.
 *
 * Runs share inputs — three text runs over the `default` variant sent one summary between them — so
 * the report shows each distinct input once, labelled with everything that sent it. Order is first
 * appearance walking the rows in experiment-run order, which is stable.
 */
function inputsFor(
  paths: CorpusPaths, docId: string, rows: readonly ResultRow[], modes: ReviewModes,
  contentMatching: ContentMatching
): Pick<ReviewDocument, "images" | "texts" | "inputNotices"> {
  const { blind } = modes;
  const images: ReviewImageInput[] = [];
  const texts: ReviewTextInput[] = [];
  const notices: string[] = [];
  const imagesByHash = new Map<string, ReviewImageInput>();
  const textsByDescriptor = new Map<string, ReviewTextInput>();
  const noticed = new Set<string>();

  /**
   * One notice per distinct representation, however many runs sent it.
   *
   * Both halves are mode-aware. `what` names the variant or the render mode, so a blinded report
   * drops it. The reason is written here from a fixed vocabulary rather than passed through from
   * the reader, because the underlying errors carry absolute paths, image filenames and freshness
   * reasons — a document identifier for a shareable report, a run configuration for a blinded one.
   * `detail` is the unredacted version and only the team-internal report prints it.
   */
  const notice = (what: string, reason: UnavailableInput) => {
    const because = kUnavailableSentences[reason.unavailable];
    const message = blind
      ? `An input this document's runs sent is not shown: ${because}.`
      : `${what} is not shown: ${because}` +
        (reason.detail && !modes.shareable ? ` (${reason.detail})` : "") +
        ". The current file is deliberately not shown in its place — it is not what this run was " +
        "given.";
    if (!noticed.has(message)) {
      noticed.add(message);
      notices.push(message);
    }
  };

  const addText = (descriptor: TextRepresentation) => {
    const key = `${descriptor.variantId} ${descriptor.variantVersion} ${descriptor.sourceContentSha256}`;
    const existing = textsByDescriptor.get(key);
    if (existing) {
      if (!blind) addLabel(existing.labels, descriptor.variantId);
      return;
    }
    const read = readSentText(paths, docId, descriptor);
    if ("unavailable" in read) {
      notice(`The summary sent by variant "${descriptor.variantId}"`, read);
      // Recorded as seen, so a second run over the same descriptor does not repeat the read.
      textsByDescriptor.set(key, { variantId: descriptor.variantId,
        variantVersion: descriptor.variantVersion, markdown: "", labels: [] });
      return;
    }
    const entry: ReviewTextInput = {
      variantId: descriptor.variantId,
      variantVersion: descriptor.variantVersion,
      markdown: read.markdown,
      labels: blind ? [] : [descriptor.variantId]
    };
    textsByDescriptor.set(key, entry);
    texts.push(entry);
  };

  // Several runs usually send the same pictures — an image run, a mixed run and a detail variant all
  // over one render — and reading and hashing a few hundred kilobytes once per row would be work
  // done to reach the same answer.
  const readImages = new Map<string, ReturnType<typeof readSentImages>>();
  const addImages = (descriptor: ImageRepresentation) => {
    // `imageSet` belongs in this key: two runs over one render record the *same* whole-envelope
    // hashes and differ only by the set they sent, so a key without it served a per-tile run's
    // selection to a visual-tiles-only one.
    const key = `${descriptor.modeId} ${descriptor.backendId} ${descriptor.backendVersion} ` +
      `${descriptor.sourceContentSha256} ${descriptor.imageSet ?? "full-document"} ` +
      `${descriptor.imageSha256s.join(",")}`;
    let read = readImages.get(key);
    if (!read) {
      read = readSentImages(paths, docId, descriptor, contentMatching);
      readImages.set(key, read);
    }
    if ("unavailable" in read) {
      notice(`The picture(s) sent by ${imageLabelFor(descriptor)}`, read);
      return;
    }
    for (const { image, bytes } of read.images) {
      const existing = imagesByHash.get(image.sha256);
      if (existing) {
        if (!blind) addLabel(existing.labels, imageLabelFor(descriptor));
        continue;
      }
      const entry: ReviewImageInput = {
        sha256: image.sha256,
        dataUrl: `data:${image.mimeType};base64,${bytes.toString("base64")}`,
        widthPx: image.widthPx,
        heightPx: image.heightPx,
        bytes: image.bytes,
        tileId: modes.shareable ? null : image.tileId,
        labels: blind ? [] : [imageLabelFor(descriptor)]
      };
      imagesByHash.set(image.sha256, entry);
      images.push(entry);
    }
  };

  for (const row of rows) {
    if (row.status === "skipped") continue;
    const representation = row.representation;
    if (representation.kind === "text") {
      addText(representation);
    } else if (representation.kind === "image") {
      addImages(representation);
    } else {
      // A mixed row whose text half was dropped sent no summary, and saying it sent one would be
      // exactly the misdirection this report exists to avoid.
      if (!row.textPartOmitted) addText(representation.text);
      addImages(representation.image);
    }
  }
  return { images, texts, inputNotices: notices };
}

/**
 * Assembles the whole document: the rows, the experiment's run list and the corpus tree in, one
 * renderable model out.
 *
 * Nothing is written here. A `--reuse-key` run's refusals — a key from another corpus, another
 * experiment, another mode or another set of outcomes — are raised from this function, which is why
 * a refused run can be guaranteed to have written nothing.
 */
export function buildReviewModel(options: BuildReviewOptions): ReviewModel {
  const { rows, experiment, paths, modes, existingKey } = options;
  const { current, superseded } = partitionSuperseded(rows);
  const manifest = readManifest(paths);
  const byDocument = currentRowsByDocument(current);
  const manifestById = new Map(manifest.documents.map((entry) => [entry.id, entry]));

  // Manifest order, then anything the results name that the manifest no longer does — dropping
  // those would hide outcomes a run really produced.
  const inManifestOrder = [
    ...manifest.documents.map((entry) => entry.id).filter((docId) => byDocument.has(docId)),
    ...[...byDocument.keys()].filter((docId) => !manifestById.has(docId)).sort()
  ];
  // **Presentation order**: the page groups documents by modality, so manifest order is not the
  // order anyone reads in. Everything numbered or listed downstream — the pseudonyms, the key's
  // document list, the ratings template — is built from this one sequence, so a judge working down
  // the page works down the spreadsheet at the same time. Within a group, manifest order stands.
  const modalityOf = (docId: string) => byDocument.get(docId)!.values().next().value!.modality;
  const docIds = modalities.flatMap(
    (modality) => inManifestOrder.filter((docId) => modalityOf(docId) === modality));
  const known = new Set(experiment.runs.map((run) => run.id));
  /** Every document's rows in experiment-file order — the order the header lists runs in. */
  const rowsByDocument = new Map(docIds.map((docId) => {
    const forDocument = byDocument.get(docId)!;
    const ordered = experiment.runs
      .map((run) => forDocument.get(run.id))
      .filter((row): row is ResultRow => row !== undefined);
    // A row for a run the experiment does not define can only come from a hand-edited file. It is
    // still an outcome, so it is shown after the defined ones rather than dropped.
    const extra = [...forDocument.values()]
      .filter((row) => !known.has(row.runId))
      .sort((a, b) => a.runId.localeCompare(b.runId));
    return [docId, [...ordered, ...extra]] as const;
  }));

  const counts = { success: 0, refusal: 0, error: 0, skipped: 0 };
  const judgeable: ReviewKeyPair[] = [];
  for (const docId of docIds) {
    for (const row of rowsByDocument.get(docId)!) {
      counts[row.status] += 1;
      if (row.status !== "skipped") {
        judgeable.push({ docId, runId: row.runId, fingerprint: judgeableFingerprint(row) });
      }
    }
  }

  const pseudonyms: Record<string, string> = {};
  docIds.forEach((docId, index) => {
    pseudonyms[docId] = `doc-${String(index + 1).padStart(2, "0")}`;
  });

  // Checked before a single file is read, let alone written: a `--reuse-key` run over a different
  // corpus, experiment, mode or set of outcomes is refused here.
  if (existingKey) {
    assertKeyIsReusable(existingKey.key, {
      corpus: manifest.name,
      experimentSha256: options.experimentSha256,
      modes,
      documents: docIds,
      judgeable,
      pseudonyms: modes.shareable ? pseudonyms : null
    }, existingKey.file);
  }

  // Every prompt hash each run's current rows carry, not just the last one — and only from the rows
  // that actually sent a request. A skipped row records the prompt its run *would* have used, but it
  // produced no card, so letting it disagree would flag a run whose every card came from one prompt.
  const promptShasByRun = new Map<string, Set<string>>();
  for (const row of current) {
    if (row.status === "skipped") continue;
    const shas = promptShasByRun.get(row.runId) ?? new Set<string>();
    shas.add(row.prompt.sha256);
    promptShasByRun.set(row.runId, shas);
  }
  const configurations = experiment.runs.map(
    (run) => configurationFor(run, promptShasByRun.get(run.id) ?? new Set()));
  const configurationById = new Map(configurations.map((entry) => [entry.runId, entry]));

  const seed = existingKey?.key.seed ?? options.seed;
  const labels: Record<string, Record<string, string>> = {};

  const documents: ReviewDocument[] = docIds.map((docId) => {
    const rowsForDocument = rowsByDocument.get(docId)!;
    const sent = rowsForDocument.filter((row) => row.status !== "skipped");
    const cards = sent.map(
      (row) => cardFor(row, configurationById.get(row.runId) ?? null, modes));

    if (modes.blind) {
      // A reused key's own mapping is applied rather than re-derived. Re-deriving from its seed
      // would give the same answer — that is what the seed is for — but reading back the mapping the
      // judge was actually shown removes the question, and a hand-edited key cannot then produce a
      // report whose labels disagree with the file that decodes it.
      const labelByRun = existingKey?.key.labels
        ? new Map(Object.entries(existingKey.key.labels[docId] ?? {})
          .map(([label, runId]) => [runId, label]))
        : blindLabelsFor(seed, docId, sent.map((row) => row.runId));
      cards.forEach((card, index) => {
        card.label = labelByRun.get(sent[index].runId)!;
      });
      // Presented in label order. Leaving them in experiment order with shuffled letters attached
      // would hand the mapping straight back to anyone who knows the run list.
      cards.sort((a, b) => compareLabels(a.label!, b.label!));
      // A document with nothing to judge gets no entry at all, rather than an empty one: the key
      // maps labels, and there are no labels here.
      if (labelByRun.size > 0) {
        labels[docId] = Object.fromEntries(
          [...labelByRun.entries()].map(([runId, label]) => [label, runId]));
      }
    }

    const entry = manifestById.get(docId) ?? null;
    const first = rowsForDocument[0];
    return {
      docId,
      displayName: modes.shareable ? pseudonyms[docId] : docId,
      modality: first.modality,
      computedModality: first.computedModality,
      overridden: first.modality !== first.computedModality,
      metadata: modes.shareable || !entry ? null : metadataFor(entry),
      missingFromManifest: !entry,
      ...inputsFor(paths, docId, rowsForDocument, modes, contentMatchingFor(paths, entry)),
      cards,
      skipped: rowsForDocument
        .filter((row): row is ResultRow & { status: "skipped" } => row.status === "skipped")
        .map((row) => ({
          runId: modes.blind ? null : row.runId,
          skipReasons: modes.blind || modes.shareable ? [] : row.skipReasons
        }))
    };
  });

  return {
    generatedAt: options.now.toISOString(),
    corpus: manifest.name,
    experimentName: experiment.name,
    experimentSha256: options.experimentSha256,
    resultsFile: modes.shareable ? null : options.resultsFile,
    gitCommit: modes.shareable ? null : current[current.length - 1]?.runMeta.gitCommit ?? null,
    modes,
    runs: modes.blind ? null : configurations,
    runCount: experiment.runs.length,
    counts,
    supersededRows: superseded.length,
    groups: groupByModality(documents),
    documents,
    judgeable,
    pseudonyms: modes.shareable ? pseudonyms : null,
    seed: modes.blind ? seed : null,
    labels: modes.blind ? labels : null
  };
}

/**
 * Reads a document's content back, but hands it over only when it still hashes to what the run was
 * given — and reads it at most once per document however many rows ask.
 *
 * A document edited since the run classifies differently, so using it to work out which tiles a
 * `visual-tiles-only` run sent would produce a confident, wrong answer. The report says it cannot
 * tell instead.
 */
function contentMatchingFor(paths: CorpusPaths, entry: ManifestDocument | null): ContentMatching {
  let loaded: { content: unknown } | null | undefined;
  return (sourceContentSha256: string) => {
    if (loaded === undefined) {
      try {
        loaded = entry ? { content: readCorpusDocument(paths, entry) } : null;
      } catch {
        loaded = null;
      }
    }
    if (!loaded) return null;
    return sha256Canonical(loaded.content) === sourceContentSha256 ? loaded.content : null;
  };
}

function metadataFor(entry: ManifestDocument): ReviewDocumentMetadata {
  return {
    unit: entry.unit,
    investigation: entry.investigation,
    problem: entry.problem,
    contextId: entry.contextId,
    source: entry.source,
    file: entry.file
  };
}

function cardFor(
  row: ResultRow, configuration: ReviewRunConfiguration | null, modes: ReviewModes
): ReviewCard {
  if (row.status === "skipped") throw new Error("A skipped row is not a judgeable card");
  const { blind } = modes;
  return {
    docId: row.docId,
    runId: blind ? null : row.runId,
    label: null,
    status: row.status,
    configuration: blind ? null : configuration,
    outcome: outcomeFor(row),
    usage: blind || !row.usage ? null : { ...row.usage },
    modeledUsd: blind || !row.cost ? null : row.cost.modeledUsd,
    promptSha256: blind ? null : row.prompt.sha256,
    textPartOmitted: row.textPartOmitted === true,
    // Only the team-internal report carries these. They name the run's shape and the tile ids it
    // could not photograph, which are a configuration in a blinded report and a document identifier
    // in a shareable one.
    representationWarnings: blind || modes.shareable ? [] : row.representationWarnings ?? []
  };
}

/**
 * Documents grouped the way `report` groups rows: by the modality each row was filed under.
 *
 * `documents` is already in presentation order, so this only partitions it — the groups appear in
 * the order the documents do, and flattening the groups gives back exactly the input sequence.
 */
function groupByModality(documents: ReviewDocument[]): ReviewModel["groups"] {
  return modalities
    .map((modality) => ({
      modality,
      documents: documents.filter((document) => document.modality === modality)
    }))
    .filter((group) => group.documents.length > 0);
}

// ---------------------------------------------------------------------------
// The key file
// ---------------------------------------------------------------------------

export function reviewKeyFileFor(model: ReviewModel): ReviewKeyFile {
  return {
    schemaVersion: kSchemaVersion,
    generatedAt: model.generatedAt,
    corpus: model.corpus,
    experiment: model.experimentName,
    experimentSha256: model.experimentSha256,
    modes: { ...model.modes },
    documents: model.documents.map((document) => document.docId),
    judgeable: model.judgeable,
    pseudonyms: model.pseudonyms,
    seed: model.seed,
    labels: model.labels
  };
}

function pairsOf(pairs: ReviewKeyPair[]): string[] {
  return pairs.map((pair) => `${pair.docId} ${pair.runId}`).sort();
}

/** The outcomes whose row has changed since the key was written, by (document, run). */
function movedOutcomes(key: ReviewKeyFile, facts: ReviewKeyFacts): string[] {
  const stored = new Map(key.judgeable.map((pair) => [`${pair.docId} ${pair.runId}`, pair.fingerprint]));
  return facts.judgeable
    .filter((pair) => stored.get(`${pair.docId} ${pair.runId}`) !== pair.fingerprint)
    .map((pair) => `${pair.docId}/${pair.runId}`)
    .sort();
}

/** What a key has to agree with before it may be reused. */
export interface ReviewKeyFacts {
  corpus: string;
  experimentSha256: string;
  modes: ReviewModes;
  /** Presentation order, which is what the pseudonyms number. */
  documents: string[];
  judgeable: ReviewKeyPair[];
  /** The mapping this invocation would produce; `null` when the report is not shareable. */
  pseudonyms: Record<string, string> | null;
}

export function reviewKeyFactsOf(model: ReviewModel): ReviewKeyFacts {
  return {
    corpus: model.corpus,
    experimentSha256: model.experimentSha256,
    modes: model.modes,
    documents: model.documents.map((document) => document.docId),
    judgeable: model.judgeable,
    pseudonyms: model.pseudonyms
  };
}

/**
 * Whether an existing key may be reused for this invocation: same corpus, same experiment
 * definition, same modes, same documents in the same order, same judgeable outcomes.
 *
 * Anything less and the labels would mean something different from what the judge was shown: a
 * document added, a run re-run into a new outcome, a mode flag changed, the pseudonyms renumbered.
 * Same inputs, same labels and pseudonyms, or nothing.
 */
export function assertKeyIsReusable(
  key: ReviewKeyFile, facts: ReviewKeyFacts, keyFile: string
): void {
  const refuse = (what: string, wasOver: string, isOver: string): never => {
    throw new Error(`${keyFile} cannot be reused: it was generated over ${what} ${wasOver}, and this ` +
      `report covers ${isOver}. Reusing it would put labels a judge has already seen on different ` +
      "outcomes. Generate a fresh report with a different --out.");
  };
  if (key.corpus !== facts.corpus) refuse("corpus", key.corpus, facts.corpus);
  if (key.experimentSha256 !== facts.experimentSha256) {
    refuse("experiment definition", key.experimentSha256, facts.experimentSha256);
  }
  if (key.modes.shareable !== facts.modes.shareable || key.modes.blind !== facts.modes.blind) {
    refuse("modes", `shareable=${key.modes.shareable}, blind=${key.modes.blind}`,
      `shareable=${facts.modes.shareable}, blind=${facts.modes.blind}`);
  }
  if (key.documents.join(" ") !== facts.documents.join(" ")) {
    refuse("documents", `${key.documents.length} of them`,
      `${facts.documents.length}, with different ids or in a different order`);
  }
  const stored = pairsOf(key.judgeable);
  const now = pairsOf(facts.judgeable);
  if (stored.join(" ") !== now.join(" ")) {
    refuse("judgeable outcomes", `${stored.length} of them`, `${now.length}`);
  }
  // Same pairs, different outcomes: a re-run has replaced a row since the key was written. The
  // labels would survive onto answers nobody rated, and the ratings template — which `--reuse-key`
  // preserves byte for byte — would go on describing the outcomes it replaced.
  const moved = movedOutcomes(key, facts);
  if (moved.length > 0) {
    throw new Error(`${keyFile} cannot be reused: ${moved.length} outcome(s) have been re-run ` +
      `since it was written (${moved.slice(0, 3).join(", ")}${moved.length > 3 ? ", …" : ""}). ` +
      "Its labels would sit on answers nobody has read, and any ratings collected against them " +
      "would describe the outcomes those answers replaced. Generate a fresh report with a " +
      "different --out.");
  }
  // The pseudonyms are numbered from the presentation order, which the document check above has
  // already pinned — but the key's own mapping is what a reader holding it will decode with, and
  // nothing else compares the two. A key naming `doc-99` for a report that says `doc-01` decodes
  // nothing, however well formed it is.
  if (facts.pseudonyms) {
    const expected = canonicalJson(facts.pseudonyms);
    if (canonicalJson(key.pseudonyms ?? {}) !== expected) {
      throw new Error(`${keyFile} cannot be reused: its pseudonyms are not the ones this report ` +
        "renders, so it would not decode them.");
    }
  }
  if (!key.labels) return;
  // The stored labels are what a reused report is rendered from, so a key that does not label
  // exactly this set — one label per outcome, one outcome per label — is refused rather than
  // half-applied. Counting labels as well as runs is what catches a second label aliased onto a run
  // that is already mapped: the set of runs would look complete while the extra label decided,
  // silently, which one the report actually showed.
  for (const docId of facts.documents) {
    const forDocument = key.labels[docId] ?? {};
    const labelled = new Set(Object.values(forDocument));
    const expected = facts.judgeable.filter((pair) => pair.docId === docId);
    if (Object.keys(forDocument).length !== expected.length ||
        labelled.size !== expected.length ||
        !expected.every((pair) => labelled.has(pair.runId))) {
      throw new Error(`${keyFile} cannot be reused: its labels for document "${docId}" do not ` +
        "cover exactly the outcomes this report renders, one label each.");
    }
  }
}

// ---------------------------------------------------------------------------
// The ratings template
// ---------------------------------------------------------------------------

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * One row per judgeable card, and nothing else.
 *
 * Milestone 5 defines the rubric and the command that reads this back; all this milestone
 * guarantees is that a judge has somewhere to write answers that a program can later read. Inventing
 * rubric columns here would fix a rubric nobody has agreed on yet.
 */
export function ratingsTemplateCsv(model: ReviewModel): string {
  const lines = ["document,label,rating,notes"];
  for (const document of model.documents) {
    for (const card of document.cards) {
      lines.push([document.displayName, card.label ?? "", "", ""].map(csvField).join(","));
    }
  }
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const kStyles = `
  :root { color-scheme: light; }
  body { margin: 0; padding: 0 1.5rem 4rem; color: #1b1b1b; background: #fff;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  h1 { font-size: 1.5rem; margin: 1.5rem 0 0.5rem; }
  h2 { font-size: 1.2rem; margin: 2.5rem 0 0.5rem; padding-bottom: 0.25rem;
    border-bottom: 2px solid #1b1b1b; }
  h3 { font-size: 1.05rem; margin: 0 0 0.25rem; }
  h4 { font-size: 0.85rem; margin: 1rem 0 0.5rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: #555; }
  .meta { color: #555; font-size: 0.85rem; }
  .meta dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.15rem 0.75rem; margin: 0.5rem 0; }
  .meta dt { font-weight: 600; }
  .meta dd { margin: 0; }
  table { border-collapse: collapse; font-size: 0.85rem; margin: 0.5rem 0; }
  th, td { border: 1px solid #d4d4d4; padding: 0.2rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  .document { border: 1px solid #c8c8c8; border-radius: 6px; padding: 1rem 1.25rem;
    margin: 1.25rem 0; break-inside: avoid; }
  .document-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.75rem; }
  .inputs { margin: 0.75rem 0; }
  .input-block { margin: 0 0 1rem; }
  .input-label { font-size: 0.8rem; color: #555; margin: 0 0 0.25rem; }
  img { max-width: 100%; height: auto; border: 1px solid #d4d4d4; background: #fbfbfb; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f7f7f7;
    border: 1px solid #e2e2e2; border-radius: 4px; padding: 0.6rem 0.75rem; margin: 0;
    font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; max-height: 32rem;
    overflow-y: auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 0.75rem; }
  .card { border: 1px solid #c8c8c8; border-radius: 5px; padding: 0.6rem 0.75rem; background: #fcfcfc; }
  .card-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem;
    border-bottom: 1px solid #e2e2e2; padding-bottom: 0.35rem; margin-bottom: 0.5rem; }
  .card-title { font-weight: 700; }
  .card-config { color: #555; font-size: 0.8rem; }
  .field { margin: 0.4rem 0; }
  .field-name { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
  .badge { display: inline-block; border-radius: 999px; padding: 0.05rem 0.5rem; font-size: 0.75rem;
    font-weight: 700; border: 1px solid; }
  .badge-success { color: #1c5d2c; border-color: #1c5d2c; background: #eaf6ec; }
  .badge-refusal { color: #8a5b00; border-color: #8a5b00; background: #fdf3e0; }
  .badge-error { color: #8a1c1c; border-color: #8a1c1c; background: #fbecec; }
  .badge-skipped { color: #444; border-color: #999; background: #f0f0f0; }
  .badge-flag { color: #8a1c1c; border-color: #8a1c1c; background: #fbecec; }
  .notice { border-left: 4px solid #8a5b00; background: #fdf3e0; padding: 0.4rem 0.6rem;
    margin: 0.4rem 0; font-size: 0.85rem; }
  .skipped-strip { margin-top: 1rem; border-top: 1px dashed #b0b0b0; padding-top: 0.6rem;
    color: #444; font-size: 0.85rem; }
  .skipped-strip ul { margin: 0.25rem 0; padding-left: 1.25rem; }
  ul.indicators { margin: 0.2rem 0; padding-left: 1.25rem; }
`;

function shortSha(sha256: string): string {
  return sha256.slice(0, 12);
}

/** Picture sizes span three orders of magnitude here, and "0 KB" describes none of them. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: "success" | "refusal" | "error" | "skipped"): Html {
  return html`<span class="badge badge-${status}">${status}</span>`;
}

/**
 * What the header says about a run's prompt: its hash, or that its rows do not agree on one.
 *
 * The mixed case is not a failure — it is a results file that holds a prompt edit part-way through —
 * but the report must not paper over it, because the run's cards are then not all comparable with
 * each other. Each card names its own prompt when this fires.
 */
function promptVersionNote(run: ReviewRunConfiguration): Html {
  if (run.promptSha256) return html` <span class="meta">(${shortSha(run.promptSha256)})</span>`;
  if (run.promptVersions > 1) {
    return html` <span class="badge badge-flag">${run.promptVersions} versions — see each card</span>`;
  }
  return html``;
}

function runTable(runs: ReviewRunConfiguration[]): Html {
  const cell = (value: string | null) => html`<td>${value ?? "—"}</td>`;
  return html`
    <table>
      <thead><tr><th>run</th><th>message</th><th>text variant</th><th>image mode</th><th>detail</th>
        <th>image set</th><th>extras</th><th>prompt</th></tr></thead>
      <tbody>
        ${runs.map((run) => html`<tr>
          <td>${run.runId}</td>
          <td>${run.message}</td>
          ${cell(run.textVariant)}
          ${cell(run.imageMode)}
          ${cell(run.detail)}
          ${cell(run.imageSet)}
          ${cell(run.extras)}
          <td>${run.promptName}${promptVersionNote(run)}</td>
        </tr>`)}
      </tbody>
    </table>`;
}

function headerBlock(model: ReviewModel): Html {
  const { counts } = model;
  return html`
    <h1>Review: ${model.corpus}</h1>
    <div class="meta">
      <dl>
        <dt>Experiment</dt>
        <dd>${model.experimentName} (${shortSha(model.experimentSha256)})</dd>
        <dt>Documents</dt>
        <dd>${model.documents.length}</dd>
        <dt>Outcomes</dt>
        <dd>${counts.success} success, ${counts.refusal} refusal, ${counts.error} error,
          ${counts.skipped} skipped${model.supersededRows > 0
            ? html`; ${model.supersededRows} superseded row(s) replaced by a later re-run and not
              shown`
            : ""}</dd>
        <dt>Generated</dt>
        <dd>${model.generatedAt}</dd>
        ${model.resultsFile ? html`<dt>Results</dt><dd>${model.resultsFile}</dd>` : ""}
        ${model.gitCommit ? html`<dt>Harness commit</dt><dd>${model.gitCommit}</dd>` : ""}
      </dl>
    </div>
    ${model.runs
      ? html`<h4>Runs, in experiment-file order</h4>${runTable(model.runs)}`
      : html`<p class="meta">${model.runCount} run(s). Which configuration produced which output is
          withheld: this is a blinded report, and the mapping is in its key file.</p>`}
    ${model.modes.shareable
      ? html`<p class="notice">Shareable: document ids are replaced by per-report pseudonyms and
          harness metadata is omitted. <strong>Document content is not redacted</strong> — the
          summaries, pictures and model outputs below can themselves contain identifying
          information.</p>`
      : ""}`;
}

function inputsBlock(document: ReviewDocument): Html {
  return html`
    <div class="inputs">
      <h4>What the model was given</h4>
      ${document.inputNotices.map((message) => html`<p class="notice">${message}</p>`)}
      ${document.images.map((image, index) => html`
        <div class="input-block">
          <p class="input-label">Image ${index + 1} of ${document.images.length}${image.tileId
            ? html`, tile ${image.tileId}`
            : ""}${image.labels.length > 0 ? html` — ${image.labels.join("; ")}` : ""}
            (${image.widthPx}×${image.heightPx}, ${formatBytes(image.bytes)})</p>
          <img src="${image.dataUrl}" alt="Rendered document ${document.displayName}, image ${index + 1}">
        </div>`)}
      ${document.texts.map((text, index) => html`
        <div class="input-block">
          <p class="input-label">Summary ${index + 1} of ${document.texts.length}${text.labels.length > 0
            ? html` — variant ${text.labels.join("; ")}`
            : ""}</p>
          <pre>${text.markdown}</pre>
        </div>`)}
      ${document.images.length === 0 && document.texts.length === 0
        ? html`<p class="meta">No input is available to show for this document.</p>`
        : ""}
    </div>`;
}

function configurationLine(configuration: ReviewRunConfiguration): string {
  const parts: string[] = [configuration.message];
  if (configuration.textVariant) parts.push(configuration.textVariant);
  if (configuration.imageMode) parts.push(configuration.imageMode);
  if (configuration.detail) parts.push(`detail ${configuration.detail}`);
  if (configuration.imageSet) parts.push(configuration.imageSet);
  if (configuration.extras) parts.push(`extras ${configuration.extras}`);
  parts.push(configuration.promptName);
  return parts.join(" · ");
}

function outcomeBlock(outcome: ReviewOutcome): Html {
  if (outcome.kind === "refusal") {
    return html`<div class="field"><div class="field-name">refusal</div><pre>${outcome.refusal}</pre></div>`;
  }
  if (outcome.kind === "error") {
    return html`
      <div class="field">
        <div class="field-name">error</div>
        <pre>${outcome.type}: ${outcome.message}
attempts: ${outcome.attempts}</pre>
      </div>`;
  }
  return html`
    ${outcome.category !== null
      ? html`<div class="field"><div class="field-name">category</div><div>${outcome.category}</div></div>`
      : ""}
    ${outcome.keyIndicators
      ? html`<div class="field"><div class="field-name">key indicators</div>
          ${outcome.keyIndicators.length > 0
            // An empty list is a real answer — the model returned the field and put nothing in it —
            // so it is said rather than drawn as an empty bullet list.
            ? html`<ul class="indicators">${outcome.keyIndicators.map((item) => html`<li>${item}</li>`)}</ul>`
            : html`<div class="meta">none listed</div>`}</div>`
      : ""}
    ${outcome.discussion !== null
      ? html`<div class="field"><div class="field-name">discussion</div><div>${outcome.discussion}</div></div>`
      : ""}
    ${outcome.remainingJson
      ? html`<div class="field"><div class="field-name">other response fields</div>
          <pre>${outcome.remainingJson}</pre></div>`
      : ""}
    ${outcome.category === null && !outcome.keyIndicators && outcome.discussion === null &&
      !outcome.remainingJson
      ? html`<p class="meta">The response parsed to an empty object.</p>`
      : ""}`;
}

function cardBlock(card: ReviewCard): Html {
  return html`
    <div class="card">
      <div class="card-header">
        <span class="card-title">${card.label ?? card.runId}</span>
        ${statusBadge(card.status)}
        ${card.textPartOmitted
          ? html`<span class="badge badge-flag">no summary sent</span>`
          : ""}
      </div>
      ${card.configuration
        ? html`<p class="card-config">${configurationLine(card.configuration)}${
          // Only where the run's rows disagree: on every other card this would be the same hash the
          // header already carries, repeated once per card for nothing.
          card.configuration.promptVersions > 1 && card.promptSha256
            ? html` · <strong>prompt ${shortSha(card.promptSha256)}</strong>`
            : ""}</p>`
        : ""}
      ${card.textPartOmitted
        ? html`<p class="notice">This document carried no student-authored text, so the summary and
            related summaries were dropped: this output saw the picture(s) only.</p>`
        : ""}
      ${outcomeBlock(card.outcome)}
      ${card.representationWarnings.map((warning) => html`<p class="notice">${warning}</p>`)}
      ${card.usage
        ? html`<p class="card-config">${[
          `${card.usage.promptTokens} in / ${card.usage.completionTokens} out tokens`,
          card.modeledUsd === null ? null : `$${card.modeledUsd.toFixed(4)} modeled`,
          card.usage.source === "cache" ? "from cache" : "fresh call"
        ].filter(Boolean).join(" · ")}</p>`
        : ""}
    </div>`;
}

function documentBlock(document: ReviewDocument): Html {
  return html`
    <article class="document">
      <div class="document-header">
        <h3>${document.displayName}</h3>
        ${document.overridden
          ? html`<span class="badge badge-flag">modality overridden (classifier said
              ${document.computedModality})</span>`
          : ""}
        ${document.missingFromManifest
          ? html`<span class="badge badge-flag">no longer in the corpus manifest</span>`
          : ""}
      </div>
      ${document.metadata
        ? html`<p class="meta">${[
          document.metadata.unit && `unit ${document.metadata.unit}`,
          document.metadata.investigation && `investigation ${document.metadata.investigation}`,
          document.metadata.problem && `problem ${document.metadata.problem}`,
          document.metadata.contextId && `class ${document.metadata.contextId}`,
          `source ${document.metadata.source}`,
          document.metadata.file
        ].filter(Boolean).join(" · ")}</p>`
        : ""}
      ${inputsBlock(document)}
      <h4>What each run said</h4>
      ${document.cards.length > 0
        ? html`<div class="cards">${document.cards.map(cardBlock)}</div>`
        : html`<p class="meta">No run produced an outcome for this document.</p>`}
      ${document.skipped.length > 0
        ? html`
          <div class="skipped-strip">
            <div><strong>${document.skipped.length} run(s) declined to send this document</strong>
              ${statusBadge("skipped")} — nothing was produced, so there is nothing to judge here.</div>
            ${document.skipped.some((entry) => entry.skipReasons.length > 0)
              ? html`<ul>
                ${document.skipped.map((entry) => html`<li>${entry.runId
                  ? html`<strong>${entry.runId}</strong>: `
                  : ""}${entry.skipReasons.join("; ")}</li>`)}
              </ul>`
              // A skip reason carries a run's configuration and, through `imagesForSet` and
              // `expectedRenderFailure`, tile ids and author-written prose.
              : html`<div>Why each one declined is withheld: the reasons name run configurations and
                  can quote identifiers from the document.</div>`}
          </div>`
        : ""}
    </article>`;
}

/**
 * One self-contained, inert file: inline CSS, **no JavaScript**, images as `data:` URLs, no external
 * reference of any kind.
 *
 * The CSP meta tag should be redundant — there is no script to run and nothing to fetch. It is there
 * so that a bug in the escaping above still cannot reach the network.
 */
export function renderReviewHtml(model: ReviewModel): string {
  const title = `Review: ${model.corpus} / ${model.experimentName}` +
    `${model.modes.blind ? " (blind)" : ""}${model.modes.shareable ? " (shareable)" : ""}`;
  const page = html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>${title}</title>
<!-- The one place a fragment is built from a plain string. \`kStyles\` is a constant in this file
     with nothing interpolated into it; escaping it would break the CSS rather than protect it. -->
<style>${new HtmlFragment(kStyles)}</style>
</head>
<body>
${headerBlock(model)}
${model.groups.map((group) => html`
<h2>${group.modality} (${group.documents.length} document(s))</h2>
${group.documents.map(documentBlock)}`)}
</body>
</html>
`;
  return page.markup;
}
