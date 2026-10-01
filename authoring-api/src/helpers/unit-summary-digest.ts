// The digest step: one OpenAI call per problem, input = only that problem's own Markdown, output
// = its problemDigest. A digest must never see another problem's content; that's enforced here by
// construction, since each call's `input` is built from exactly one AssembledProblem.
import {UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {mapWithConcurrency} from "./concurrency";
import {
  fitsOneCall, UNIT_SUMMARY_CALL_TIMEOUT_MS, UNIT_SUMMARY_CONCURRENCY_LIMIT,
  UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS,
}
  from "./unit-summary-config";
import {generateWithLengthLimit} from "./unit-summary-length-limit";
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";

const DIGEST_INSTRUCTIONS =
  "You are helping build a compact reference summary of a curriculum unit, for other AI " +
  "features to use as background context. You will be given the content of ONE problem from " +
  "the unit, converted to Markdown. The problem is divided into sections, each marked with a " +
  "heading of the form \"# Section: <name>\" (for example \"# Section: Investigate\"). Write a " +
  "concise digest of what this problem covers and has students do, covering EVERY section named " +
  "in the input in roughly one or two sentences each -- do not stop after the first section. For " +
  "each section, say in a few words whether it asks students for several DIFFERENT ideas, " +
  "designs, methods or versions of the same thing, or for a single idea, design or answer. " +
  "Working through several steps, answering several questions, or producing several separate " +
  "pieces of work counts as a single idea, not as several -- what matters is whether students " +
  "are asked to come up with alternatives. If a section only supplies tools, reference material " +
  "or instructions and asks students for nothing, say that it sets no task. Stay " +
  `within ${UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} characters total. Only use information in the ` +
  "provided content -- do not infer or reference anything else, including other problems in the unit.";

// The approach step reads a digest to decide how its problem asks students to work, so shortening
// must not drop that. Passed with the length limit by every call that produces a digest.
const DIGEST_PRESERVE_NOTE =
  "Keep every section name, and keep whether each section asks students for several different " +
  "ideas or versions of the same thing, for a single idea, or for nothing at all.";

// A problem can have no extractable text (an image-only section, a not-yet-authored placeholder,
// etc.), which would otherwise send OpenAI an empty `input` and get back a 400. Skip the call and
// use this fixed digest instead, so one thin problem doesn't block generating the rest of the unit.
export const EMPTY_PROBLEM_DIGEST = "(No content provided for this problem.)";

// A problem byte-identical to an earlier one produces a byte-identical digest, so generating and
// storing a second copy is pure waste. No information is lost for a later prior-knowledge call --
// the first occurrence's real digest is already in that call's input.
export function duplicateProblemDigest(firstOrdinal: string): string {
  return `(same content as problem ${firstOrdinal})`;
}

// Labels a digest with the problem it belongs to. A later call given several digests together
// (prior-knowledge, overview) needs this to resolve a duplicateProblemDigest reference like
// "same content as problem 1.2" back to the one block of text actually labeled "Problem 1.2".
export function labelDigest(problem: AssembledProblem, digest: string): string {
  const titleSuffix = problem.title ? ` (${problem.title})` : "";
  return `Problem ${problem.ordinal}${titleSuffix}: ${digest}`;
}

const COMBINE_DIGESTS_INSTRUCTIONS =
  "You are given several partial digests describing different parts of the SAME curriculum " +
  "problem (it was split into parts only because its content was too long for one request). " +
  "Combine them into a single digest of what this problem covers and has students do, as briefly " +
  "as you can while still covering every section, and no more than " +
  `${UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS} characters. ` +
  "Keep every section named in the parts, and keep what each part said about " +
  "whether a section asks students for several different ideas or versions of the same thing, " +
  "for a single idea, or for nothing at all -- do not merge sections that ask for different " +
  "things into one general statement. Do not mention that it was split into parts.";

export interface DigestOptions {
  client: UnitSummaryOpenAIClient;
  model: string;
}

// One problemDigest per problem, in the same order as `problems`.
export async function generateProblemDigests(
  problems: AssembledProblem[], options: DigestOptions
): Promise<string[]> {
  // Computed once, up front, from the array's authored order -- not from which concurrent call
  // happens to finish first -- so the choice of which occurrence is "first" is deterministic
  // regardless of timing.
  const duplicateOfByOrdinal = findDuplicates(problems);
  return mapWithConcurrency(
    problems, UNIT_SUMMARY_CONCURRENCY_LIMIT,
    (problem) => digestOneProblem(problem, options, duplicateOfByOrdinal.get(problem.ordinal))
  );
}

// Maps a duplicate problem's ordinal to the ordinal of the first problem with the same
// problemHash. Two empty problems can share a problemHash too, but digestOneProblem checks for
// blank content before it ever looks at this map, so an empty problem never actually reaches the
// "same content as problem X" message this produces.
export function findDuplicates(problems: AssembledProblem[]): Map<string, string> {
  const firstOrdinalByHash = new Map<string, string>();
  const duplicateOfByOrdinal = new Map<string, string>();
  for (const problem of problems) {
    const firstOrdinal = firstOrdinalByHash.get(problem.problemHash);
    if (firstOrdinal) {
      duplicateOfByOrdinal.set(problem.ordinal, firstOrdinal);
    } else {
      firstOrdinalByHash.set(problem.problemHash, problem.ordinal);
    }
  }
  return duplicateOfByOrdinal;
}

async function digestOneProblem(
  problem: AssembledProblem, options: DigestOptions, duplicateOfOrdinal?: string
): Promise<string> {
  try {
    if (!problem.markdown.trim()) {
      return EMPTY_PROBLEM_DIGEST;
    }
    if (duplicateOfOrdinal) {
      return duplicateProblemDigest(duplicateOfOrdinal);
    }
    if (fitsOneCall(problem.markdown.length)) {
      return await callDigest(problem.markdown, options);
    }
    const chunks = chunkMarkdown(problem.markdown, UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS);
    // Sequential, not Promise.all: the outer pool already allows UNIT_SUMMARY_CONCURRENCY_LIMIT
    // problems in flight, so an unbounded fan-out here could push total in-flight calls well past
    // that limit.
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
    fieldName: "digest", preserve: DIGEST_PRESERVE_NOTE,
  });
}

function callCombineDigests(chunkDigests: string[], {client, model}: DigestOptions): Promise<string> {
  const input = chunkDigests.map((digest, i) => `Part ${i + 1}: ${digest}`).join("\n\n");
  return generateWithLengthLimit({
    client, model, instructions: COMBINE_DIGESTS_INSTRUCTIONS, input,
    timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS, maxChars: UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS,
    fieldName: "digest", preserve: DIGEST_PRESERVE_NOTE,
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
