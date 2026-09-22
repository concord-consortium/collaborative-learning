// The prior-knowledge step: one OpenAI call per problem after the first, producing what a
// student should already know by the time they reach that problem. See
// docs/plans/CLUE-685-plan.md §2.1 ("first-problem prerequisites") and §2.3.
//
// The input-visibility rule ("never digest i or anything later") is enforced by construction:
// prefix mode's call i is built from digests.slice(0, i), and rolling mode's call i is built from
// only the previous call's own output plus digest i-1 -- neither can reach a later digest because
// neither is ever given one.
import {UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {mapWithConcurrency} from "./concurrency";
import {PriorKnowledgeMode} from "./unit-summary-limits";
import {UNIT_SUMMARY_CALL_TIMEOUT_MS, UNIT_SUMMARY_CONCURRENCY_LIMIT} from "./unit-summary-config";
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";
import {callWithRetry} from "./unit-summary-retry";

const PREFIX_INSTRUCTIONS =
  "You are helping build a compact reference summary of a curriculum unit, for other AI " +
  "features to use as background context. You will be given the digests of every problem in " +
  "this unit that comes BEFORE the student's current problem, in order. Write a concise, " +
  "cumulative statement, in at most 8 sentences no matter how many problems come before, of " +
  "what a student should already know or have done by the time they reach the current problem. " +
  "Only use information in the provided digests -- do not infer or reference anything else, " +
  "including the current problem itself or anything after it.";

const ROLLING_INSTRUCTIONS =
  "You are helping build a compact reference summary of a curriculum unit, for other AI " +
  "features to use as background context. You will be given a cumulative statement of what a " +
  "student has covered in this unit so far, followed by a digest of the one problem completed " +
  "most recently. Write an UPDATED, concise, cumulative statement, in at most 8 sentences, of " +
  "what a student should already know or have done by the time they reach the next problem, " +
  "folding the most recent problem's digest in with what came before. Only use information in " +
  "the provided text -- do not infer or reference anything else.";

export interface PriorKnowledgeOptions {
  client: UnitSummaryOpenAIClient;
  model: string;
  mode: PriorKnowledgeMode;
}

// priorKnowledge for entry 0, describing what a student brings INTO the unit. No real unit's
// root content.json currently has a free-text field for this (checked against every unit in
// clue-curriculum: the fields present are abbrevTitle, appName, code, config, defaultStamps,
// investigations, navTabs, placeholderText, planningDocument, sections, settings, subtitle,
// supports, title -- none states what a student should already know coming in). Generating
// something from a bare title would be fabrication, which entry 0 must never do, so it is always
// empty for now. If curriculum authoring adds such a field, generate from it here instead.
function entryZeroPriorKnowledge(): string {
  return "";
}

// One priorKnowledge string per problem, in the same order as `problems`/`digests`.
export async function generatePriorKnowledge(
  problems: AssembledProblem[], digests: string[], options: PriorKnowledgeOptions
): Promise<string[]> {
  if (problems.length === 0) {
    return [];
  }
  const entryZero = entryZeroPriorKnowledge();
  if (problems.length === 1) {
    return [entryZero];
  }

  const rest = options.mode === "rolling" ?
    await generateRolling(problems, digests, options) :
    await generatePrefix(problems, digests, options);
  return [entryZero, ...rest];
}

async function generatePrefix(
  problems: AssembledProblem[], digests: string[], options: PriorKnowledgeOptions
): Promise<string[]> {
  const targetIndices = problems.map((_, i) => i).slice(1);
  return mapWithConcurrency(targetIndices, UNIT_SUMMARY_CONCURRENCY_LIMIT, (i) =>
    callPriorKnowledge(digests.slice(0, i).join("\n\n"), problems[i], PREFIX_INSTRUCTIONS, options));
}

async function generateRolling(
  problems: AssembledProblem[], digests: string[], options: PriorKnowledgeOptions
): Promise<string[]> {
  const result: string[] = [];
  let previous = "";
  for (let i = 1; i < problems.length; i++) {
    const input = previous ? `${previous}\n\n${digests[i - 1]}` : digests[i - 1];
    const priorKnowledge = await callPriorKnowledge(input, problems[i], ROLLING_INSTRUCTIONS, options);
    result.push(priorKnowledge);
    previous = priorKnowledge;
  }
  return result;
}

async function callPriorKnowledge(
  input: string, problem: AssembledProblem, instructions: string, {client, model}: PriorKnowledgeOptions
): Promise<string> {
  try {
    return await callWithRetry(async () => {
      const text = await client.generateText({model, instructions, input, timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS});
      return validatePriorKnowledgeText(text);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Problem ${problem.ordinal}: priorKnowledge failed: ${message}`);
  }
}

function validatePriorKnowledgeText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("model returned an empty priorKnowledge");
  }
  if (trimmed.length > UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS) {
    throw new Error(
      `priorKnowledge exceeds ${UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS} characters (got ${trimmed.length})`
    );
  }
  return trimmed;
}
