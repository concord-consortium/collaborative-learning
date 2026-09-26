import {AssembledProblem} from "./assemble-unit";
import {
  UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS, UNIT_SUMMARY_HARD_MAX_PROBLEMS,
  UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT,
} from "./unit-summary-config";
import {checkUnitSize, selectPriorKnowledgeMode} from "./unit-summary-limits";

function problems(count: number, markdownLength = 100): AssembledProblem[] {
  return Array.from({length: count}, (_, i) => ({
    ordinal: `1.${i + 1}`, title: `P${i + 1}`, markdown: "x".repeat(markdownLength), problemHash: "hash",
  }));
}

describe("selectPriorKnowledgeMode", () => {
  it("selects prefix mode at and below the problem-count threshold", () => {
    expect(selectPriorKnowledgeMode(UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT)).toBe("prefix");
    expect(selectPriorKnowledgeMode(2)).toBe("prefix");
  });

  it("selects rolling mode above the problem-count threshold", () => {
    expect(selectPriorKnowledgeMode(UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT + 1)).toBe("rolling");
    expect(selectPriorKnowledgeMode(100)).toBe("rolling");
  });
});

describe("checkUnitSize", () => {
  it("accepts a typical small unit", () => {
    const result = checkUnitSize(problems(20));
    expect(result.ok).toBe(true);
    expect(result.problemCount).toBe(20);
  });

  it("rejects a unit over the hard maximum problem count", () => {
    const result = checkUnitSize(problems(UNIT_SUMMARY_HARD_MAX_PROBLEMS + 1));
    expect(result.ok).toBe(false);
    expect(result.problemCount).toBe(UNIT_SUMMARY_HARD_MAX_PROBLEMS + 1);
  });

  it("accepts a unit exactly at the hard maximum problem count (with modest per-problem sizes)", () => {
    const result = checkUnitSize(problems(UNIT_SUMMARY_HARD_MAX_PROBLEMS, 100));
    expect(result.ok).toBe(true);
  });

  it("rejects a unit within the problem-count limit but over the aggregate input budget", () => {
    // Large per-problem Markdown pushes the aggregate estimate over the hard character maximum
    // even though the problem count alone would be fine.
    const hugeMarkdownLength = UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS;
    const result = checkUnitSize(problems(5, hugeMarkdownLength));
    expect(result.ok).toBe(false);
    expect(result.estimatedAggregateInputChars).toBeGreaterThan(UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS);
  });
});
