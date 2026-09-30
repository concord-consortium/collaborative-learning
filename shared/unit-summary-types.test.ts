import {
  IUnitSummary, UNIT_SUMMARY_OVERVIEW_MAX_CHARS, UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS,
  UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS, UNIT_SUMMARY_TOTAL_BUDGET_CHARS, validateUnitSummary
} from "./unit-summary-types";

function validSummary(): IUnitSummary {
  return {
    generatedAt: "2026-09-21T12:00:00.000Z",
    sourceHash: "abc123",
    sourceManifest: [
      { ordinal: "1.1", title: "Introduction", problemHash: "hash1" },
      { ordinal: "1.2", title: "Getting Started", problemHash: "hash2" }
    ],
    overview: "This unit introduces students to the topic.",
    entries: [
      { ordinal: "1.1", priorKnowledge: "", problemDigest: "Students explore the topic." },
      { ordinal: "1.2", priorKnowledge: "Students have explored the topic.", problemDigest: "Students dig deeper." }
    ]
  };
}

const liveProblems = ["1.1", "1.2"];

describe("validateUnitSummary", () => {
  it("accepts a valid summary", () => {
    expect(validateUnitSummary(validSummary(), liveProblems)).toEqual({ valid: true });
  });

  it("rejects when entries and sourceManifest have different lengths", () => {
    const summary = validSummary();
    summary.entries.pop();
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/same length/);
  });

  it("rejects a missing ordinal (fewer entries than the live problem list)", () => {
    const summary = validSummary();
    summary.entries.pop();
    summary.sourceManifest.pop();
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/do not match the live problem list/);
  });

  it("rejects a duplicated ordinal", () => {
    const summary = validSummary();
    summary.sourceManifest[1] = { ...summary.sourceManifest[0] };
    summary.entries[1] = { ...summary.entries[0] };
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/duplicate ordinal/);
  });

  it("rejects an invented ordinal not in the live problem list", () => {
    const summary = validSummary();
    summary.sourceManifest[1].ordinal = "1.3";
    summary.entries[1].ordinal = "1.3";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/do not match the live problem list/);
  });

  it("rejects reordered ordinals", () => {
    const summary = validSummary();
    summary.sourceManifest.reverse();
    summary.entries.reverse();
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/do not match the live problem list/);
  });

  it("rejects an entry ordinal disagreeing with the manifest at the same index", () => {
    const summary = validSummary();
    summary.entries[1].ordinal = "1.1";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/does not match sourceManifest/);
  });

  it("rejects a missing problemDigest", () => {
    const summary = validSummary();
    summary.entries[1].problemDigest = "";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/missing problemDigest/);
  });

  it("rejects empty priorKnowledge on any entry after the first", () => {
    const summary = validSummary();
    summary.entries[1].priorKnowledge = "";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/priorKnowledge is empty/);
  });

  it("accepts empty priorKnowledge on the first entry", () => {
    const summary = validSummary();
    summary.entries[0].priorKnowledge = "";
    expect(validateUnitSummary(summary, liveProblems)).toEqual({ valid: true });
  });

  it("rejects a missing title or problemHash in the manifest", () => {
    const summary = validSummary();
    summary.sourceManifest[0].title = "";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/missing title/);
  });

  it("rejects a missing overview", () => {
    const summary = validSummary();
    summary.overview = "";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/overview is missing/);
  });

  it("rejects a missing generatedAt or sourceHash", () => {
    const summary = validSummary();
    summary.generatedAt = "";
    summary.sourceHash = "";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/generatedAt is missing/);
    expect((result as any).errors.join(" ")).toMatch(/sourceHash is missing/);
  });

  it("rejects a generatedAt that is not a valid timestamp", () => {
    const summary = validSummary();
    summary.generatedAt = "not-a-timestamp";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/not a valid ISO timestamp/);
  });

  it("rejects a generatedAt in a non-ISO date format", () => {
    const summary = validSummary();
    summary.generatedAt = "September 21, 2026";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/not a valid ISO timestamp/);
  });

  it("rejects a generatedAt with an invalid calendar date", () => {
    const summary = validSummary();
    // Date rolls this over to March 2 rather than rejecting it outright.
    summary.generatedAt = "2026-02-30T00:00:00.000Z";
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/not a valid ISO timestamp/);
  });

  it("rejects a problemDigest over its length limit", () => {
    const summary = validSummary();
    summary.entries[0].problemDigest = "x".repeat(UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS + 1);
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/problemDigest exceeds/);
  });

  it("rejects a priorKnowledge over its length limit", () => {
    const summary = validSummary();
    summary.entries[1].priorKnowledge = "x".repeat(UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS + 1);
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/priorKnowledge exceeds/);
  });

  it("rejects an overview over its length limit", () => {
    const summary = validSummary();
    summary.overview = "x".repeat(UNIT_SUMMARY_OVERVIEW_MAX_CHARS + 1);
    const result = validateUnitSummary(summary, liveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/overview exceeds/);
  });

  it("rejects a summary over its total character budget even with every field individually in range", () => {
    // Pushing one field over its own limit would trip that field's own error instead, so this
    // repeats enough in-range entries to exceed the total budget while every field stays within
    // its own per-field limit.
    const manyEntries = [];
    const manyManifest = [];
    const manyLiveProblems = [];
    const perEntryChars = UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS + UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS;
    const entryCount = Math.ceil(UNIT_SUMMARY_TOTAL_BUDGET_CHARS / perEntryChars) + 1;
    for (let i = 0; i < entryCount; i++) {
      const ordinal = `1.${i + 1}`;
      manyLiveProblems.push(ordinal);
      manyManifest.push({ ordinal, title: `Problem ${i + 1}`, problemHash: `hash${i}` });
      manyEntries.push({
        ordinal,
        priorKnowledge: i === 0 ? "" : "x".repeat(UNIT_SUMMARY_PRIOR_KNOWLEDGE_MAX_CHARS),
        problemDigest: "x".repeat(UNIT_SUMMARY_PROBLEM_DIGEST_MAX_CHARS)
      });
    }
    const bigSummary: IUnitSummary = {
      generatedAt: "2026-09-21T12:00:00.000Z",
      sourceHash: "abc123",
      overview: "short overview",
      sourceManifest: manyManifest,
      entries: manyEntries
    };
    const result = validateUnitSummary(bigSummary, manyLiveProblems);
    expect(result.valid).toBe(false);
    expect((result as any).errors.join(" ")).toMatch(/exceeds the .* character budget/);
  });
});
