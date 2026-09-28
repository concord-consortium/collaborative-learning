import { UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION, IUnitSummary } from "./unit-summary-types";
import { formatUnitSummarySlice, ILiveProblem, IUnitSummarySlice, unitSummarySlice } from "./unit-summary-slice";

const liveProblems: ILiveProblem[] = [
  { ordinal: "1.1", title: "Problem 1.1" },
  { ordinal: "1.2", title: "Problem 1.2" },
  { ordinal: "1.3", title: "Problem 1.3" },
  { ordinal: "2.1", title: "Problem 2.1" },
];

function summaryFor(problems: ILiveProblem[]): IUnitSummary {
  return {
    generatedAt: "2026-09-21T12:00:00.000Z",
    sourceHash: "abc123",
    overview: "unit overview",
    sourceManifest: problems.map(p => ({ ordinal: p.ordinal, title: p.title, problemHash: p.problemHash ?? "h" })),
    entries: problems.map(p => ({
      ordinal: p.ordinal,
      priorKnowledge: p.ordinal === problems[0].ordinal ? "" : `prior knowledge for ${p.ordinal}`,
      problemDigest: `digest for ${p.ordinal}`,
    })),
  };
}

describe("unitSummarySlice", () => {
  it("returns undefined when there is no summary", () => {
    expect(unitSummarySlice(undefined, liveProblems, "1.1")).toBeUndefined();
  });

  it("returns a slice for the first problem, with empty priorKnowledge allowed", () => {
    const summary = summaryFor(liveProblems);
    const slice = unitSummarySlice(summary, liveProblems, "1.1");
    expect(slice).toEqual({
      currentOrdinal: "1.1",
      priorKnowledge: "",
      currentDigest: "digest for 1.1",
      nextOrdinal: "1.2",
      nextDigest: "digest for 1.2",
    });
  });

  it("returns a slice for the last problem, with no nextOrdinal/nextDigest", () => {
    const summary = summaryFor(liveProblems);
    const slice = unitSummarySlice(summary, liveProblems, "2.1");
    expect(slice).toEqual({
      currentOrdinal: "2.1",
      priorKnowledge: "prior knowledge for 2.1",
      currentDigest: "digest for 2.1",
      nextOrdinal: undefined,
      nextDigest: undefined,
    });
  });

  it("returns a slice across an investigation boundary (1.3 -> 2.1)", () => {
    const summary = summaryFor(liveProblems);
    const slice = unitSummarySlice(summary, liveProblems, "1.3");
    expect(slice?.currentOrdinal).toBe("1.3");
    expect(slice?.nextOrdinal).toBe("2.1");
    expect(slice?.nextDigest).toBe("digest for 2.1");
  });

  it("handles investigation ordinal 0", () => {
    const problems: ILiveProblem[] = [
      { ordinal: "0.1", title: "Getting started" },
      { ordinal: "1.1", title: "Problem 1.1" },
    ];
    const summary = summaryFor(problems);
    const slice = unitSummarySlice(summary, problems, "0.1");
    expect(slice?.currentOrdinal).toBe("0.1");
    expect(slice?.nextOrdinal).toBe("1.1");
  });

  it("follows authored (array) order for multi-digit ordinals, not string sort", () => {
    // Authored order here is "1.9", "1.10", "1.2". A lexicographic string sort compares character
    // by character and would put "1.9" last ("1.10" < "1.2" < "1.9"), so the first assertion below
    // would see no next problem after "1.9" instead of "1.10" if the helper sorted that way. A
    // helper that instead sorted numerically by the part after the dot would put "1.10" last
    // (2, 9, 10), so the second assertion would see no next problem after "1.10" instead of "1.2"
    // if the helper sorted that way. Together the two assertions only pass if the helper trusts the
    // given array order rather than re-deriving one, by either method.
    const problems: ILiveProblem[] = [
      { ordinal: "1.9", title: "Problem 1.9" },
      { ordinal: "1.10", title: "Problem 1.10" },
      { ordinal: "1.2", title: "Problem 1.2" },
    ];
    const summary = summaryFor(problems);
    expect(unitSummarySlice(summary, problems, "1.9")?.nextOrdinal).toBe("1.10");
    expect(unitSummarySlice(summary, problems, "1.10")?.nextOrdinal).toBe("1.2");
  });

  it("returns undefined when the current ordinal is not in liveProblems", () => {
    const summary = summaryFor(liveProblems);
    expect(unitSummarySlice(summary, liveProblems, "9.9")).toBeUndefined();
  });

  it("returns undefined on a title mismatch before N", () => {
    const summary = summaryFor(liveProblems);
    summary.sourceManifest[0].title = "A different title";
    expect(unitSummarySlice(summary, liveProblems, "1.3")).toBeUndefined();
  });

  it("returns a slice when a title mismatch is after N+1", () => {
    const summary = summaryFor(liveProblems);
    // Current problem is 1.2; N+1 is 1.3. A mismatch at 2.1 (index 3) is outside the checked
    // prefix (indexes 0..2) and must not block the slice.
    summary.sourceManifest[3].title = "A different title";
    const slice = unitSummarySlice(summary, liveProblems, "1.2");
    expect(slice?.currentOrdinal).toBe("1.2");
    expect(slice?.nextOrdinal).toBe("1.3");
  });

  it("returns undefined when entries and sourceManifest have different lengths", () => {
    const summary = summaryFor(liveProblems);
    summary.entries.pop();
    expect(unitSummarySlice(summary, liveProblems, "1.1")).toBeUndefined();
  });

  it("returns undefined when entries[i].ordinal disagrees with sourceManifest[i].ordinal", () => {
    const summary = summaryFor(liveProblems);
    summary.entries[1].ordinal = "9.9";
    expect(unitSummarySlice(summary, liveProblems, "1.2")).toBeUndefined();
  });

  it("returns undefined on a problemHash mismatch when a hash is supplied", () => {
    const problemsWithHash: ILiveProblem[] = liveProblems.map(p => ({ ...p, problemHash: "live-hash" }));
    const summary = summaryFor(problemsWithHash);
    summary.sourceManifest[0].problemHash = "stale-hash";
    expect(unitSummarySlice(summary, problemsWithHash, "1.2")).toBeUndefined();
  });

  it("does not treat an absent problemHash on the live problem as a mismatch", () => {
    // liveProblems above carries no problemHash; the manifest's own hash differs from nothing.
    const summary = summaryFor(liveProblems);
    summary.sourceManifest[0].problemHash = "whatever-was-generated";
    const slice = unitSummarySlice(summary, liveProblems, "1.2");
    expect(slice).toBeDefined();
  });
});

describe("formatUnitSummarySlice", () => {
  const middleSlice: IUnitSummarySlice = {
    currentOrdinal: "1.2",
    priorKnowledge: "knows the basics",
    currentDigest: "covers the middle topic",
    nextOrdinal: "1.3",
    nextDigest: "covers the next topic",
  };

  it("formats a middle problem with all three parts", () => {
    const text = formatUnitSummarySlice(middleSlice);
    expect(text).toBe(
      "What the student should already know entering this problem: knows the basics\n\n" +
      "This problem (1.2): covers the middle topic\n\n" +
      "The next problem (1.3): covers the next topic"
    );
  });

  it("omits the next-problem line for the last problem", () => {
    const lastSlice: IUnitSummarySlice = {
      currentOrdinal: "2.1",
      priorKnowledge: "knows everything so far",
      currentDigest: "covers the last topic",
    };
    const text = formatUnitSummarySlice(lastSlice);
    expect(text).toBe(
      "What the student should already know entering this problem: knows everything so far\n\n" +
      "This problem (2.1): covers the last topic"
    );
    expect(text).not.toMatch(/next problem/i);
  });

  it("omits the priorKnowledge line entirely when it is empty, with no placeholder text", () => {
    const firstSlice: IUnitSummarySlice = {
      currentOrdinal: "1.1",
      priorKnowledge: "",
      currentDigest: "covers the first topic",
      nextOrdinal: "1.2",
      nextDigest: "covers the second topic",
    };
    const text = formatUnitSummarySlice(firstSlice);
    expect(text).toBe(
      "This problem (1.1): covers the first topic\n\n" +
      "The next problem (1.2): covers the second topic"
    );
    expect(text).not.toMatch(/already know/i);
    expect(text).not.toMatch(/nothing recorded/i);
  });

  it("never includes the lookahead instruction text", () => {
    const text = formatUnitSummarySlice(middleSlice);
    expect(text).not.toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
  });
});
