import {
  UNIT_SUMMARY_OVERVIEW_MAX_CHARS, UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS, UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS,
  UNIT_SUMMARY_TOTAL_BUDGET_CHARS,
} from "../../../shared/unit-summary-types";
import {UNIT_SUMMARY_HARD_MAX_PROBLEMS} from "./unit-summary-config";

describe("UNIT_SUMMARY_HARD_MAX_PROBLEMS", () => {
  it("stays low enough that a worst-case unit -- every field at its own maximum -- still fits " +
    "the total character budget", () => {
    // Entry 0 never has a priorKnowledge (see entryZeroPriorKnowledge in
    // unit-summary-prior-knowledge.ts), so only HARD_MAX_PROBLEMS - 1 problems can have one.
    // This is the same total the post-generation check in validateUnitSummary computes; if this
    // ever goes over budget, that check can only find out after every model call for the unit has
    // already run.
    const worstCaseTotalChars =
      UNIT_SUMMARY_OVERVIEW_MAX_CHARS +
      UNIT_SUMMARY_HARD_MAX_PROBLEMS * UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS +
      (UNIT_SUMMARY_HARD_MAX_PROBLEMS - 1) * UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS;
    expect(worstCaseTotalChars).toBeLessThanOrEqual(UNIT_SUMMARY_TOTAL_BUDGET_CHARS);
  });
});
