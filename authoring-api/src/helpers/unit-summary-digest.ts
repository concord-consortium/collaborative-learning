// The digest step: one OpenAI call per problem, input = only that problem's own Markdown, output
// = its problemDigest. This is the first of the three generation steps (digest, prior-knowledge,
// overview -- see docs/plans/CLUE-685-plan.md §2.3); the other two are added in step 2.5.
//
// The input-visibility rule ("a digest must not see any other problem's content") is enforced by
// construction here: each call's `input` is built from exactly one AssembledProblem, never a
// collection of them, so there is no path by which another problem's text could reach a request.
import {UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {mapWithConcurrency} from "./concurrency";
import {UNIT_SUMMARY_CALL_TIMEOUT_MS, UNIT_SUMMARY_CONCURRENCY_LIMIT, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS}
  from "./unit-summary-config";
import {generateWithLengthLimit} from "./unit-summary-length-limit";
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";

const DIGEST_INSTRUCTIONS =
  "You are helping build a compact reference summary of a curriculum unit, for other AI " +
  "features to use as background context. You will be given the content of ONE problem from " +
  "the unit, converted to Markdown. Write a concise digest, in 3 to 5 sentences and no more than " +
  `${UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} characters, of what this problem covers and has ` +
  "students do. Only use information in the provided content -- do not infer or reference " +
  "anything else, including other problems in the unit.";

// A problem can have no extractable text (an image-only section, a not-yet-authored placeholder,
// etc.), which would otherwise send OpenAI an empty `input` and get back a 400. Skip the call and
// use this fixed digest instead, so one thin problem doesn't block generating the rest of the unit.
export const EMPTY_PROBLEM_DIGEST = "(No content provided for this problem.)";

const COMBINE_DIGESTS_INSTRUCTIONS =
  "You are given several partial digests describing different parts of the SAME curriculum " +
  "problem (it was split into parts only because its content was too long for one request). " +
  "Combine them into a single digest, in 3 to 5 sentences and no more than " +
  `${UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} characters, of what this problem covers and has ` +
  "students do. Do not mention that it was split into parts.";

export interface DigestOptions {
  client: UnitSummaryOpenAIClient;
  model: string;
}

// One problemDigest per problem, in the same order as `problems`.
export async function generateProblemDigests(
  problems: AssembledProblem[], options: DigestOptions
): Promise<string[]> {
  return mapWithConcurrency(
    problems, UNIT_SUMMARY_CONCURRENCY_LIMIT,
    (problem) => digestOneProblem(problem, options)
  );
}

async function digestOneProblem(problem: AssembledProblem, options: DigestOptions): Promise<string> {
  try {
    if (!problem.markdown.trim()) {
      return EMPTY_PROBLEM_DIGEST;
    }
    if (problem.markdown.length <= UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS) {
      return await callDigest(problem.markdown, options);
    }
    const chunks = chunkMarkdown(problem.markdown, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);
    // Sequential, not Promise.all: the outer pool already allows up to UNIT_SUMMARY_CONCURRENCY_LIMIT
    // problems in flight at once, so an unbounded fan-out here could push the total OpenAI calls in
    // flight well past that limit if several concurrently-processed problems all need chunking.
    // Doing one chunk call at a time keeps each pool worker's own contribution to exactly one call.
    const chunkDigests: string[] = [];
    for (const chunk of chunks) {
      chunkDigests.push(await callDigest(chunk, options));
    }
    return await callCombineDigests(chunkDigests, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Problem ${problem.ordinal}: digest failed: ${message}`);
  }
}

function callDigest(markdown: string, {client, model}: DigestOptions): Promise<string> {
  return generateWithLengthLimit({
    client, model, instructions: DIGEST_INSTRUCTIONS, input: markdown,
    timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS, maxChars: UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS,
    fieldName: "digest",
  });
}

function callCombineDigests(chunkDigests: string[], {client, model}: DigestOptions): Promise<string> {
  const input = chunkDigests.map((digest, i) => `Part ${i + 1}: ${digest}`).join("\n\n");
  return generateWithLengthLimit({
    client, model, instructions: COMBINE_DIGESTS_INSTRUCTIONS, input,
    timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS, maxChars: UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS,
    fieldName: "digest",
  });
}

// Splits on paragraph breaks first, greedily packing paragraphs into each chunk, so a chunk
// boundary falls between paragraphs rather than through the middle of one wherever possible. A
// single paragraph longer than the budget on its own still has to be hard-split, or that chunk
// would exceed the budget regardless.
export function chunkMarkdown(markdown: string, maxChars: number): string[] {
  const paragraphs = markdown.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks.flatMap((chunk) => (chunk.length > maxChars ? hardSplit(chunk, maxChars) : [chunk]));
}

function hardSplit(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    parts.push(text.slice(i, i + maxChars));
  }
  return parts;
}
