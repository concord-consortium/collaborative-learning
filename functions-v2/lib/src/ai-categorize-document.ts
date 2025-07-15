import OpenAI from "openai";
import {zodResponseFormat} from "openai/helpers/zod";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {z} from "zod";
import fs from "node:fs/promises";

interface IAiPrompt {
  systemPrompt: string;
  mainPrompt: string;
  categorizationDescription?: string;
  categories?: string[];
  keyIndicatorsPrompt?: string;
  discussionPrompt?: string;
}

const defaultAiPrompt: IAiPrompt = {
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

export async function categorizeDocument(file: string, apiKey: string) {
  const imageLoading = fs.readFile(file).then((data) => data.toString("base64"));
  const image = await imageLoading;
  const url = `data:image/png;base64,${image}`;
  return categorizeUrl(url, apiKey);
}

export function buildZodResponseSchema(aiPrompt: IAiPrompt) {
  const schema: Record<string, z.ZodType> = {};
  if (aiPrompt.categorizationDescription && aiPrompt.categories && aiPrompt.categories.length > 0) {
    schema.category = z.enum(["unknown", ...aiPrompt.categories],
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

export function buildMessages(aiPrompt: IAiPrompt, url: string): ChatCompletionMessageParam[] {
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

export async function categorizeUrl(url: string, apiKey: string, aiPrompt = defaultAiPrompt) {
  const openai = new OpenAI({apiKey});
  try {
    return openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      // model: "gpt-4o-2024-08-06",
      messages: buildMessages(aiPrompt, url),
      response_format: zodResponseFormat(z.object(buildZodResponseSchema(aiPrompt)), "categorization-response"),
    });
  } catch (error) {
    console.log("OpenAI error", error);
    return undefined;
  }
}
