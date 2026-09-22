// The overview step: one OpenAI call over every digest, producing the unit-level `overview`
// field. See docs/plans/CLUE-685-plan.md §2.3. This is the only generation call that sees the
// whole unit (all digests at once), which is why `overview` is not automatically safe for a
// student-facing consumer -- see shared/unit-summary-types.ts's IUnitSummary.overview comment.
import {UNIT_SUMMARY_OVERVIEW_MAX_CHARS} from "../../../shared/unit-summary-types";
import {chunkMarkdown} from "./unit-summary-digest";
import {UNIT_SUMMARY_CALL_TIMEOUT_MS, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS} from "./unit-summary-config";
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";
import {callWithRetry} from "./unit-summary-retry";

const OVERVIEW_INSTRUCTIONS =
  "You are helping build a compact reference summary of a curriculum unit, for other AI " +
  "features to use as background context. You will be given a digest of every problem in the " +
  "unit, in order. Write a single paragraph, in 3 to 5 sentences, describing what the unit as a " +
  "whole is about. Only use information in the provided digests -- do not infer or invent " +
  "anything else.";

const COMBINE_OVERVIEWS_INSTRUCTIONS =
  "You are given several partial overviews, each describing part of the SAME curriculum unit " +
  "(the full set of problem digests was split into parts only because it was too long for one " +
  "request). Combine them into a single overview paragraph, in 3 to 5 sentences, describing " +
  "what the unit as a whole is about. Do not mention that it was split into parts.";

export interface OverviewOptions {
  client: UnitSummaryOpenAIClient;
  model: string;
}

export async function generateOverview(digests: string[], options: OverviewOptions): Promise<string> {
  try {
    const allDigestsText = digests.join("\n\n");
    if (allDigestsText.length <= UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS) {
      return await callOverview(allDigestsText, options);
    }

    // Sequential, not concurrent: the overview call only ever runs once per generation (never
    // alongside another oversized overview), so there is no shared concurrency budget to protect
    // here the way there is for per-problem digests -- but keeping it simple and sequential costs
    // nothing, since this path is rare (only very large units trigger it).
    const chunks = chunkMarkdown(allDigestsText, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);
    const chunkOverviews: string[] = [];
    for (const chunk of chunks) {
      chunkOverviews.push(await callOverview(chunk, options));
    }
    return await callCombineOverviews(chunkOverviews, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`overview failed: ${message}`);
  }
}

function callOverview(input: string, {client, model}: OverviewOptions): Promise<string> {
  return callWithRetry(async () => {
    const text = await client.generateText({
      model, instructions: OVERVIEW_INSTRUCTIONS, input, timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS,
    });
    return validateOverviewText(text);
  });
}

function callCombineOverviews(chunkOverviews: string[], {client, model}: OverviewOptions): Promise<string> {
  const input = chunkOverviews.map((overview, i) => `Part ${i + 1}: ${overview}`).join("\n\n");
  return callWithRetry(async () => {
    const text = await client.generateText({
      model, instructions: COMBINE_OVERVIEWS_INSTRUCTIONS, input, timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS,
    });
    return validateOverviewText(text);
  });
}

function validateOverviewText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("model returned an empty overview");
  }
  if (trimmed.length > UNIT_SUMMARY_OVERVIEW_MAX_CHARS) {
    throw new Error(`overview exceeds ${UNIT_SUMMARY_OVERVIEW_MAX_CHARS} characters (got ${trimmed.length})`);
  }
  return trimmed;
}
