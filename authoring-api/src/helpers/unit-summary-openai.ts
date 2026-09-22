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

// maxRetries is 0 here because the unit-summary pipeline implements its own retry loop (2
// retries, 2s/8s backoff -- see unit-summary-config.ts and unit-summary-retry.ts), so the SDK's
// own retrying (different defaults, and no way to distinguish "retry" from "validation failure")
// never runs alongside it and double-retries.
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
