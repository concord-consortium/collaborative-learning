// Orchestrates the full unit-summary generation: assemble, size-check, digest, then the approach
// step running alongside prior-knowledge and the overview, then validate. Kept separate from
// routes/generate-unit-summary.ts (the thin Express handler that resolves the real secret/params
// and calls this) so it is testable with a fake assembler and a fake OpenAI client -- neither
// Firebase nor Express needs to exist for a test.
import {IUnitSummary, IUnitSummaryEntry, validateUnitSummary} from "../../../shared/unit-summary-types";
import {AssembledUnit} from "./assemble-unit";
import {createConcurrencyLimiter} from "./concurrency";
import {generateProblemApproaches} from "./unit-summary-approach";
import {generateProblemDigests} from "./unit-summary-digest";
import {checkUnitSize, selectPriorKnowledgeMode} from "./unit-summary-limits";
import {
  UNIT_SUMMARY_CONCURRENCY_LIMIT, UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS, UNIT_SUMMARY_HARD_MAX_PROBLEMS,
  UNIT_SUMMARY_OVERALL_DEADLINE_MS,
} from "./unit-summary-config";
import {UnitSummaryOpenAIClient} from "./unit-summary-openai";
import {generateOverview} from "./unit-summary-overview";
import {generatePriorKnowledge} from "./unit-summary-prior-knowledge";
import {withDeadline} from "./with-deadline";

export interface GenerateUnitSummaryDeps {
  assembleUnit: (branch: string, unit: string) => Promise<AssembledUnit>;
  client: UnitSummaryOpenAIClient;
  digestModel: string;
  summaryModel: string;
}

export async function runUnitSummaryGeneration(
  branch: string, unit: string, deps: GenerateUnitSummaryDeps
): Promise<IUnitSummary> {
  const assembled = await deps.assembleUnit(branch, unit);

  // A root content.json with no investigations, or only empty ones, assembles cleanly to zero
  // problems. checkUnitSize below has nothing to object to at N=0 (it only checks for too large),
  // so without this, generateOverview would send OpenAI an empty input for an opaque provider
  // error instead of a clear one -- and spend a request doing it.
  if (assembled.problems.length === 0) {
    throw new Error(`Unit "${unit}" has no problems to summarize`);
  }

  // Before any model call: a unit that would not fit even the cheaper rolling mode is rejected
  // up front, spending nothing.
  const sizeCheck = checkUnitSize(assembled.problems);
  if (!sizeCheck.ok) {
    // Either figure alone can be the reason (a few problems with huge Markdown can fail on
    // aggregate input while comfortably under the problem-count limit, and vice versa), so report
    // both rather than naming only the problem count and leaving the real cause unstated.
    throw new Error(
      "Unit too large to summarize " +
      `(${sizeCheck.problemCount} problems, limit ${UNIT_SUMMARY_HARD_MAX_PROBLEMS}; ` +
      `estimated input ${sizeCheck.estimatedAggregateInputChars} characters, ` +
      `limit ${UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS})`
    );
  }

  const mode = selectPriorKnowledgeMode(assembled.problems.length);

  return withDeadline(
    () => generateSteps(assembled, mode, deps),
    UNIT_SUMMARY_OVERALL_DEADLINE_MS,
    `Generation exceeded the ${UNIT_SUMMARY_OVERALL_DEADLINE_MS / 1000}s deadline`
  );
}

async function generateSteps(
  assembled: AssembledUnit, mode: ReturnType<typeof selectPriorKnowledgeMode>, deps: GenerateUnitSummaryDeps
): Promise<IUnitSummary> {
  const {client, digestModel, summaryModel} = deps;

  // The digest step keeps its own pool and finishes first: everything below reads its output.
  const digests = await generateProblemDigests(assembled.problems, {client, model: digestModel});

  // One limiter for everything after the digests, so the approach step and the prior-knowledge /
  // overview chain cannot exceed today's total between them. They run side by side rather than
  // one after the other because in rolling mode prior knowledge is a chain of calls that each
  // wait for the one before -- it holds a single slot and is the slowest part of a large unit, so
  // the approach calls mostly fill slots that chain leaves idle. Running them before or after
  // would instead add roughly ceil(N / 8) rounds to the part nearest the deadline. The approach
  // step asks for one worker fewer than the limit so that chain never queues behind it.
  const limiter = createConcurrencyLimiter(UNIT_SUMMARY_CONCURRENCY_LIMIT);
  const summarySteps = async () => {
    // The overview reads the digests, not the prior knowledge, but it stays behind it in one
    // chain so that the side-by-side pair is "approach" and "everything else".
    const priorKnowledge = await generatePriorKnowledge(
      assembled.problems, digests, {client, model: summaryModel, mode, limiter}
    );
    const overview = await generateOverview(
      assembled.problems, digests, {client, model: summaryModel, limiter}
    );
    return {priorKnowledge, overview};
  };
  const [approaches, {priorKnowledge, overview}] = await Promise.all([
    generateProblemApproaches(assembled.problems, digests, {client, model: digestModel, limiter}),
    summarySteps(),
  ]);

  const entries: IUnitSummaryEntry[] = assembled.problems.map((problem, i) => ({
    ordinal: problem.ordinal,
    priorKnowledge: priorKnowledge[i],
    problemDigest: digests[i],
    approach: approaches[i].approach,
    // Left off entirely when there is none, rather than written as "": validation rejects an
    // empty-but-present guidance's own absent label, and the slice treats absent as "say nothing".
    ...(approaches[i].approachGuidance ? {approachGuidance: approaches[i].approachGuidance} : {}),
  }));

  const summary: IUnitSummary = {
    generatedAt: new Date().toISOString(),
    // Filled from the assembler, never from the model.
    sourceHash: assembled.sourceHash,
    sourceManifest: assembled.sourceManifest,
    overview,
    entries,
  };

  // A defensive backstop, not an expected failure mode: nothing above asks the model to report
  // an ordinal, so entries and sourceManifest can only disagree if a bug elsewhere (e.g. in the
  // assembler) produced a broken AssembledUnit. Catching that here means the author sees an error
  // instead of a broken summary.
  const validation = validateUnitSummary(summary, assembled.problems.map((p) => p.ordinal));
  if (!validation.valid) {
    throw new Error(`Generated summary failed validation: ${validation.errors.join("; ")}`);
  }

  return summary;
}
