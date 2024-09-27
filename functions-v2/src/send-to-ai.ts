import {onDocumentWritten} from "firebase-functions/v2/firestore";
import OpenAI from "openai";
import {zodResponseFormat} from "openai/helpers/zod";
import {z} from "zod";
import fs from "node:fs/promises";
import * as logger from "firebase-functions/logger";
// import * as admin from "firebase-admin";

// Ultimately this should take screenshots generated of user documents and pass them to the AI service for processing.
// For now, we'll just use the OpenAI chat endpoint to test the concept.

const prompt = `This is a picture of a student document.
They are working on engineering task. Please tell me which of the following areas of their design they are focusing on:
- user: who's it for?
- environment: where's it used?
- form: what's it look like?
- function: what does it do?
and why you chose that area.
Or if the document doesn't include enough content to identify a focus area let me know.
Your answer should be a JSON document in the given format.`;

// const sample = `I designed a fancy rainbarrel for my backyard. It's a 3D printed barrel with a spigot at the bottom.
// I chose this design because I wanted to collect rainwater for my garden. I also wanted it to look nice in my yard.`;

// const sample = `I designed a rainbarrel for the town park. It's a large barrel with multiple inlets and several spigots.
// This should allow it to collect rainwater from the roof of the park building and provide water for the park's gardens.`;

// const sample = `I designed a rainbarrel specifically for the school garden. It's safe for kids, fits in with the landscaping,
// and is just the right size for the garden on School Street.`;

// const sample = "This is a rainbarrel";

// Load the image data from disk and base64 encode it
const sampleImageFile = "./image0.png";
const imageLoading = fs.readFile(sampleImageFile).then((data) => data.toString("base64"));

// Require a specific JSON schema for the model output
const CategorizationResponse = z.object({
  success: z.boolean(
    {description: "Whether a category could be determined from the input"}),
  category: z.enum(["user", "environment", "form", "function", "unknown"],
    {description: "The focus area of the document"}),
  keyIndicators: z.array(z.string(),
    {description: "List of main features or elements of the document that support this categorization"}),
  discussion: z.string(
    {description: "Any other relevant information."}),
});

// TODO - not yet sure what should trigger this function. It needs to run after a screenshot is generated.
export const onProcessingQueueWritten =
  onDocumentWritten("demo/AI/portals/demo/aiProcessingQueue/{docId}",
    async (event) => {
      const {docId} = event.params;
      logger.info("Document update noticed", event.document, docId);

      const image = await imageLoading;

      const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
      try {
        const completion = await openai.beta.chat.completions.parse({
          model: "gpt-4o-mini", // "gpt-4o-2024-08-06", // or "gpt-4o-mini"
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
                    url: `data:image/png;base64,${image}`,
                    detail: "auto", // auto, low, high
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(CategorizationResponse, "categorization-response"),
        });
        console.log("OpenAI completion object:", completion);
        console.log("Message part:", completion.choices[0].message);
        console.log("Parsed:", completion.choices[0].message.parsed);
        console.log("Category:", completion.choices[0].message.parsed?.category);
        // For costs see https://openai.com/api/pricing/
        // Currently something like $5/1M input, $15/1M output tokens
        console.log("Cost in tokens in/out:", completion.usage?.prompt_tokens, completion.usage?.completion_tokens);
        logger.info("OpenAI completion", completion);

        // Example "completion" response:
        // OpenAI completion {
        //   id: 'chatcmpl-ABooMh7LivXPpVpUG6CuGXHZ33426',
        //   object: 'chat.completion',
        //   created: 1727380290,
        //   model: 'gpt-4o-mini-2024-07-18',
        //   choices: [
        //     {
        //       index: 0,
        //       message: {
        //         role: 'assistant',
        //         content: 'text...',
        //         refusal: null
        //       },
        //       logprobs: null,
        //       finish_reason: 'stop'
        //     }
        //   ],
        //   usage: {
        //     prompt_tokens: 24,
        //     completion_tokens: 300,
        //     total_tokens: 324,
        //     completion_tokens_details: { reasoning_tokens: 0 }
        //   },
        //   system_fingerprint: 'fp_1bb46167f9'
        // }
      } catch (error) {
        console.log("OpenAI error", error);
        logger.error("OpenAI error", error);
      }
    });


