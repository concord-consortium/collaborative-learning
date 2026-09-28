import { UnitModel } from "../../models/curriculum/unit";
import { IUnitSummary } from "../../../shared/unit-summary-types";
import { buildUnitContext, currentProblemOrdinal } from "./unit-context";

// Everything case-by-case about filtering and formatting lives in
// shared/unit-summary-slice.test.ts; these are integration-level checks that this module wires
// the live unit model into that shared helper correctly.

function makeUnit(aiUnitSummary?: IUnitSummary) {
  return UnitModel.create({
    code: "u1",
    title: "Unit 1",
    config: aiUnitSummary ? { aiUnitSummary } : undefined,
    investigations: [
      { ordinal: 1, title: "Investigation 1", problems: [
        { ordinal: 1, title: "Problem 1.1" },
        { ordinal: 2, title: "Problem 1.2" },
      ] },
      { ordinal: 2, title: "Investigation 2", problems: [
        { ordinal: 1, title: "Problem 2.1" },
      ] },
    ],
  });
}

// sourceManifest mirrors the unit's live problems exactly (ordinal + title), so the prefix check
// in unitSummarySlice passes as-is; individual tests break it deliberately.
function matchingSummary(): IUnitSummary {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    sourceHash: "h",
    overview: "o",
    sourceManifest: [
      { ordinal: "1.1", title: "Problem 1.1", problemHash: "h1" },
      { ordinal: "1.2", title: "Problem 1.2", problemHash: "h2" },
      { ordinal: "2.1", title: "Problem 2.1", problemHash: "h3" },
    ],
    entries: [
      { ordinal: "1.1", priorKnowledge: "", problemDigest: "digest one" },
      { ordinal: "1.2", priorKnowledge: "knows dataflow basics", problemDigest: "digest two" },
      { ordinal: "2.1", priorKnowledge: "knows dataflow and EMG", problemDigest: "digest three" },
    ],
  };
}

describe("currentProblemOrdinal", () => {
  it("builds the same ordinal string Unit.getAllProblemOrdinals() produces", () => {
    const unit = makeUnit();
    const problem = unit.investigations[1].problems[0];
    expect(currentProblemOrdinal(problem)).toBe("2.1");
    expect(unit.getAllProblemOrdinals()).toContain(currentProblemOrdinal(problem));
  });
});

describe("buildUnitContext", () => {
  it("returns undefined when the unit has no aiUnitSummary authored", () => {
    const unit = makeUnit();
    const problem = unit.investigations[0].problems[0];
    expect(buildUnitContext(unit, problem)).toBeUndefined();
  });

  it("returns the formatted slice text for a unit with a matching summary", () => {
    const unit = makeUnit(matchingSummary());
    const problem = unit.investigations[0].problems[1]; // 1.2
    const result = buildUnitContext(unit, problem);
    expect(result).toBe(
      "What the student should already know entering this problem: knows dataflow basics\n\n" +
      "This problem (1.2): digest two\n\n" +
      "The next problem (2.1): digest three"
    );
  });

  it("returns undefined when a title before the current problem disagrees with the manifest", () => {
    const summary = matchingSummary();
    summary.sourceManifest[0].title = "A renamed problem";
    const unit = makeUnit(summary);
    const problem = unit.investigations[0].problems[1]; // 1.2 -- 1.1 is before it
    expect(buildUnitContext(unit, problem)).toBeUndefined();
  });

  it("fails closed when the walk disagrees with getAllProblemOrdinals", () => {
    // liveProblemsFromUnit's own walk uses the same ordinal formula as getAllProblemOrdinals(), so
    // they cannot disagree for any unit this module can actually build -- the guard exists for
    // defense against future drift between the two. Force that disagreement here to prove the
    // guard fires rather than silently building a slice against the wrong problem order.
    const unit = makeUnit(matchingSummary());
    const problem = unit.investigations[0].problems[1];
    jest.spyOn(unit, "getAllProblemOrdinals").mockReturnValue(["9.9"]);
    expect(buildUnitContext(unit, problem)).toBeUndefined();
  });
});
