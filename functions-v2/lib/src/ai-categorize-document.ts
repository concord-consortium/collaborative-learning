import OpenAI from "openai";
import {zodResponseFormat} from "openai/helpers/zod";
import {z} from "zod";
import fs from "node:fs/promises";

const prompt = `This is a picture of a student document.
They are working on engineering task. Please tell me which of the following areas of their design they are focusing on:
- user: who's it for?
- environment: where's it used?
- form: what's it look like?
- function: what does it do?
and why you chose that area.
Or if the document doesn't include enough content to clearly identify a focus area let me know by setting "category" to "unknown".
Your answer should be a JSON document in the given format.`;

// Require a specific JSON schema for the model output
const CategorizationResponse = z.object({
  category: z.enum(["user", "environment", "form", "function", "unknown"],
    {description: "The focus area of the document"}),
  keyIndicators: z.array(z.string(),
    {description: "List of main features or elements of the document that support this categorization"}),
  discussion: z.string(
    {description: "Any other relevant information."}),
});

export async function categorizeDocument(file: string, apiKey: string) {
  const imageLoading = fs.readFile(file).then((data) => data.toString("base64"));
  const image = await imageLoading;
  const url = `data:image/png;base64,${image}`;
  return categorizeUrl(url, apiKey);
}

export async function categorizeUrl(url: string, apiKey: string) {
  const openai = new OpenAI({apiKey});
  try {
    return openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      // model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: "You are a teaching assistant in an engineering design course.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
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
      response_format: zodResponseFormat(CategorizationResponse, "categorization-response"),
    });
  } catch (error) {
    console.log("OpenAI error", error);
    return undefined;
  }
}
