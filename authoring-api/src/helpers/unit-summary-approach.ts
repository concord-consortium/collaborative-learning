// The approach step: one OpenAI call per problem, deciding how that problem asks students to
// work. Like the digest step, a call is given exactly one problem's material and never another's,
// which is what keeps the answer safe to send in a slice -- guidance that mentioned a later
// problem would break the no-look-ahead rule the whole summary exists to honor.
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

// Deliberately does NOT carry the digest prompt's two extra clauses -- that several steps count as
// one idea, and that Help/Resources sections set no task. Both earn their place there, where the
// input is a compressed summary. Measured here on 49 real problems they made this classifier
// worse: `mixed` fell from 15 to 9 and `unclear` from 16 to 11, with every shift running toward a
// more confident label. Fewer `mixed` is the fault we moved off the digest to avoid, and fewer
// `unclear` trades a safe abstention for a confident guess.
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

// Shortening rewrites the guidance knowing only a character budget, so it is told what the
// guidance is for; without this it can drop the "do not suggest" half, which is the part a
// consumer acts on.
const GUIDANCE_PRESERVE_NOTE =
  "Keep both what the problem asks students to do and what an assistant should not suggest " +
  "instead, and for a mixed problem keep the section names.";

export interface ApproachResult {
  approach: UnitSummaryProblemApproach;
  approachGuidance?: string;
}

export interface ApproachOptions {
  client: UnitSummaryOpenAIClient;
  // UNIT_SUMMARY_DIGEST_MODEL: this is a short classification of a short digest, so it belongs on
  // whichever model the per-problem calls use rather than the one the unit-level steps use.
  model: string;
  // This step runs beside prior knowledge and the overview, so it must not hold a pool of its
  // own: two pools of 8 would put 16 calls in flight. Optional so a test can drive it alone.
  limiter?: ConcurrencyLimiter;
}

// What one approach call reads: the problem's own Markdown where it fits in a single call, and
// its digest only for the rare problem too long for that.
//
// Classifying from the digest was measured against classifying from the full text over 49 real
// problems. The digest was the weaker input, and in a way that matters here: it compresses a
// multi-section problem into one label, so it misses problems that change what they ask for
// partway through -- the case `mixed` exists for. The extra cost is well under a dollar on the
// largest real unit, on a run a staff member starts by hand.
export function approachInput(problem: AssembledProblem, digest: string): string {
  return fitsOneCall(problem.markdown.length) ? problem.markdown : digest;
}

// One ApproachResult per problem, in the same order as `problems`. `digests` must be the finished
// digests for those same problems, in the same order, so the approach step has to run after the
// digest step has completed.
export async function generateProblemApproaches(
  problems: AssembledProblem[], digests: string[], options: ApproachOptions
): Promise<ApproachResult[]> {
  const duplicateOfByOrdinal = findDuplicates(problems);

  // Duplicates are resolved after the calls rather than during them: a duplicate copies the first
  // occurrence's answer, and under concurrency that answer may not exist yet when the duplicate
  // is reached. Only the problems that need a call are scheduled.
  const needsCall = problems
    .map((problem, i) => ({problem, digest: digests[i]}))
    .filter(({problem}) => !duplicateOfByOrdinal.has(problem.ordinal) && !!problem.markdown.trim());
  // One worker fewer than the shared limit, so a step running beside this one always has a slot.
  // It matters for the rolling prior-knowledge chain, which is a single call at a time: with a
  // full complement of workers here, that chain queues behind an approach call at the start and
  // finishes a little later for no gain. The approach calls still use every other slot.
  const computed = await mapWithConcurrency(
    needsCall, Math.max(1, UNIT_SUMMARY_CONCURRENCY_LIMIT - 1),
    ({problem, digest}) => approachForProblem(problem, digest, options),
    options.limiter
  );
  const resultByOrdinal = new Map<string, ApproachResult>();
  needsCall.forEach(({problem}, i) => resultByOrdinal.set(problem.ordinal, computed[i]));

  return problems.map((problem) => {
    // An empty problem has nothing to judge, and a digest saying so is not evidence of anything.
    if (!problem.markdown.trim()) return {approach: "unclear"};
    const duplicateOf = duplicateOfByOrdinal.get(problem.ordinal);
    // Identical content gives an identical answer, so a second call would buy nothing.
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
    // callWithRetry retries transport failures only, so an unreadable *answer* needs its own
    // loop. Two attempts: a model that garbles the format twice is unlikely to get it right on a
    // third, and this call is made once per problem.
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await callWithRetry(() => client.generateText({
        model, instructions: APPROACH_INSTRUCTIONS, input, timeoutMs: UNIT_SUMMARY_CALL_TIMEOUT_MS,
      }));
      const parsed = parseApproachAnswer(text);
      if (!parsed) continue;
      // A label with no guidance is a readable answer -- the label is what consumers act on, and
      // guidance is optional in the data model. Only non-blank guidance goes to fitToLength,
      // which rejects empty text and would otherwise fail the step over a good label.
      if (!parsed.guidance) {
        return {approach: parsed.approach};
      }
      return {approach: parsed.approach, ...await fitGuidance(parsed.guidance, options)};
    }
    // Two unreadable answers is a judgment we could not obtain, not a failure of the run: the
    // consumers treat a missing approach as "say nothing", which is the safe outcome. A transport
    // failure is different and falls to the catch below.
    return {approach: "unclear"};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Problem ${problem.ordinal}: approach failed: ${message}`);
  }
}

// Shortening over-long guidance is itself a model call, so it has the same two failure modes as
// any other: an outage, or an answer we cannot use. Only the first should stop a generation. A
// shorten call that comes back blank costs the guidance, not the label and not the run -- the
// label is the part consumers act on, and the alternative is failing a whole unit's summary over
// one problem's second-order call.
async function fitGuidance(
  guidance: string, {client, model}: ApproachOptions
): Promise<{approachGuidance?: string}> {
  try {
    // Not wrapped in the limiter: this runs inside a slot the approach call already holds, and
    // waiting on the same limiter from inside it would deadlock once every slot is taken.
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
  // "" when the model gave a label and no guidance, which is a readable answer: the label is
  // what consumers act on, and guidance is optional in the data model.
  guidance: string;
}

// Matches one of the two markers however a model happens to dress it up: a list bullet or heading
// before it, bold either side of the colon, whitespace anywhere. The value is whatever follows.
function markerPattern(marker: string): RegExp {
  return new RegExp(`^[\\s>*_#-]*\\**${marker}\\**\\s*:\\s*\\**[ \\t]*([\\s\\S]*)$`, "im");
}

// Strips the decoration a model puts around a short value -- bold, quotes, backticks, a trailing
// full stop -- so the label can be compared against the known set. Not used on the guidance,
// where a trailing full stop is just the end of a sentence.
function cleanLabel(value: string): string {
  // One pass over both ends rather than quotes-then-punctuation, so a label wrapped in both --
  // `"Convergent".` -- comes out clean whichever order they are in. A known label contains none
  // of these characters, so nothing real is lost.
  return value.replace(/^[\s*_`"'.,;:]+|[\s*_`"'.,;:]+$/g, "").toLowerCase();
}

// Tolerant of the things a model varies on its own -- blank lines, capitalisation, bold, a
// trailing full stop, a missing GUIDANCE line -- and strict about the one thing that matters,
// which is that the label is one we know. An unrecognised label returns undefined, which costs a
// second attempt and then falls back to "unclear", so being forgiving here is what keeps a
// perfectly clear problem from being recorded as unclear over a pair of asterisks.
export function parseApproachAnswer(text: string): ParsedApproachAnswer | undefined {
  const approachMatch = markerPattern("APPROACH").exec(text);
  if (!approachMatch) return undefined;
  // Only the marker's own line holds the label; anything after it belongs to GUIDANCE.
  const label = cleanLabel(approachMatch[1].split("\n", 1)[0]);
  if (!(UNIT_SUMMARY_PROBLEM_APPROACHES as readonly string[]).includes(label)) return undefined;

  // Everything after the GUIDANCE marker, so guidance that runs onto a second line survives --
  // but stopping at an APPROACH marker, in case the model wrote the two the other way round.
  // Without the cut, reversing them puts "APPROACH: convergent" inside the guidance, and that
  // text goes on to every consumer.
  const guidanceMatch = markerPattern("GUIDANCE").exec(text);
  const guidance = guidanceMatch ? cleanGuidance(cutAtMarker(guidanceMatch[1], "APPROACH")) : "";
  return {approach: label as UnitSummaryProblemApproach, guidance};
}

// Trims a captured value where a later marker begins. The marker has to start a line, so a
// sentence that merely uses the word ("do not suggest a different approach") is left alone.
function cutAtMarker(value: string, marker: string): string {
  const match = markerPattern(marker).exec(value);
  return match ? value.slice(0, match.index) : value;
}

function cleanGuidance(value: string): string {
  return value.trim().replace(/^[*_`"']+|[*_`"']+$/g, "").trim();
}
