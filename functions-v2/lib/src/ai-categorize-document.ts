import OpenAI from "openai";
import {zodResponseFormat} from "openai/helpers/zod";
import {z} from "zod";
import fs from "node:fs/promises";

interface IAiPrompt {
  mainPrompt: string;
  categorizationDescription: string;
  categories: string[];
  keyIndicatorsPrompt: string;
  discussionPrompt: string;
  systemPrompt: string;
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

function buildZodResponseSchema(aiPrompt: IAiPrompt) {
  return z.object({
    category: z.enum(["unknown", ...aiPrompt.categories],
      {description: aiPrompt.categorizationDescription}),
    keyIndicators: z.array(z.string(),
      {description: aiPrompt.keyIndicatorsPrompt}),
    discussion: z.string(
      {description: aiPrompt.discussionPrompt}),
  });
}

export async function categorizeUrl(url: string, apiKey: string, aiPrompt = defaultAiPrompt) {
  const openai = new OpenAI({apiKey});
  try {
    return openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      // model: "gpt-4o-2024-08-06",
      messages: [
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
      ],
      response_format: zodResponseFormat(buildZodResponseSchema(aiPrompt), "categorization-response"),
    });
  } catch (error) {
    console.log("OpenAI error", error);
    return undefined;
  }
}
