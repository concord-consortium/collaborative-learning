/**
 * Request construction. Every request the harness sends is built by the same functions the deployed
 * analysis pipeline uses, so a variant can never "win" by being formatted differently.
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  IAiPrompt, RelatedSummary, buildImageMessages, buildMixedMessages, buildSummaryMessages,
  buildZodResponseSchema, categorizationResponseFormat
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

/**
 * Facts about an image *file*. `detail` is deliberately absent: it is a fact about the request, not
 * about the file, and the builders read it back out of the message they just built. A caller cannot
 * declare a detail that disagrees with what is actually sent.
 */
export type ImageFileFacts = Omit<InputImageAccounting, "detail">;

/** One image in a request: what goes into the message, and what is known about the file behind it. */
export interface RequestImage {
  /** A hosted URL for a Shutterbug render, a data URL for a local capture. */
  imageUrl: string;
  accounting: ImageFileFacts;
}

export interface BuildImageRequestOptions {
  model: string;
  aiPrompt: IAiPrompt;
  message: MessageShape;
  /** Every image the request sends, in the order it sends them. */
  images: RequestImage[];
  /** What the run asked the provider to look at. Absent means the builder's `"auto"`. */
  detail?: ImageDetail;
  generationSettings: GenerationSettings;
}

export interface BuildMixedRequestOptions {
  model: string;
  aiPrompt: IAiPrompt;
  message: MessageShape;
  /**
   * The text side, or `null` for a document with no student-authored text — the run still sends the
   * pictures, and the row records that the text part was dropped.
   */
  markdown: string | null;
  relatedSummaries?: RelatedSummary[];
  images: RequestImage[];
  detail?: ImageDetail;
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
 * Reads back the `detail` of every image part in a built message list, in the order they are sent.
 *
 * The values are taken from the message rather than assumed, so the accounting can never disagree
 * with the request: if the shared builder's default ever changes, or a per-image detail does not
 * arrive the way the caller believed, the cost model follows the message instead of pricing the
 * intention. An unrecognized value is the builder's contract having changed underneath us, which
 * stops the harness rather than being guessed at — the same reasoning as `projectResponseFormat`.
 */
export function detailsOfImages(messages: ChatCompletionMessageParam[]): ImageDetail[] {
  const details: ImageDetail[] = [];
  for (const message of messages) {
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const typed = part as { type?: string; image_url?: { detail?: unknown } };
      if (typed?.type !== "image_url") continue;
      // An absent detail is the provider's own default, which is `auto`.
      const detail = typed.image_url?.detail ?? "auto";
      if (!(imageDetails as readonly unknown[]).includes(detail)) {
        throw new Error(`The shared image builder sent an unrecognised detail ` +
          `${JSON.stringify(detail)}. Known values: ${imageDetails.join(", ")}.`);
      }
      details.push(detail as ImageDetail);
    }
  }
  return details;
}

/**
 * Pairs each image's file facts with the detail read back from the message at the same position.
 *
 * A count mismatch means the message does not carry the images the caller thinks it does, so the
 * cost model would reserve for the wrong number of them. That stops the run.
 */
function accountingForImages(
  messages: ChatCompletionMessageParam[], images: RequestImage[]
): InputImageAccounting[] {
  const details = detailsOfImages(messages);
  if (details.length !== images.length) {
    throw new Error(`The shared builder produced ${details.length} image part(s) for ` +
      `${images.length} image(s). The cost model prices images from the message, so the harness ` +
      "stops rather than reserve for the wrong number of them.");
  }
  return images.map((image, index) => {
    // The type says `detail` does not belong in accounting, but TypeScript only checks that on a
    // fresh object literal — a spread or a named const carries it straight through, and the pairing
    // below would then silently replace it. Say so instead.
    if ("detail" in image.accounting) {
      throw new Error("Image accounting describes the file, not the request: do not pass a `detail` " +
        `in it (got ${JSON.stringify((image.accounting as InputImageAccounting).detail)}). Ask for a ` +
        "detail with the builder's `detail` option, which is what actually reaches the message.");
    }
    return { ...image.accounting, detail: details[index] };
  });
}

/**
 * The image analogue, built by the shared `buildImageMessages` unmodified.
 *
 * The caller supplies what it knows about each file (its hash and its size) and the builder supplies
 * what it knows about the request (the detail it just attached), so there is no way to describe an
 * image as costing something other than what was asked for. The builder stays the only place a
 * detail is put on a message; a run asks for one through `detail`.
 */
export function buildImageRequest(options: BuildImageRequestOptions): HarnessRequest {
  const { model, aiPrompt, message, images, detail, generationSettings } = options;
  if (message !== "image-only") {
    throw new Error(`buildImageRequest builds image-only messages; got message shape "${message}".`);
  }
  if (images.length === 0) {
    throw new Error("buildImageRequest needs at least one image; an image-only request with no " +
      "picture is a run that would ask about nothing.");
  }
  const messages = buildImageMessages(
    aiPrompt, images.map((image) => ({ url: image.imageUrl })), { detail });
  return {
    apiRequest: {
      model,
      messages,
      responseFormat: projectResponseFormat(responseFormatFor(aiPrompt)),
      generationSettings
    },
    inputAccounting: { images: accountingForImages(messages, images) }
  };
}

/**
 * Text and pictures in one request, built by the shared `buildMixedMessages` unmodified.
 *
 * `markdown` is `null` for a document with no student-authored text: the summary and related-summary
 * parts are then absent and only the pictures go, which is the case the run records on its row
 * rather than skipping.
 */
export function buildMixedRequest(options: BuildMixedRequestOptions): HarnessRequest {
  const {
    model, aiPrompt, message, markdown, relatedSummaries = [], images, detail, generationSettings
  } = options;
  if (message !== "mixed") {
    throw new Error(`buildMixedRequest builds mixed messages; got message shape "${message}".`);
  }
  if (images.length === 0) {
    throw new Error("buildMixedRequest needs at least one image; a mixed request with no picture is " +
      "a text-only request wearing the wrong name, and would be filed under the wrong message shape.");
  }
  const messages = buildMixedMessages(
    aiPrompt, markdown, relatedSummaries, images.map((image) => ({ url: image.imageUrl })), { detail });
  return {
    apiRequest: {
      model,
      messages,
      responseFormat: projectResponseFormat(responseFormatFor(aiPrompt)),
      generationSettings
    },
    inputAccounting: { images: accountingForImages(messages, images) }
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
