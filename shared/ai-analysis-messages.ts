import {zodResponseFormat} from "openai/helpers/zod";
import { AutoParseableResponseFormat } from "openai/lib/parser";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {z} from "zod";
import { AgreementValue } from "./shared";

export interface IAiPrompt {
  systemPrompt: string;
  mainPrompt: string;
  categorizationDescription?: string;
  categories?: string[];
  keyIndicatorsPrompt?: string;
  discussionPrompt?: string;
}

export interface AgreementInfo {
  content: string,
  tags: string[],
}
export type Agreements = Record<AgreementValue, AgreementInfo[]>

export interface RelatedSummary {
  summary: string;
  agreements: Agreements;
}

export const defaultAiPrompt: IAiPrompt = {
  mainPrompt: `This is a picture of a student document.
They are working on engineering task. Please tell me which of the following areas of their design they are focusing on:
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

export function buildImageMessages(aiPrompt: IAiPrompt, url: string): ChatCompletionMessageParam[] {
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
        {
          type: "image_url",
          image_url: {
            url,
            detail: "auto", // auto, low, high
          },
        },
      ],
    },
  ];
}

export function buildSummaryMessages(aiPrompt: IAiPrompt, summary: string, relatedSummaries: RelatedSummary[]): ChatCompletionMessageParam[] {
  const userContent: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: aiPrompt.mainPrompt,
    },
    {
      type: "text",
      text: `This is the AI generated summary:\n${summary}`,
    },
  ];

  if (relatedSummaries.length > 0) {
    relatedSummaries.forEach((related) => {
      let text = `This is AI generated summary of a similar document:\n${related.summary}`;
      const agreementCounts = Object.entries(related.agreements)
        .map(([value, info]) => `${value}: ${info.length}`)
        .join(", ");
      if (agreementCounts.length > 0) {
        text += `\n\nOther users agreed with this summary as follows: ${agreementCounts}`;
      }
      userContent.push({
        type: "text",
        text,
      });
    });
  }

  return [
    {
      role: "system",
      content: aiPrompt.systemPrompt,
    },
    {
      role: "user",
      content: userContent,
    },
  ];
}
