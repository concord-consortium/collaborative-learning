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
import {generateWithLengthLimit} from "./unit-summary-length-limit";
import {PriorKnowledgeMode} from "./unit-summary-limits";
import {UNIT_SUMMARY_CALL_TIMEOUT_MS, UNIT_SUMMARY_CONCURRENCY_LIMIT} from "./unit-summary-config";
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";

// Shared by both modes below. A narrative, sentence-by-sentence restatement of "what the student
// now knows" is what made real prior-knowledge entries run long and repetitive (vibe review,
// CLUE-685 checklist step 2.7): padded with soft-skill filler ("critical thinking," "teamwork,"
// "hands-on experience," "reinforcing understanding") that names nothing, and re-explaining the
// same underlying facts in fresh prose on every call. A compact list of the actual concepts and
// skills is both more useful to a reader and structurally harder to pad, since there is no
// sentence to pad -- just items to list once.
const LIST_FORMAT_INSTRUCTIONS =
  "Write this as a compact list of the specific concepts, terms, and skills a student now has -- " +
  "not narrative prose or full sentences. Separate items with semicolons. Name the actual concept " +
  "or skill (e.g. \"EMG signal thresholds\", \"Dataflow gripper control\"); never use soft-skill " +
  "phrases like \"critical thinking,\" \"teamwork,\" \"hands-on experience,\" or \"reinforcing " +
  "understanding\" that name nothing specific. List each concept once -- do not restate the same " +
  "one in different words.";

const PREFIX_INSTRUCTIONS =
  "You are helping build a compact reference summary of a curriculum unit, for other AI " +
  "features to use as background context. You will be given the digests of every problem in " +
  "this unit that comes BEFORE the student's current problem, in order. " +
  `${LIST_FORMAT_INSTRUCTIONS} This is cumulative: list everything a student should already know ` +
  "or have done by the time they reach the current problem, no matter how many problems come " +
  `before, within ${UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS} characters. Only use information in ` +
  "the provided digests -- do not infer or reference anything else, including the current " +
  "problem itself or anything after it.";

const ROLLING_INSTRUCTIONS =
  "You are helping build a compact reference summary of a curriculum unit, for other AI " +
  "features to use as background context. You will be given a cumulative list of what a student " +
  "has covered in this unit so far, followed by a digest of the one problem completed most " +
  `recently. ${LIST_FORMAT_INSTRUCTIONS} Fold the most recently completed problem's new concepts ` +
  "and skills into the existing cumulative list, producing an UPDATED list of everything a " +
  "student should already know or have done by the time they reach the next problem, within " +
  `${UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS} characters. Only use information in the provided ` +
  "text -- do not infer or reference anything else.";

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
    return await generateWithLengthLimit({
      client, model, instructions, input, timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS,
      maxChars: UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS, fieldName: "priorKnowledge",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Problem ${problem.ordinal}: priorKnowledge failed: ${message}`);
  }
}
