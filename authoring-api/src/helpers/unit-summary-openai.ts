// The OpenAI seam the unit-summary generation route calls through, kept deliberately small (one
// method, plain strings in and out) so tests can substitute a fake instead of the real SDK client
// -- see functions-v2/test/chat-openai-provider.test.ts for the equivalent pattern there.
import OpenAI from "openai";

export interface GenerateTextParams {
  model: string;
  // The fixed task framing for this call (an OpenAI "instructions" / system-prompt equivalent).
  instructions: string;
  // The content to act on -- a problem's Markdown, a set of digests to combine, etc.
  input: string;
  timeoutMs: number;
}

export interface UnitSummaryOpenAIClient {
  generateText(params: GenerateTextParams): Promise<string>;
}

// SDK retries off; callWithRetry owns retrying.
export function createUnitSummaryOpenAIClient(apiKey: string): UnitSummaryOpenAIClient {
  const client = new OpenAI({apiKey, maxRetries: 0});
  return {
    async generateText({model, instructions, input, timeoutMs}) {
      const response = await client.responses.create(
        {model, instructions, input},
        {timeout: timeoutMs}
      );
      return response.output_text;
    },
  };
}
