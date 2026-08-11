/**
 * Request construction. Every request the harness sends is built by the same functions the deployed
 * analysis pipeline uses, so a variant can never "win" by being formatted differently.
 */
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  IAiPrompt, RelatedSummary, buildSummaryMessages, buildZodResponseSchema, categorizationResponseFormat
} from "../../../shared/ai-analysis-messages.js";
import { MessageShape, sha256Canonical } from "./schemas.js";

export interface GenerationSettings {
  /**
   * Production sets no completion cap. The harness always sets one so the spend ceiling is a real
   * upper bound rather than an estimate; see the README.
   */
  max_completion_tokens: number;
}

export interface HarnessRequest {
  model: string;
  messages: ChatCompletionMessageParam[];
  /** The serializable projection of the response format — what goes into the cache key. */
  responseFormat: { type: string; json_schema: { name: string; strict?: boolean; schema: unknown } };
  generationSettings: GenerationSettings;
}

export interface BuildRequestOptions {
  model: string;
  aiPrompt: IAiPrompt;
  message: MessageShape;
  markdown: string;
  relatedSummaries?: RelatedSummary[];
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
export function projectResponseFormat(parseable: unknown): HarnessRequest["responseFormat"] {
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

export function buildRequest(options: BuildRequestOptions): HarnessRequest {
  const { model, aiPrompt, message, markdown, relatedSummaries = [], generationSettings } = options;
  if (message !== "text-only") {
    throw new Error(`Message shape "${message}" is not supported in milestone 1.`);
  }
  return {
    model,
    messages: buildSummaryMessages(aiPrompt, markdown, relatedSummaries),
    responseFormat: projectResponseFormat(responseFormatFor(aiPrompt)),
    generationSettings
  };
}

/**
 * The cache key, which is also resume identity: it embeds the model, the fully built messages (so the
 * document, its representation and the prompt are all in there), the response schema, and the
 * generation settings.
 */
export function requestKeyFor(request: HarnessRequest): string {
  return sha256Canonical({
    model: request.model,
    messages: request.messages,
    responseFormat: request.responseFormat,
    generationSettings: request.generationSettings
  });
}
