// Shared by the digest, prior-knowledge, and overview steps: generate text, validate it against a
// field's character limit, give the model one chance to fix an over-length response, and truncate
// as a last resort rather than fail the whole generation over a marginal overshoot. A model can't
// count characters precisely as it writes, so even the shorten retry can leave a small overshoot;
// truncating only fires after that retry has already failed. An empty response is a different kind
// of failure -- nothing to shorten or truncate into something usable -- and is never retried or
// truncated here.
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";
import {callWithRetry} from "./unit-summary-retry";

const SHORTEN_INSTRUCTIONS =
  "The text you are given is too long for where it will be used. Rewrite it to fit within the " +
  "given character limit, keeping its meaning and its important details. Do not add any " +
  "information that was not already there.";

export interface LengthLimitedCallOptions {
  client: UnitSummaryOpenAIClient;
  model: string;
  instructions: string;
  input: string;
  timeoutMs: number;
  maxChars: number;
  // Used only in error messages, e.g. "digest", "priorKnowledge", "overview".
  fieldName: string;
}

export async function generateWithLengthLimit(options: LengthLimitedCallOptions): Promise<string> {
  const {client, model, instructions, input, timeoutMs, maxChars, fieldName} = options;
  const text = await callWithRetry(() => client.generateText({model, instructions, input, timeoutMs}));
  const trimmed = requireNonEmpty(text, fieldName);
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const shortenInput = `Character limit: ${maxChars}\n\nText to shorten:\n\n${trimmed}`;
  const shortened = await callWithRetry(() => client.generateText({
    model, instructions: SHORTEN_INSTRUCTIONS, input: shortenInput, timeoutMs,
  }));
  const shortenedTrimmed = requireNonEmpty(shortened, fieldName);
  if (shortenedTrimmed.length <= maxChars) {
    return shortenedTrimmed;
  }
  return truncateAtWordBoundary(shortenedTrimmed, maxChars);
}

function requireNonEmpty(text: string, fieldName: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`model returned an empty ${fieldName}`);
  }
  return trimmed;
}

// Cuts at the last whitespace at or before maxChars, so a still-over-length response after the
// shorten retry ends on a whole word instead of a fragment of one. Falls back to a hard cut only
// if there is no whitespace in range at all (a single "word" longer than the entire budget), which
// is not expected in practice for any of this pipeline's three fields.
function truncateAtWordBoundary(text: string, maxChars: number): string {
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.search(/\s\S*$/);
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
