import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import categorizeDocument from "../lib/src/ai-categorize-document";

// TODO this function will go away and the call to the AI service will be incorporated
// into on-analysis-image-ready.ts.

// As a proof of concept, this function just sends a sample image from the filesystem.

// Load the image data from disk and base64 encode it
// const sampleImageFile = "./image0.png";
const sampleImageFile = "./2/1350683-problem--O1IJaBTDBU86PD-PKbS.png";

export const onProcessingQueueWritten =
  onDocumentWritten("demo/AI/portals/demo/aiProcessingQueue/{docId}",
    async (event) => {
      const {docId} = event.params;
      logger.info("Document update noticed", event.document, docId);

      const completion = await categorizeDocument(sampleImageFile);

      console.log("OpenAI completion object:", completion);
      if (completion) {
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

        // In the case of a refusal, the message part would be like:
        // message: {
        //   role: 'assistant',
        //   content: null,
        //   refusal: "I'm sorry, I can't help with that."
        //   tool_calls: [],
        //   parsed: null
        // }
      }
    });


