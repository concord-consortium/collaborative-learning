// The up-front size check (run before any model call) and the prior-knowledge mode selection.
// Both read only the assembler's per-problem sizes and the configured digest/prior-knowledge
// limits -- never anything from a model response -- so both are decidable before spending
// anything.
import {UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS, UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS}
  from "../../../shared/unit-summary-types";
import {AssembledProblem} from "./assemble-unit";
import {
  UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS, UNIT_SUMMARY_HARD_MAX_PROBLEMS,
  UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT,
} from "./unit-summary-config";

export type PriorKnowledgeMode = "prefix" | "rolling";

// At or below the threshold: prefix mode, where call i sees digests 0..i-1 (quadratic in problem
// count, but the calls are independent and can run concurrently). Above it: rolling mode, where
// call i sees only priorKnowledge(i-1) and digest(i-1) (linear, but sequential by definition).
export function selectPriorKnowledgeMode(problemCount: number): PriorKnowledgeMode {
  return problemCount > UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT ? "rolling" : "prefix";
}

export interface UnitSizeCheck {
  ok: boolean;
  problemCount: number;
  estimatedAggregateInputChars: number;
}

// Estimates the total input characters generation would send across every call, in whichever mode
// is cheaper (rolling), and rejects up front if even that would exceed the hard maximum. The
// digest step's total input is bounded by the assembled Markdown itself (chunking splits a large
// problem across more calls; it does not reduce how much of that problem's text is sent overall).
// The overview call sees every digest once. Rolling-mode prior knowledge is linear: each call
// sees one prior priorKnowledge plus one digest.
export function checkUnitSize(problems: AssembledProblem[]): UnitSizeCheck {
  const problemCount = problems.length;
  const totalMarkdownChars = problems.reduce((sum, p) => sum + p.markdown.length, 0);
  const overviewInputChars = problemCount * UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS;
  const rollingPriorKnowledgeInputChars =
    problemCount * (UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS + UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS);
  const estimatedAggregateInputChars = totalMarkdownChars + overviewInputChars + rollingPriorKnowledgeInputChars;

  const ok = problemCount <= UNIT_SUMMARY_HARD_MAX_PROBLEMS &&
    estimatedAggregateInputChars <= UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS;

  return {ok, problemCount, estimatedAggregateInputChars};
}
