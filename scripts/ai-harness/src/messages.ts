/**
 * Request construction. Every request the harness sends is built by the same functions the deployed
 * analysis pipeline uses, so a variant can never "win" by being formatted differently.
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  IAiPrompt, RelatedSummary, buildImageMessages, buildSummaryMessages, buildZodResponseSchema,
  categorizationResponseFormat
} from "../../../shared/ai-analysis-messages.js";
import { ImageDetail, MessageShape, imageDetails, sha256Canonical } from "./schemas.js";

export interface GenerationSettings {
  /**
   * Production sets no completion cap. The harness always sets one so the spend ceiling is a real
   * upper bound rather than an estimate; see the README.
   */
  max_completion_tokens: number;
}

/** The only part of a harness request that is ever sent to OpenAI. */
export interface ApiRequest {
  model: string;
  messages: ChatCompletionMessageParam[];
  /** The serializable projection of the response format — what goes into the cache key. */
  responseFormat: { type: string; json_schema: { name: string; strict?: boolean; schema: unknown } };
  generationSettings: GenerationSettings;
}

/** What one image in the request costs in input tokens, and which bytes it was. */
export interface InputImageAccounting {
  /** sha256 of the image file's bytes. */
  sha256: string;
  widthPx: number;
  heightPx: number;
  detail: ImageDetail;
}

/**
 * Accounting data that travels beside the payload rather than inside it.
 *
 * The reason it cannot live in the message: for the Shutterbug modes the message content is a bare
 * hosted URL, so width and height are unrecoverable from the request without a network fetch — and
 * the image cost model needs them before a single call goes out. Keeping them here also means the
 * cache key can cover the actual pixels, not just the URL that served them.
 */
export interface InputAccounting {
  images: InputImageAccounting[];
}

export interface HarnessRequest {
  apiRequest: ApiRequest;
  inputAccounting: InputAccounting;
}

export interface BuildTextRequestOptions {
  model: string;
  aiPrompt: IAiPrompt;
  message: MessageShape;
  markdown: string;
  relatedSummaries?: RelatedSummary[];
  generationSettings: GenerationSettings;
}

export interface BuildImageRequestOptions {
  model: string;
  aiPrompt: IAiPrompt;
  message: MessageShape;
  /** What goes into the message: a hosted URL for Shutterbug, a data URL for a local capture. */
  imageUrl: string;
  /**
   * Facts about the image file. `detail` is deliberately absent: it is a fact about the request, not
   * about the file, so `buildImageRequest` reads it back out of the message it just built. A caller
   * cannot declare a detail that disagrees with what is actually sent.
   */
  accounting: Omit<InputImageAccounting, "detail">;
  generationSettings: GenerationSettings;
}

/** The openai helper object, complete with its parsing hooks. Not serializable — do not hash it. */
export function responseFormatFor(aiPrompt: IAiPrompt) {
  const responseSchema = buildZodResponseSchema(aiPrompt);
  if (Object.keys(responseSchema).length === 0) {
    throw new Error("aiPrompt must specify at least one response field for the schema.");
  }
  return categorizationResponseFormat(responseSchema);
}

/**
 * Narrows the openai helper's response format to the serializable fields the cache key is built from.
 *
 * This is checked rather than cast because canonicalJson drops `undefined`: if a future SDK renamed
 * `json_schema.schema`, the projection would silently produce `{type, json_schema: {name}}` for every
 * prompt, and two genuinely different schemas would collide on one cache key — returning another
 * prompt's cached answer. Failing loudly here is the only safe behavior.
 */
export function projectResponseFormat(parseable: unknown): ApiRequest["responseFormat"] {
  const format = parseable as { type?: unknown; json_schema?: { name?: unknown; strict?: unknown; schema?: unknown } };
  const jsonSchema = format?.json_schema;
  if (format?.type !== "json_schema" || typeof jsonSchema?.name !== "string" || jsonSchema.schema === undefined) {
    throw new Error("Unexpected response-format shape from openai's zodResponseFormat helper " +
      `(type: ${JSON.stringify(format?.type)}, json_schema keys: ` +
      `${JSON.stringify(jsonSchema ? Object.keys(jsonSchema) : null)}). The cache key is derived from ` +
      "these fields, so the harness stops rather than risk colliding keys across different schemas.");
  }
  return {
    type: format.type,
    json_schema: {
      name: jsonSchema.name,
      strict: typeof jsonSchema.strict === "boolean" ? jsonSchema.strict : undefined,
      schema: jsonSchema.schema
    }
  };
}

export function buildRequest(options: BuildTextRequestOptions): HarnessRequest {
  const { model, aiPrompt, message, markdown, relatedSummaries = [], generationSettings } = options;
  if (message !== "text-only") {
    throw new Error(`buildRequest builds text-only messages; got message shape "${message}".`);
  }
  return {
    apiRequest: {
      model,
      messages: buildSummaryMessages(aiPrompt, markdown, relatedSummaries),
      responseFormat: projectResponseFormat(responseFormatFor(aiPrompt)),
      generationSettings
    },
    inputAccounting: { images: [] }
  };
}

/**
 * Reads back the `detail` of the single image part in a built message list.
 *
 * The value is taken from the message rather than assumed, so the accounting can never disagree with
 * the request: if the shared builder's `detail` ever changes, the cost model follows it instead of
 * pricing the old one. A message list that is not one image part is the builder's contract having
 * changed underneath us, which stops the harness rather than being guessed at — the same reasoning as
 * `projectResponseFormat`.
 */
export function detailOfSingleImage(messages: ChatCompletionMessageParam[]): ImageDetail {
  const parts: { detail?: unknown }[] = [];
  for (const message of messages) {
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const typed = part as { type?: string; image_url?: { detail?: unknown } };
      if (typed?.type === "image_url") parts.push({ detail: typed.image_url?.detail });
    }
  }
  if (parts.length !== 1) {
    throw new Error(`Expected the shared image builder to produce exactly one image part, got ` +
      `${parts.length}. The cost model prices images from this, so the harness stops rather than ` +
      "reserve for the wrong number of them.");
  }
  // An absent detail is the provider's own default, which is `auto`.
  const detail = parts[0].detail ?? "auto";
  if (!(imageDetails as readonly unknown[]).includes(detail)) {
    throw new Error(`The shared image builder sent an unrecognised detail ${JSON.stringify(detail)}. ` +
      `Known values: ${imageDetails.join(", ")}.`);
  }
  return detail as ImageDetail;
}

/**
 * The image analogue, built by the shared `buildImageMessages` unmodified — `detail` stays the
 * hardcoded `"auto"` production sends, so an image run cannot win by asking for a different one.
 * Comparing detail settings would mean changing the shared builder, which is not something an
 * experiment definition can reach.
 *
 * The caller supplies what it knows about the file (its hash and its size) and the builder supplies
 * what it knows about the request (the detail it just sent), so there is no way to describe an image
 * as costing something other than what was asked for.
 */
export function buildImageRequest(options: BuildImageRequestOptions): HarnessRequest {
  const { model, aiPrompt, message, imageUrl, accounting, generationSettings } = options;
  if (message !== "image-only") {
    throw new Error(`buildImageRequest builds image-only messages; got message shape "${message}".`);
  }
  // The type says `detail` does not belong here, but TypeScript only checks that on a fresh object
  // literal — a spread or a named const carries it straight through. Silently ignoring a caller's
  // declared detail would be its own trap, so it is refused out loud.
  if ("detail" in accounting) {
    throw new Error("buildImageRequest derives `detail` from the message it builds; do not pass one " +
      `in accounting (got ${JSON.stringify((accounting as InputImageAccounting).detail)}). ` +
      "Detail variants arrive in milestone 3, by changing the shared builder.");
  }
  const messages = buildImageMessages(aiPrompt, imageUrl);
  return {
    apiRequest: {
      model,
      messages,
      responseFormat: projectResponseFormat(responseFormatFor(aiPrompt)),
      generationSettings
    },
    inputAccounting: { images: [{ ...accounting, detail: detailOfSingleImage(messages) }] }
  };
}

/**
 * Exactly the parameters `openAiCompletion` sends, minus the unserializable response-format helper.
 *
 * It exists so a test can assert what leaves the process: accounting data travels beside the request
 * and must never be posted as part of it.
 */
export function chatCompletionParams(request: HarnessRequest): Record<string, unknown> {
  return {
    model: request.apiRequest.model,
    messages: request.apiRequest.messages,
    max_completion_tokens: request.apiRequest.generationSettings.max_completion_tokens
  };
}

/**
 * The cache key, which is also resume identity: it embeds the model, the fully built messages (so the
 * document, its representation and the prompt are all in there), the response schema, and the
 * generation settings.
 *
 * Images add one more thing. For a local capture the message holds a base64 data URL, so the pixels
 * are already in the key; for a Shutterbug render it holds only a hosted URL, and the same URL could
 * serve different bytes tomorrow. The image hashes are therefore folded in as well — API-payload
 * identity and evaluation identity are related, but they are not the same thing.
 *
 * The image hashes are omitted entirely when there are none, so a text-only key is byte-identical
 * to what it would have been before images existed, and existing cache entries keep working.
 */
export function requestKeyFor(request: HarnessRequest): string {
  const { apiRequest, inputAccounting } = request;
  return sha256Canonical({
    model: apiRequest.model,
    messages: apiRequest.messages,
    responseFormat: apiRequest.responseFormat,
    generationSettings: apiRequest.generationSettings,
    imageSha256s: inputAccounting.images.length > 0
      ? inputAccounting.images.map((image) => image.sha256)
      : undefined
  });
}
