import {zodResponseFormat} from "openai/helpers/zod";
import { AutoParseableResponseFormat } from "openai/lib/parser";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {z} from "zod";
import { RatingValue } from "./shared";

export interface IAiPrompt {
  systemPrompt: string;
  mainPrompt: string;
  categorizationDescription?: string;
  categories?: string[];
  keyIndicatorsPrompt?: string;
  discussionPrompt?: string;
}

export interface AgreementInfo {
  content: string;
  tags: string[];
}
/**
 * `Partial`, because a document's agreements need not cover every value. `Object.values` over a
 * document's `aiAgreements` produces only the values people actually chose, so a summary that
 * everyone agreed with has a `yes` key and nothing else — and the prompt line built from this reads
 * the entries that are there rather than assuming all of them.
 */
export type Agreements = Partial<Record<RatingValue, AgreementInfo[]>>;

export interface RelatedSummary {
  summary: string;
  agreements: Agreements;
}

export const defaultAiPrompt: IAiPrompt = {
  mainPrompt: `Below is a text summary of a student document and a picture of it. Either one may be absent.
They are working on an engineering task. Please tell me which of the following areas of their design they are focusing on:
- user: who's it for?
- environment: where's it used?
- form: what's it look like?
- function: what does it do?
and why you chose that area.
Or if the document doesn't include enough content to clearly identify a focus area let me know by setting "category" to "unknown".
Your answer should be a JSON document in the given format.`,
  categorizationDescription: "Categorize the document based on its content.",
  categories: ["user", "environment", "form", "function"],
  keyIndicatorsPrompt: "What are the key indicators that support this categorization?",
  discussionPrompt: "Please provide any additional discussion or context regarding the categorization.",
  systemPrompt: "You are a teaching assistant in an engineering design course."
};

// openai v6's zodResponseFormat infers the parsed type through a zod v3/v4
// conditional that recurses infinitely (TS2589) on a dynamically-built schema,
// so the inference is bypassed and the parsed shape stated directly.
export function categorizationResponseFormat(
  responseSchema: Record<string, z.ZodType>
): AutoParseableResponseFormat<Record<string, any>> {
  return zodResponseFormat(z.object(responseSchema) as never, "categorization-response");
}

export function buildZodResponseSchema(aiPrompt: IAiPrompt) {
  const schema: Record<string, z.ZodType> = {};
  if (aiPrompt.categorizationDescription && aiPrompt.categories && aiPrompt.categories.length > 0) {
    schema.category = z.enum(["unknown", ...aiPrompt.categories!],
      {description: aiPrompt.categorizationDescription});
  }
  if (aiPrompt.keyIndicatorsPrompt) {
    schema.keyIndicators = z.array(z.string(), {description: aiPrompt.keyIndicatorsPrompt});
  }
  if (aiPrompt.discussionPrompt) {
    schema.discussion = z.string({description: aiPrompt.discussionPrompt});
  }
  return schema;
}

/** How much of an image the provider is asked to look at. `auto` is what it uses when unasked. */
export type ImageDetail = "low" | "high" | "auto";

/** One image in a request: where to fetch it, and optionally how closely to look at it. */
export interface ImageInput {
  url: string;
  detail?: ImageDetail;
}

/**
 * A request-wide default for `detail`, for callers that pass a bare URL.
 *
 * An image's own `detail` wins over this, and an absent value on both means `"auto"` — which is what
 * every caller sent before there was anything to configure, so their messages are unchanged.
 */
export interface ImageMessageOptions {
  detail?: ImageDetail;
}

/** One `image_url` part per image, in the order given. */
function imageContentParts(
  images: string | ImageInput[], options: ImageMessageOptions
): ChatCompletionContentPart[] {
  const list = typeof images === "string" ? [{ url: images }] : images;
  return list.map((image) => ({
    type: "image_url" as const,
    image_url: {
      url: image.url,
      detail: image.detail ?? options.detail ?? "auto",
    },
  }));
}

/**
 * The summary part, plus one part per related summary.
 *
 * Shared by `buildSummaryMessages` and `buildMixedMessages` so the two cannot drift: a mixed message
 * has to be a summary message with pictures added, or comparing them measures the wording as much as
 * the representation.
 */
function summaryContentParts(
  summary: string, relatedSummaries: RelatedSummary[]
): ChatCompletionContentPart[] {
  const parts: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `This is the AI generated summary:\n${summary}`,
    },
  ];

  relatedSummaries.forEach((related) => {
    let text = `This is AI generated summary of a similar document:\n${related.summary}`;
    const agreementCounts = Object.entries(related.agreements)
      .map(([value, info]) => `${value}: ${info.length}`)
      .join(", ");
    if (agreementCounts.length > 0) {
      text += `\n\nOther users agreed with this summary as follows: ${agreementCounts}`;
    }
    parts.push({
      type: "text",
      text,
    });
  });

  return parts;
}

/**
 * A picture-only request: the prompt, then one part per image.
 *
 * `images` may be a single URL, which is how every caller before multi-image capture used it, or an
 * array. `options.detail` sets a default for images that do not carry their own.
 */
export function buildImageMessages(
  aiPrompt: IAiPrompt,
  images: string | ImageInput[],
  options: ImageMessageOptions = {}
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: aiPrompt.systemPrompt,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: aiPrompt.mainPrompt,
        },
        ...imageContentParts(images, options),
      ],
    },
  ];
}

export function buildSummaryMessages(aiPrompt: IAiPrompt, summary: string, relatedSummaries: RelatedSummary[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: aiPrompt.systemPrompt,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: aiPrompt.mainPrompt,
        },
        ...summaryContentParts(summary, relatedSummaries),
      ],
    },
  ];
}

/**
 * Text and pictures in one request: exactly `buildSummaryMessages`, with image parts appended.
 *
 * Nothing is said about the images in prose — the message carries the prompt's own parts and the
 * pictures, and that is all. Anything else would be the harness inventing wording that production
 * would then have to match.
 *
 * `summary` may be `null` for a document with no student-authored text. The summary part and the
 * related-summary parts both go with it, since a related summary is context for a summary that is
 * not being sent; the images remain, which is the whole point of asking about such a document.
 */
export function buildMixedMessages(
  aiPrompt: IAiPrompt,
  summary: string | null,
  relatedSummaries: RelatedSummary[],
  images: string | ImageInput[],
  options: ImageMessageOptions = {}
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: aiPrompt.systemPrompt,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: aiPrompt.mainPrompt,
        },
        ...(summary === null ? [] : summaryContentParts(summary, relatedSummaries)),
        ...imageContentParts(images, options),
      ],
    },
  ];
}
