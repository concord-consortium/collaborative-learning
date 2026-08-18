/**
 * Types, runtime validators and the canonical serialization used by every hash in the harness.
 *
 * Every on-disk format carries `schemaVersion: 1`. Validators run on every read and throw a
 * `ValidationError` naming the file and the offending field.
 */
import { createHash } from "node:crypto";

export const kSchemaVersion = 1;

/**
 * Result rows are version 2; every other on-disk format is version 1.
 *
 * Version-1 rows carried a required `textVariant` string, which an image-only row has nothing
 * honest to put in. It is replaced by a `representation` descriptor that both kinds populate — so a
 * version-1 row cannot be read as a version-2 one, and is refused with an instruction to re-run
 * rather than being silently mis-read.
 */
export const kResultSchemaVersion = 2;

// ---------------------------------------------------------------------------
// Canonical serialization
// ---------------------------------------------------------------------------

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) result[key] = canonicalize(source[key]);
    }
    return result;
  }
  return value;
}

/** Deterministic JSON: object keys sorted recursively, no whitespace, `undefined` members dropped. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? "null";
}

/** The one hash function the harness uses. "sha256 of X" always means this unless it says "file bytes". */
export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(public readonly file: string, public readonly field: string, detail: string) {
    super(`${file}: ${field} ${detail}`);
    this.name = "ValidationError";
  }
}

function fail(file: string, field: string, detail: string): never {
  throw new ValidationError(file, field, detail);
}

function asObject(value: unknown, file: string, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(file, field, `must be an object, got ${describe(value)}`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, file: string, field: string): unknown[] {
  if (!Array.isArray(value)) fail(file, field, `must be an array, got ${describe(value)}`);
  return value;
}

function asString(value: unknown, file: string, field: string): string {
  if (typeof value !== "string") fail(file, field, `must be a string, got ${describe(value)}`);
  return value;
}

function asOptionalString(value: unknown, file: string, field: string): string | null {
  if (value === undefined || value === null) return null;
  return asString(value, file, field);
}

function asBoolean(value: unknown, file: string, field: string): boolean {
  if (typeof value !== "boolean") fail(file, field, `must be a boolean, got ${describe(value)}`);
  return value;
}

function asNumber(value: unknown, file: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(file, field, `must be a finite number, got ${describe(value)}`);
  }
  return value;
}

/** A negative price would make the reservation ledger under-count instead of over-count. */
function asNonNegativeNumber(value: unknown, file: string, field: string): number {
  const parsed = asNumber(value, file, field);
  if (parsed < 0) fail(file, field, `must not be negative, got ${parsed}`);
  return parsed;
}

/** The completion cap is what turns the reservation into a real bound, so it has to be a real cap. */
function asPositiveInteger(value: unknown, file: string, field: string): number {
  const parsed = asNumber(value, file, field);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(file, field, `must be a positive integer, got ${describe(value)}`);
  }
  return parsed;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], file: string, field: string): T {
  const text = asString(value, file, field);
  if (!allowed.includes(text as T)) {
    fail(file, field, `must be one of ${allowed.join(", ")}, got "${text}"`);
  }
  return text as T;
}

function checkSchemaVersion(record: Record<string, unknown>, file: string): void {
  if (record.schemaVersion !== kSchemaVersion) {
    fail(file, "schemaVersion", `must be ${kSchemaVersion}, got ${describe(record.schemaVersion)}`);
  }
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value === "object" ? "an object" : JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Corpus manifest
// ---------------------------------------------------------------------------

export const modalities = ["text-only", "visual-only", "mixed", "empty"] as const;
export type Modality = typeof modalities[number];

export const corpusSources = ["synthetic", "demo", "qa", "production"] as const;
export type CorpusSource = typeof corpusSources[number];

/** Recorded when a production document is pulled. Always `null` until the `pull` command exists. */
export interface HistoricalAnalysis {
  summarizer: string;
  promptTokens: number;
  completionTokens: number;
  response: unknown;
  analyzedAt: string;
  /** The document hash the historical analysis actually ran against, when it is known. */
  contentSha256?: string;
}

export interface RelatedSummaryEntry {
  summary: string;
  agreements: Record<string, { content: string; tags: string[] }[]>;
}

export interface ManifestDocument {
  id: string;
  file: string;
  source: CorpusSource;
  contentSha256: string;
  retrievedAt: string | null;
  unit: string | null;
  investigation: string | null;
  problem: string | null;
  contextId: string | null;
  /** Always recomputed by `import` from the current content. */
  computedModality: Modality;
  /** Only ever set by a human; tooling never writes it. */
  modalityOverride: Modality | null;
  labels: Record<string, unknown>;
  relatedSummaries: RelatedSummaryEntry[];
  historical: HistoricalAnalysis | null;
}

export interface CorpusManifest {
  schemaVersion: number;
  name: string;
  createdAt: string;
  documents: ManifestDocument[];
}

export const kDocumentIdPattern = /^[a-z0-9-]+$/;

export function validateCorpusManifest(value: unknown, file: string): CorpusManifest {
  const record = asObject(value, file, "manifest");
  checkSchemaVersion(record, file);
  const documents = asArray(record.documents, file, "documents").map((entry, index) =>
    validateManifestDocument(entry, file, `documents[${index}]`));
  const seen = new Set<string>();
  for (const document of documents) {
    if (seen.has(document.id)) fail(file, "documents", `contains duplicate document id "${document.id}"`);
    seen.add(document.id);
  }
  return {
    schemaVersion: kSchemaVersion,
    name: asString(record.name, file, "name"),
    createdAt: asString(record.createdAt, file, "createdAt"),
    documents
  };
}

function validateManifestDocument(value: unknown, file: string, field: string): ManifestDocument {
  const record = asObject(value, file, field);
  const id = asString(record.id, file, `${field}.id`);
  if (!kDocumentIdPattern.test(id)) {
    fail(file, `${field}.id`, `must match ${kDocumentIdPattern}, got "${id}"`);
  }
  return {
    id,
    file: asString(record.file, file, `${field}.file`),
    source: asEnum(record.source, corpusSources, file, `${field}.source`),
    contentSha256: asString(record.contentSha256, file, `${field}.contentSha256`),
    retrievedAt: asOptionalString(record.retrievedAt, file, `${field}.retrievedAt`),
    unit: asOptionalString(record.unit, file, `${field}.unit`),
    investigation: asOptionalString(record.investigation, file, `${field}.investigation`),
    problem: asOptionalString(record.problem, file, `${field}.problem`),
    contextId: asOptionalString(record.contextId, file, `${field}.contextId`),
    computedModality: asEnum(record.computedModality, modalities, file, `${field}.computedModality`),
    modalityOverride: record.modalityOverride == null
      ? null
      : asEnum(record.modalityOverride, modalities, file, `${field}.modalityOverride`),
    labels: record.labels == null ? {} : asObject(record.labels, file, `${field}.labels`),
    relatedSummaries: record.relatedSummaries == null
      ? []
      : asArray(record.relatedSummaries, file, `${field}.relatedSummaries`)
        .map((entry, index) => validateRelatedSummary(entry, file, `${field}.relatedSummaries[${index}]`)),
    historical: record.historical == null
      ? null
      : validateHistoricalAnalysis(record.historical, file, `${field}.historical`)
  };
}

/**
 * Related summaries are not yet injected into request construction, and the manifest is
 * exactly the file a human hand-edits, so these are checked rather than cast.
 */
function validateRelatedSummary(value: unknown, file: string, field: string): RelatedSummaryEntry {
  const record = asObject(value, file, field);
  const agreements = asObject(record.agreements, file, `${field}.agreements`);
  const validated: RelatedSummaryEntry["agreements"] = {};
  for (const [agreementValue, entries] of Object.entries(agreements)) {
    const agreementField = `${field}.agreements.${agreementValue}`;
    validated[agreementValue] = asArray(entries, file, agreementField).map((entry, index) => {
      const info = asObject(entry, file, `${agreementField}[${index}]`);
      return {
        content: asString(info.content, file, `${agreementField}[${index}].content`),
        tags: asArray(info.tags, file, `${agreementField}[${index}].tags`)
          .map((tag, tagIndex) => asString(tag, file, `${agreementField}[${index}].tags[${tagIndex}]`))
      };
    });
  }
  return { summary: asString(record.summary, file, `${field}.summary`), agreements: validated };
}

function validateHistoricalAnalysis(value: unknown, file: string, field: string): HistoricalAnalysis {
  const record = asObject(value, file, field);
  const historical: HistoricalAnalysis = {
    summarizer: asString(record.summarizer, file, `${field}.summarizer`),
    promptTokens: asNumber(record.promptTokens, file, `${field}.promptTokens`),
    completionTokens: asNumber(record.completionTokens, file, `${field}.completionTokens`),
    response: record.response,
    analyzedAt: asString(record.analyzedAt, file, `${field}.analyzedAt`)
  };
  if (record.contentSha256 !== undefined) {
    historical.contentSha256 = asString(record.contentSha256, file, `${field}.contentSha256`);
  }
  return historical;
}

/** The modality reports and result rows use: the human override when present, otherwise the computed one. */
export function effectiveModality(document: ManifestDocument): Modality {
  return document.modalityOverride ?? document.computedModality;
}

// ---------------------------------------------------------------------------
// Prompt file
// ---------------------------------------------------------------------------

export interface AiPromptData {
  systemPrompt: string;
  mainPrompt: string;
  categorizationDescription?: string;
  categories?: string[];
  keyIndicatorsPrompt?: string;
  discussionPrompt?: string;
}

export interface PromptFile {
  schemaVersion: number;
  name: string;
  aiPrompt: AiPromptData;
  provenance: {
    source: string;
    retrievedAt: string;
    aiPromptSha256: string;
  };
}

/**
 * Every field is checked, not just the two required ones. `categories` matters most: a *string* there
 * passes a loose check and then gets spread character-by-character into the Zod enum, producing a
 * schema that looks valid and asks the model for entirely the wrong categories.
 */
export function validateAiPrompt(value: unknown, file: string, field: string): AiPromptData {
  const record = asObject(value, file, field);
  const prompt: AiPromptData = {
    systemPrompt: asString(record.systemPrompt, file, `${field}.systemPrompt`),
    mainPrompt: asString(record.mainPrompt, file, `${field}.mainPrompt`)
  };
  for (const optional of ["categorizationDescription", "keyIndicatorsPrompt", "discussionPrompt"] as const) {
    if (record[optional] !== undefined) {
      prompt[optional] = asString(record[optional], file, `${field}.${optional}`);
    }
  }
  if (record.categories !== undefined) {
    const categories = asArray(record.categories, file, `${field}.categories`)
      .map((category, index) => {
        const text = asString(category, file, `${field}.categories[${index}]`);
        if (text.trim().length === 0) fail(file, `${field}.categories[${index}]`, "must not be empty");
        return text;
      });
    const seen = new Set<string>();
    for (const category of categories) {
      if (seen.has(category)) fail(file, `${field}.categories`, `contains the duplicate entry "${category}"`);
      seen.add(category);
      // buildZodResponseSchema prepends "unknown" itself; a second one makes an invalid enum.
      if (category === "unknown") {
        fail(file, `${field}.categories`, 'must not list "unknown" — the schema builder adds it');
      }
    }
    prompt.categories = categories;
  }
  return prompt;
}

export function validatePromptFile(value: unknown, file: string): PromptFile {
  const record = asObject(value, file, "prompt");
  checkSchemaVersion(record, file);
  const aiPrompt = validateAiPrompt(record.aiPrompt, file, "aiPrompt");
  const provenance = asObject(record.provenance, file, "provenance");
  const declaredHash = asString(provenance.aiPromptSha256, file, "provenance.aiPromptSha256");
  const actualHash = sha256Canonical(aiPrompt);
  if (declaredHash !== actualHash) {
    fail(file, "provenance.aiPromptSha256",
      `does not match sha256Canonical(aiPrompt): declared ${declaredHash}, actual ${actualHash}`);
  }
  return {
    schemaVersion: kSchemaVersion,
    name: asString(record.name, file, "name"),
    aiPrompt,
    provenance: {
      source: asString(provenance.source, file, "provenance.source"),
      retrievedAt: asString(provenance.retrievedAt, file, "provenance.retrievedAt"),
      aiPromptSha256: declaredHash
    }
  };
}

// ---------------------------------------------------------------------------
// Experiment file
// ---------------------------------------------------------------------------

/** Text-only and image-only are what run today; `mixed` is declared but nothing builds one yet. */
export const messageShapes = ["text-only", "image-only"] as const;
export type MessageShape = typeof messageShapes[number];

/**
 * A run names one representation, and which one depends on its message shape: `text-only` runs carry
 * a `textVariant`, `image-only` runs carry an `imageMode`. The other field is refused rather than
 * ignored — a `text-only` run with an `imageMode` set is a mistake about what is being measured, and
 * silently dropping it would produce a result table that looks fine and answers a different question.
 */
export interface ExperimentRun {
  id: string;
  message: MessageShape;
  textVariant?: string;
  imageMode?: string;
  prompt: string;
}

export interface ExperimentFile {
  schemaVersion: number;
  name: string;
  runs: ExperimentRun[];
}

export interface ExperimentValidationContext {
  /** Text representation variants this build knows how to produce. */
  knownTextVariants: readonly string[];
  /** Render modes this build knows how to produce. */
  knownImageModes: readonly string[];
  /** Returns true when `prompts/<name>.json` exists. */
  promptExists: (name: string) => boolean;
}

export function validateExperimentFile(
  value: unknown, file: string, context: ExperimentValidationContext
): ExperimentFile {
  const record = asObject(value, file, "experiment");
  checkSchemaVersion(record, file);
  // The name becomes a path segment in the default results file, so it is constrained the same way a
  // document id is: a name like "../../escaped" would otherwise steer that file out of data/.
  const name = asString(record.name, file, "name");
  if (!kDocumentIdPattern.test(name)) {
    fail(file, "name", `must match ${kDocumentIdPattern}, got "${name}"`);
  }
  const runs = asArray(record.runs, file, "runs");
  if (runs.length === 0) fail(file, "runs", "must contain at least one run");
  const seen = new Set<string>();
  const validatedRuns = runs.map((entry, index) => {
    const field = `runs[${index}]`;
    const run = asObject(entry, file, field);
    const id = asString(run.id, file, `${field}.id`);
    if (seen.has(id)) fail(file, `${field}.id`, `duplicates an earlier run id "${id}"`);
    seen.add(id);
    const message = asEnum(run.message, messageShapes, file, `${field}.message`);
    const prompt = asString(run.prompt, file, `${field}.prompt`);
    if (!context.promptExists(prompt)) {
      fail(file, `${field}.prompt`, `names a prompt file that does not exist: prompts/${prompt}.json`);
    }

    const validated: ExperimentRun = { id, message, prompt };
    if (message === "text-only") {
      if (run.imageMode !== undefined) {
        fail(file, `${field}.imageMode`, 'must not be set on a "text-only" run, which sends no image');
      }
      const textVariant = asString(run.textVariant, file, `${field}.textVariant`);
      if (!context.knownTextVariants.includes(textVariant)) {
        fail(file, `${field}.textVariant`,
          `must be one of ${context.knownTextVariants.join(", ")}, got "${textVariant}"`);
      }
      validated.textVariant = textVariant;
    } else {
      if (run.textVariant !== undefined) {
        fail(file, `${field}.textVariant`, 'must not be set on an "image-only" run, which sends no summary');
      }
      const imageMode = asString(run.imageMode, file, `${field}.imageMode`);
      if (!context.knownImageModes.includes(imageMode)) {
        fail(file, `${field}.imageMode`,
          `must be one of ${context.knownImageModes.join(", ")}, got "${imageMode}"`);
      }
      validated.imageMode = imageMode;
    }
    return validated;
  });
  return { schemaVersion: kSchemaVersion, name, runs: validatedRuns };
}

// ---------------------------------------------------------------------------
// Representation envelope
// ---------------------------------------------------------------------------

export interface RepresentationEnvelope {
  schemaVersion: number;
  docId: string;
  variantId: string;
  variantVersion: number;
  sourceContentSha256: string;
  generatedAt: string;
  markdown: string;
}

export function validateRepresentationEnvelope(value: unknown, file: string): RepresentationEnvelope {
  const record = asObject(value, file, "representation");
  checkSchemaVersion(record, file);
  return {
    schemaVersion: kSchemaVersion,
    docId: asString(record.docId, file, "docId"),
    variantId: asString(record.variantId, file, "variantId"),
    variantVersion: asNumber(record.variantVersion, file, "variantVersion"),
    sourceContentSha256: asString(record.sourceContentSha256, file, "sourceContentSha256"),
    generatedAt: asString(record.generatedAt, file, "generatedAt"),
    markdown: asString(record.markdown, file, "markdown")
  };
}

// ---------------------------------------------------------------------------
// Image representation envelope
// ---------------------------------------------------------------------------

/** What a capture covers. `fixed-height` is the Shutterbug modes' clipped capture. */
export const captureModes = ["full-document", "fixed-height"] as const;
export type CaptureMode = typeof captureModes[number];

/** What one stored image is a picture of. `tile` is written by nothing yet; it arrives in M3. */
export const imagePurposes = ["full-document", "tile"] as const;
export type ImagePurpose = typeof imagePurposes[number];

/** OpenAI's image detail setting. The shared builder hardcodes `auto`; M3 adds the other two. */
export const imageDetails = ["low", "high", "auto"] as const;
export type ImageDetail = typeof imageDetails[number];

/**
 * What a render was produced against. Structured rather than a description string, because it is
 * compared field by field for freshness: `http://localhost:8080` serves different code tomorrow, and
 * so does a mutable branch deployment, so the CLUE revision is part of the target rather than an
 * afterthought.
 */
export interface RenderTarget {
  clueUrl: string;
  unit: string;
  /** The CLUE commit (plus dirty flag) or build id that was rendered. `null` when it is unknowable. */
  clueRevision: string | null;
  shutterbugUrl: string | null;
  viewportWidthPx: number;
  captureMode: CaptureMode;
  /** The clip height for `fixed-height`; `null` for a full-document capture. */
  captureHeightPx: number | null;
}

export interface EnvelopeImage {
  /** A bare filename, resolved against the envelope's own directory. */
  file: string;
  /** sha256 of the file bytes. */
  sha256: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  bytes: number;
  /** The hosted URL for a Shutterbug render; `null` for a locally captured one. */
  url: string | null;
  tileId: string | null;
  purpose: ImagePurpose;
}

export interface ImageEnvelope {
  schemaVersion: number;
  docId: string;
  kind: "image";
  /** The render mode that produced this, e.g. `puppeteer-full-height`. */
  modeId: string;
  /** The backend the mode uses, e.g. `puppeteer`. */
  backendId: string;
  backendVersion: number;
  renderTarget: RenderTarget;
  sourceContentSha256: string;
  generatedAt: string;
  /**
   * Always an array, even though every render writes exactly one full-document image today: the
   * model, the validators and the freshness checks all handle N so a per-tile capture is
   * additive rather than a format change. Request construction separately requires exactly one.
   */
  images: EnvelopeImage[];
}

const kSha256Pattern = /^[0-9a-f]{64}$/;

function asSha256(value: unknown, file: string, field: string): string {
  const text = asString(value, file, field);
  if (!kSha256Pattern.test(text)) fail(file, field, `must be a 64-character hex sha256, got "${text}"`);
  return text;
}

/**
 * `file` names an image beside the envelope and nothing else. The path is containment-checked again
 * when it is resolved, but a bare-filename rule here means a hand-edited envelope cannot even
 * describe a file elsewhere.
 */
function asBareFilename(value: unknown, file: string, field: string): string {
  const text = asString(value, file, field);
  if (text.length === 0 || text.includes("/") || text.includes("\\") || text === "." || text === "..") {
    fail(file, field, `must be a bare filename beside the envelope, got "${text}"`);
  }
  return text;
}

export function validateRenderTarget(value: unknown, file: string, field: string): RenderTarget {
  const record = asObject(value, file, field);
  const captureMode = asEnum(record.captureMode, captureModes, file, `${field}.captureMode`);
  const captureHeightPx = record.captureHeightPx == null
    ? null
    : asPositiveInteger(record.captureHeightPx, file, `${field}.captureHeightPx`);
  // A clipped capture that forgot to say how far it clipped, or a full-document capture claiming a
  // clip height, would both compare "equal" to a target that means something else.
  if (captureMode === "fixed-height" && captureHeightPx === null) {
    fail(file, `${field}.captureHeightPx`, 'is required when captureMode is "fixed-height"');
  }
  if (captureMode === "full-document" && captureHeightPx !== null) {
    fail(file, `${field}.captureHeightPx`, 'must be null when captureMode is "full-document"');
  }
  return {
    clueUrl: asString(record.clueUrl, file, `${field}.clueUrl`),
    unit: asString(record.unit, file, `${field}.unit`),
    clueRevision: asOptionalString(record.clueRevision, file, `${field}.clueRevision`),
    shutterbugUrl: asOptionalString(record.shutterbugUrl, file, `${field}.shutterbugUrl`),
    viewportWidthPx: asPositiveInteger(record.viewportWidthPx, file, `${field}.viewportWidthPx`),
    captureMode,
    captureHeightPx
  };
}

/** The provenance an image envelope and an image result-row descriptor both carry. */
function validateImageProvenance(record: Record<string, unknown>, file: string, field = "") {
  const at = (name: string) => (field ? `${field}.${name}` : name);
  return {
    modeId: asString(record.modeId, file, at("modeId")),
    backendId: asString(record.backendId, file, at("backendId")),
    backendVersion: asPositiveInteger(record.backendVersion, file, at("backendVersion")),
    renderTarget: validateRenderTarget(record.renderTarget, file, at("renderTarget")),
    sourceContentSha256: asString(record.sourceContentSha256, file, at("sourceContentSha256"))
  };
}

export function validateImageEnvelope(value: unknown, file: string): ImageEnvelope {
  const record = asObject(value, file, "representation");
  checkSchemaVersion(record, file);
  if (record.kind !== "image") {
    fail(file, "kind", `must be "image", got ${describe(record.kind)}`);
  }
  const images = asArray(record.images, file, "images").map((entry, index) => {
    const field = `images[${index}]`;
    const image = asObject(entry, file, field);
    return {
      file: asBareFilename(image.file, file, `${field}.file`),
      sha256: asSha256(image.sha256, file, `${field}.sha256`),
      mimeType: asString(image.mimeType, file, `${field}.mimeType`),
      widthPx: asPositiveInteger(image.widthPx, file, `${field}.widthPx`),
      heightPx: asPositiveInteger(image.heightPx, file, `${field}.heightPx`),
      bytes: asPositiveInteger(image.bytes, file, `${field}.bytes`),
      url: asOptionalString(image.url, file, `${field}.url`),
      tileId: asOptionalString(image.tileId, file, `${field}.tileId`),
      purpose: asEnum(image.purpose, imagePurposes, file, `${field}.purpose`)
    };
  });
  const filenames = new Set<string>();
  for (const image of images) {
    if (filenames.has(image.file)) fail(file, "images", `lists the file "${image.file}" more than once`);
    filenames.add(image.file);
  }
  return {
    schemaVersion: kSchemaVersion,
    docId: asString(record.docId, file, "docId"),
    kind: "image",
    ...validateImageProvenance(record, file),
    generatedAt: asString(record.generatedAt, file, "generatedAt"),
    images
  };
}

// ---------------------------------------------------------------------------
// Pricing config
// ---------------------------------------------------------------------------

/**
 * How one image is priced in input tokens. Images are not billed by the characters of their data
 * URL, so the character heuristic that prices text would read a 500 KB screenshot as ~170k tokens
 * and refuse every run before it started.
 *
 * `detailLowFlat` is the whole cost at `detail: "low"`. Otherwise the image is scaled to fit inside
 * `maxLongSide` and then down to `maxShortSide` on its short side, divided into `tileSize` squares,
 * and charged `base` plus `perTile` per tile.
 */
export interface ImageTokenPricing {
  detailLowFlat: number;
  base: number;
  perTile: number;
  tileSize: number;
  maxShortSide: number;
  maxLongSide: number;
}

export interface ModelPricing {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  maxOutputTokens: number;
  imageTokens: ImageTokenPricing;
}

export interface PricingConfig {
  schemaVersion: number;
  effectiveDate: string;
  models: Record<string, ModelPricing>;
}

/**
 * Every field is a positive integer. Zero or a negative anywhere here would price a screenshot at
 * nothing, which is exactly the failure the image cost model exists to prevent, so it is refused
 * rather than allowed through as "cheap".
 */
export function validateImageTokenPricing(value: unknown, file: string, field: string): ImageTokenPricing {
  const record = asObject(value, file, field);
  const pricing = {
    detailLowFlat: asPositiveInteger(record.detailLowFlat, file, `${field}.detailLowFlat`),
    base: asPositiveInteger(record.base, file, `${field}.base`),
    perTile: asPositiveInteger(record.perTile, file, `${field}.perTile`),
    tileSize: asPositiveInteger(record.tileSize, file, `${field}.tileSize`),
    maxShortSide: asPositiveInteger(record.maxShortSide, file, `${field}.maxShortSide`),
    maxLongSide: asPositiveInteger(record.maxLongSide, file, `${field}.maxLongSide`)
  };
  // The two bounds are applied in order — fit the long side, then the short side — so a config where
  // the short-side bound is the larger of the two describes a scaling rule that cannot happen.
  if (pricing.maxShortSide > pricing.maxLongSide) {
    fail(file, `${field}.maxShortSide`,
      `must not exceed maxLongSide (${pricing.maxLongSide}), got ${pricing.maxShortSide}`);
  }
  return pricing;
}

export function validatePricingConfig(value: unknown, file: string): PricingConfig {
  const record = asObject(value, file, "pricing");
  checkSchemaVersion(record, file);
  const models = asObject(record.models, file, "models");
  const validated: Record<string, ModelPricing> = {};
  for (const [model, entry] of Object.entries(models)) {
    const field = `models.${model}`;
    const pricing = asObject(entry, file, field);
    validated[model] = {
      inputPerMTokUsd: asNonNegativeNumber(pricing.inputPerMTokUsd, file, `${field}.inputPerMTokUsd`),
      outputPerMTokUsd: asNonNegativeNumber(pricing.outputPerMTokUsd, file, `${field}.outputPerMTokUsd`),
      maxOutputTokens: asPositiveInteger(pricing.maxOutputTokens, file, `${field}.maxOutputTokens`),
      imageTokens: validateImageTokenPricing(pricing.imageTokens, file, `${field}.imageTokens`)
    };
  }
  return {
    schemaVersion: kSchemaVersion,
    effectiveDate: asString(record.effectiveDate, file, "effectiveDate"),
    models: validated
  };
}

// ---------------------------------------------------------------------------
// Result rows
// ---------------------------------------------------------------------------

export const resultStatuses = ["success", "refusal", "error", "skipped"] as const;
export type ResultStatus = typeof resultStatuses[number];

/**
 * Which representation a row was produced from, in enough detail to find it again.
 *
 * Both kinds carry `sourceContentSha256`, so a row can always be tied back to the exact document
 * content it describes. The image side carries the whole render target because that is what a
 * screenshot's provenance *is*: the same document rendered against a different CLUE build is a
 * different picture. `runId` alone would lose all of it.
 *
 * This is also the extension point a mixed-message row will need.
 */
export type RepresentationDescriptor =
  | { kind: "text"; variantId: string; variantVersion: number; sourceContentSha256: string }
  | {
      kind: "image";
      modeId: string;
      backendId: string;
      backendVersion: number;
      renderTarget: RenderTarget;
      sourceContentSha256: string;
      imageSha256s: string[];
    };

export function validateRepresentationDescriptor(
  value: unknown, file: string, field: string
): RepresentationDescriptor {
  const record = asObject(value, file, field);
  const kind = asEnum(record.kind, ["text", "image"] as const, file, `${field}.kind`);
  if (kind === "text") {
    return {
      kind,
      variantId: asString(record.variantId, file, `${field}.variantId`),
      variantVersion: asNumber(record.variantVersion, file, `${field}.variantVersion`),
      sourceContentSha256: asString(record.sourceContentSha256, file, `${field}.sourceContentSha256`)
    };
  }
  return {
    kind,
    ...validateImageProvenance(record, file, field),
    imageSha256s: asArray(record.imageSha256s, file, `${field}.imageSha256s`)
      .map((hash, index) => asSha256(hash, file, `${field}.imageSha256s[${index}]`))
  };
}

export interface RunMeta {
  date: string;
  openaiSdkVersion: string;
  gitCommit: string | null;
  gitDirty: boolean;
}

export interface ResponseOriginMeta {
  /** When the originating API call happened — for a cache hit this is the *original* call's date. */
  date: string;
  modelReturned: string | null;
  systemFingerprint: string | null;
}

export interface ResultUsage {
  promptTokens: number;
  completionTokens: number;
  source: "api" | "cache";
}

export interface ResultCost {
  /** What the response's token usage costs at the configured prices. */
  modeledUsd: number;
  /** What this particular run actually spent — always 0 for a cache hit. */
  incurredThisRunUsd: number;
}

export interface ResultRowCommon {
  schemaVersion: number;
  experiment: string;
  experimentSha256: string;
  runId: string;
  corpus: string;
  docId: string;
  /**
   * The modality this row is grouped under: the human override when the manifest carries one,
   * otherwise the classifier's answer.
   */
  modality: Modality;
  /**
   * What the classifier computed, recorded alongside. Without it a hand-set `modalityOverride`
   * silently regroups a document and nothing in the results says a human rather than the classifier
   * put it there — so a reader cannot tell a measurement from a judgement call.
   */
  computedModality: Modality;
  message: MessageShape;
  representation: RepresentationDescriptor;
  /**
   * The harness's pre-flight image-token estimate for this row's images, at the configured pricing.
   * Present only on rows that sent an image. The API's `usage.promptTokens` stays authoritative for
   * what was billed; this is recorded so a report can say how much of the prompt was picture.
   */
  promptImageTokensEstimated?: number;
  prompt: { name: string; sha256: string };
  /** The cache key, which doubles as resume identity. `null` on skipped rows: they build no request. */
  requestKey: string | null;
  runMeta: RunMeta;
}

export interface SuccessResultRow extends ResultRowCommon {
  status: "success";
  requestKey: string;
  response: { parsed: unknown; raw: unknown };
  usage: ResultUsage;
  cost: ResultCost;
  responseOriginMeta: ResponseOriginMeta;
}

export interface RefusalResultRow extends ResultRowCommon {
  status: "refusal";
  requestKey: string;
  refusal: string;
  usage: ResultUsage;
  cost: ResultCost;
  responseOriginMeta: ResponseOriginMeta;
}

export interface ErrorResultRow extends ResultRowCommon {
  status: "error";
  requestKey: string;
  error: { type: string; message: string; attempts: number };
  /**
   * Present when the API actually answered and billed for it — the "unparsed" case, where a
   * completion came back with usage but neither parsed content nor a refusal. Absent when the call
   * never produced a response (network failure, timeout), which is billed by nobody we can observe.
   * Reports add these into the cost totals while still counting the row as an error.
   */
  usage?: ResultUsage;
  cost?: ResultCost;
  responseOriginMeta?: ResponseOriginMeta;
}

export interface SkippedResultRow extends ResultRowCommon {
  status: "skipped";
  requestKey: null;
  skipReasons: string[];
}

export type ResultRow = SuccessResultRow | RefusalResultRow | ErrorResultRow | SkippedResultRow;

function validateResultCommon(record: Record<string, unknown>, file: string): ResultRowCommon {
  if (record.schemaVersion !== kResultSchemaVersion) {
    // Named specifically rather than as a generic version mismatch: a version-1 row describes its
    // representation with a bare `textVariant` string, which cannot be turned into a descriptor
    // after the fact, and reading one as though it were current would attribute image rows to a
    // text variant that never ran.
    const wasV1 = record.schemaVersion === 1;
    fail(file, "schemaVersion", `must be ${kResultSchemaVersion}, got ${describe(record.schemaVersion)}` +
      (wasV1
        ? ". These are milestone 1 result rows, which recorded a textVariant instead of a " +
          "representation descriptor. They cannot be upgraded in place — re-run the experiment into " +
          "a fresh --output. The response cache means unchanged requests will not be paid for twice."
        : ""));
  }
  const prompt = asObject(record.prompt, file, "prompt");
  const runMeta = asObject(record.runMeta, file, "runMeta");
  const common: ResultRowCommon = {
    schemaVersion: kResultSchemaVersion,
    experiment: asString(record.experiment, file, "experiment"),
    experimentSha256: asString(record.experimentSha256, file, "experimentSha256"),
    runId: asString(record.runId, file, "runId"),
    corpus: asString(record.corpus, file, "corpus"),
    docId: asString(record.docId, file, "docId"),
    modality: asEnum(record.modality, modalities, file, "modality"),
    computedModality: asEnum(record.computedModality, modalities, file, "computedModality"),
    message: asEnum(record.message, messageShapes, file, "message"),
    representation: validateRepresentationDescriptor(record.representation, file, "representation"),
    prompt: {
      name: asString(prompt.name, file, "prompt.name"),
      sha256: asString(prompt.sha256, file, "prompt.sha256")
    },
    requestKey: null,
    runMeta: {
      date: asString(runMeta.date, file, "runMeta.date"),
      openaiSdkVersion: asString(runMeta.openaiSdkVersion, file, "runMeta.openaiSdkVersion"),
      gitCommit: asOptionalString(runMeta.gitCommit, file, "runMeta.gitCommit"),
      gitDirty: asBoolean(runMeta.gitDirty, file, "runMeta.gitDirty")
    }
  };
  if (record.promptImageTokensEstimated !== undefined) {
    // Reports sum this, so a negative would quietly subtract from the image-token total.
    common.promptImageTokensEstimated =
      asNonNegativeNumber(record.promptImageTokensEstimated, file, "promptImageTokensEstimated");
  }
  // An estimate on a row that sent no image, or its absence on one that did, would put a number in
  // the report's image column that belongs to nothing.
  const sentAnImage = common.representation.kind === "image";
  if (sentAnImage !== (common.promptImageTokensEstimated !== undefined)) {
    fail(file, "promptImageTokensEstimated",
      `must be ${sentAnImage ? "set" : "absent"} on a row whose representation is ` +
      `"${common.representation.kind}"`);
  }
  return common;
}

function validateUsage(value: unknown, file: string): ResultUsage {
  const usage = asObject(value, file, "usage");
  return {
    promptTokens: asNumber(usage.promptTokens, file, "usage.promptTokens"),
    completionTokens: asNumber(usage.completionTokens, file, "usage.completionTokens"),
    source: asEnum(usage.source, ["api", "cache"] as const, file, "usage.source")
  };
}

function validateCost(value: unknown, file: string): ResultCost {
  const cost = asObject(value, file, "cost");
  return {
    modeledUsd: asNumber(cost.modeledUsd, file, "cost.modeledUsd"),
    incurredThisRunUsd: asNumber(cost.incurredThisRunUsd, file, "cost.incurredThisRunUsd")
  };
}

function validateOriginMeta(value: unknown, file: string): ResponseOriginMeta {
  const meta = asObject(value, file, "responseOriginMeta");
  return {
    date: asString(meta.date, file, "responseOriginMeta.date"),
    modelReturned: asOptionalString(meta.modelReturned, file, "responseOriginMeta.modelReturned"),
    systemFingerprint: asOptionalString(meta.systemFingerprint, file, "responseOriginMeta.systemFingerprint")
  };
}

/** Validates one result row against the schema its `status` selects. */
export function validateResultRow(value: unknown, file: string): ResultRow {
  const record = asObject(value, file, "result");
  const status = asEnum(record.status, resultStatuses, file, "status");
  const common = validateResultCommon(record, file);

  if (status === "skipped") {
    if (record.requestKey != null) {
      fail(file, "requestKey", `must be null on a skipped row, got ${describe(record.requestKey)}`);
    }
    return {
      ...common,
      status,
      requestKey: null,
      skipReasons: asArray(record.skipReasons, file, "skipReasons")
        .map((reason, index) => asString(reason, file, `skipReasons[${index}]`))
    };
  }

  const requestKey = asString(record.requestKey, file, "requestKey");

  if (status === "error") {
    const error = asObject(record.error, file, "error");
    const row: ErrorResultRow = {
      ...common,
      status,
      requestKey,
      error: {
        type: asString(error.type, file, "error.type"),
        message: asString(error.message, file, "error.message"),
        attempts: asNumber(error.attempts, file, "error.attempts")
      }
    };
    // A billed error carries all three or none: a row with cost but no usage would let a report
    // double-count or under-count without any way to tell which.
    const billed = ["usage", "cost", "responseOriginMeta"].filter((key) => record[key] != null);
    if (billed.length > 0 && billed.length < 3) {
      fail(file, billed[0], "is set on an error row without usage, cost and responseOriginMeta together");
    }
    if (billed.length === 3) {
      row.usage = validateUsage(record.usage, file);
      row.cost = validateCost(record.cost, file);
      row.responseOriginMeta = validateOriginMeta(record.responseOriginMeta, file);
    }
    return row;
  }

  if (status === "refusal") {
    return {
      ...common,
      status,
      requestKey,
      refusal: asString(record.refusal, file, "refusal"),
      usage: validateUsage(record.usage, file),
      cost: validateCost(record.cost, file),
      responseOriginMeta: validateOriginMeta(record.responseOriginMeta, file)
    };
  }

  const response = asObject(record.response, file, "response");
  if (!("parsed" in response)) fail(file, "response.parsed", "is missing");
  if (!("raw" in response)) fail(file, "response.raw", "is missing");
  return {
    ...common,
    status,
    requestKey,
    response: { parsed: response.parsed, raw: response.raw },
    usage: validateUsage(record.usage, file),
    cost: validateCost(record.cost, file),
    responseOriginMeta: validateOriginMeta(record.responseOriginMeta, file)
  };
}

// ---------------------------------------------------------------------------
// Fixture expectations (the committed synthetic corpus)
// ---------------------------------------------------------------------------

export const handlerTiers = ["full", "partial", "stub", "fallback"] as const;
export type HandlerTier = typeof handlerTiers[number];

export interface FixtureExpectation {
  computedModality: Modality;
  tileTypes: string[];
  capability: { containsStudentText: boolean; requiresVisualRepresentation: boolean };
  handlerTier: HandlerTier;
  distinctiveString: string;
  /** Defaults to `handlerTier` being full or partial; set explicitly where a handler emits nothing. */
  expectDistinctiveInDefaultSummary: boolean;
  defaultSummaryMustSucceed: boolean;
  minimalSummaryMustSucceed: boolean;
  notes?: string;
}

export interface ExpectationsFile {
  schemaVersion: number;
  corpus: string;
  documents: Record<string, FixtureExpectation>;
}

export function validateExpectationsFile(value: unknown, file: string): ExpectationsFile {
  const record = asObject(value, file, "expectations");
  checkSchemaVersion(record, file);
  const documents = asObject(record.documents, file, "documents");
  const validated: Record<string, FixtureExpectation> = {};
  for (const [docId, entry] of Object.entries(documents)) {
    const field = `documents.${docId}`;
    const expectation = asObject(entry, file, field);
    const capability = asObject(expectation.capability, file, `${field}.capability`);
    validated[docId] = {
      computedModality: asEnum(expectation.computedModality, modalities, file, `${field}.computedModality`),
      tileTypes: asArray(expectation.tileTypes, file, `${field}.tileTypes`)
        .map((type, index) => asString(type, file, `${field}.tileTypes[${index}]`)),
      capability: {
        containsStudentText: asBoolean(capability.containsStudentText, file, `${field}.capability.containsStudentText`),
        requiresVisualRepresentation: asBoolean(
          capability.requiresVisualRepresentation, file, `${field}.capability.requiresVisualRepresentation`)
      },
      handlerTier: asEnum(expectation.handlerTier, handlerTiers, file, `${field}.handlerTier`),
      distinctiveString: asString(expectation.distinctiveString, file, `${field}.distinctiveString`),
      expectDistinctiveInDefaultSummary: asBoolean(
        expectation.expectDistinctiveInDefaultSummary, file, `${field}.expectDistinctiveInDefaultSummary`),
      defaultSummaryMustSucceed: asBoolean(
        expectation.defaultSummaryMustSucceed, file, `${field}.defaultSummaryMustSucceed`),
      minimalSummaryMustSucceed: asBoolean(
        expectation.minimalSummaryMustSucceed, file, `${field}.minimalSummaryMustSucceed`),
      notes: expectation.notes === undefined ? undefined : asString(expectation.notes, file, `${field}.notes`)
    };
  }
  return { schemaVersion: kSchemaVersion, corpus: asString(record.corpus, file, "corpus"), documents: validated };
}
