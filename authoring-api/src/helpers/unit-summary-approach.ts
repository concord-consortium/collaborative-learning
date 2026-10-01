// One call per problem, deciding how that problem asks students to work. Each call sees exactly
// one problem, so its guidance can never mention a later one and break the no-look-ahead rule.
import {
  UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS, UNIT_SUMMARY_PROBLEM_APPROACHES,
  UnitSummaryProblemApproach,
} from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {ConcurrencyLimiter, mapWithConcurrency} from "./concurrency";
import {
  fitsOneCall, UNIT_SUMMARY_CALL_TIMEOUT_MS, UNIT_SUMMARY_CONCURRENCY_LIMIT,
} from "./unit-summary-config";
import {findDuplicates} from "./unit-summary-digest";
import {fitToLength} from "./unit-summary-length-limit";
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";
import {callWithRetry, isTransportError} from "./unit-summary-retry";

const APPROACH_INSTRUCTIONS =
  "You will be given ONE curriculum problem: usually its full content as Markdown, divided into " +
  "sections headed \"# Section: <name>\"; for a very long problem, a digest describing each " +
  "section instead. Decide how the problem asks students to work. divergent: it asks students to " +
  "generate or try many different ideas, options, or versions. convergent: it asks students to " +
  "choose one idea or design and develop, refine, or elaborate on it. mixed: different sections " +
  "ask for different approaches. unclear: the problem does not ask for either (for example, it " +
  "is only reading or data collection). " +
  "Base this only on what the problem itself asks students to do. Then write one or two plain " +
  "sentences saying what the problem asks students to do and what an assistant should not " +
  "suggest instead. For mixed, name the sections in order and say what each one asks for, so a " +
  "reader can tell which stage a student is in. Reply in exactly this form, with nothing else:" +
  "\nAPPROACH: <one of divergent, convergent, mixed, unclear>\nGUIDANCE: <your one or two " +
  "sentences>";

// Shortening sees only a character budget, so it is told what to keep; otherwise it drops the
// "do not suggest" half, which is the part consumers act on.
const GUIDANCE_PRESERVE_NOTE =
  "Keep both what the problem asks students to do and what an assistant should not suggest " +
  "instead, and for a mixed problem keep the section names.";

export interface ApproachResult {
  approach: UnitSummaryProblemApproach;
  approachGuidance?: string;
}

export interface ApproachOptions {
  client: UnitSummaryOpenAIClient;
  model: string;
  // Optional so a test can drive this step alone. Two steps each holding their own pool would put
  // twice the limit in flight.
  limiter?: ConcurrencyLimiter;
}

// The digest is a fallback: it compresses a multi-section problem into one label, which loses the
// very changes `mixed` exists to catch.
export function approachInput(problem: AssembledProblem, digest: string): string {
  return fitsOneCall(problem.markdown.length) ? problem.markdown : digest;
}

// Results are in the same order as `problems`. `digests` must be those same problems' finished
// digests, in the same order, so this must run after the digest step.
export async function generateProblemApproaches(
  problems: AssembledProblem[], digests: string[], options: ApproachOptions
): Promise<ApproachResult[]> {
  const duplicateOfByOrdinal = findDuplicates(problems);

  // Duplicates copy the first occurrence's answer, which under concurrency may not exist yet when
  // the duplicate is reached, so they are resolved after the calls rather than during them.
  const needsCall = problems
    .map((problem, i) => ({problem, digest: digests[i]}))
    .filter(({problem}) => !duplicateOfByOrdinal.has(problem.ordinal) && !!problem.markdown.trim());
  // One worker fewer than the shared limit leaves a slot for whatever runs beside this step;
  // otherwise the single-call prior-knowledge chain queues behind an approach call.
  const computed = await mapWithConcurrency(
    needsCall, Math.max(1, UNIT_SUMMARY_CONCURRENCY_LIMIT - 1),
    ({problem, digest}) => approachForProblem(problem, digest, options),
    options.limiter
  );
  const resultByOrdinal = new Map<string, ApproachResult>();
  needsCall.forEach(({problem}, i) => resultByOrdinal.set(problem.ordinal, computed[i]));

  return problems.map((problem) => {
    if (!problem.markdown.trim()) return {approach: "unclear"};
    const duplicateOf = duplicateOfByOrdinal.get(problem.ordinal);
    if (duplicateOf) return resultByOrdinal.get(duplicateOf) ?? {approach: "unclear"};
    return resultByOrdinal.get(problem.ordinal) ?? {approach: "unclear"};
  });
}

async function approachForProblem(
  problem: AssembledProblem, digest: string, options: ApproachOptions
): Promise<ApproachResult> {
  const {client, model} = options;
  const input = approachInput(problem, digest);

  try {
    // callWithRetry covers transport failures only, so an unreadable answer needs its own loop.
    // A model that garbles the format twice is unlikely to get it right on a third attempt.
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await callWithRetry(() => client.generateText({
        model, instructions: APPROACH_INSTRUCTIONS, input, timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS,
      }));
      const parsed = parseApproachAnswer(text);
      if (!parsed) continue;
      // A label alone is usable, and fitToLength rejects empty text.
      if (!parsed.guidance) {
        return {approach: parsed.approach};
      }
      return {approach: parsed.approach, ...await fitGuidance(parsed.guidance, options)};
    }
    // Consumers treat a missing approach as "say nothing", so an unreadable answer costs the
    // label rather than the run. A transport failure falls to the catch below.
    return {approach: "unclear"};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Problem ${problem.ordinal}: approach failed: ${message}`);
  }
}

// A failed shorten costs the guidance, not the label and not the run. A transport failure is the
// exception and still stops the generation.
async function fitGuidance(
  guidance: string, {client, model}: ApproachOptions
): Promise<{approachGuidance?: string}> {
  try {
    // Not wrapped in the limiter: this runs inside a slot the approach call already holds, and
    // waiting on the same limiter from inside it deadlocks once every slot is taken.
    return {approachGuidance: await fitToLength(guidance, {
      client, model, timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS,
      maxChars: UNIT_SUMMARY_APPROACH_GUIDANCE_MAX_CHARS,
      fieldName: "approachGuidance", preserve: GUIDANCE_PRESERVE_NOTE,
    })};
  } catch (error) {
    if (isTransportError(error)) throw error;
    return {};
  }
}

interface ParsedApproachAnswer {
  approach: UnitSummaryProblemApproach;
  // "" when the model gave a label and no guidance.
  guidance: string;
}

// Matches a marker however a model dresses it up: a bullet or heading before it, bold either side
// of the colon, whitespace anywhere. Captures whatever follows.
function markerPattern(marker: string): RegExp {
  return new RegExp(`^[\\s>*_#-]*\\**${marker}\\**\\s*:\\s*\\**[ \\t]*([\\s\\S]*)$`, "im");
}

// Strips bold, quotes, backticks and trailing punctuation so the label can be compared against
// the known set. Not used on guidance, where a trailing full stop ends a sentence.
function cleanLabel(value: string): string {
  return value.replace(/^[\s*_`"'.,;:]+|[\s*_`"'.,;:]+$/g, "").toLowerCase();
}

// Forgiving about formatting, strict about the label. An unrecognized label returns undefined,
// which costs an attempt and then falls back to "unclear".
export function parseApproachAnswer(text: string): ParsedApproachAnswer | undefined {
  const approachMatch = markerPattern("APPROACH").exec(text);
  if (!approachMatch) return undefined;
  // Only the marker's own line holds the label; anything after it belongs to GUIDANCE.
  const label = cleanLabel(approachMatch[1].split("\n", 1)[0]);
  if (!(UNIT_SUMMARY_PROBLEM_APPROACHES as readonly string[]).includes(label)) return undefined;

  // Everything after the GUIDANCE marker, so guidance running onto a second line survives. Cut at
  // an APPROACH marker in case the model wrote the two the other way round.
  const guidanceMatch = markerPattern("GUIDANCE").exec(text);
  const guidance = guidanceMatch ? cleanGuidance(cutAtMarker(guidanceMatch[1], "APPROACH")) : "";
  return {approach: label as UnitSummaryProblemApproach, guidance};
}

// The marker must start a line, so a sentence that merely uses the word is left alone.
function cutAtMarker(value: string, marker: string): string {
  const match = markerPattern(marker).exec(value);
  return match ? value.slice(0, match.index) : value;
}

function cleanGuidance(value: string): string {
  return value.trim().replace(/^[*_`"']+|[*_`"']+$/g, "").trim();
}
