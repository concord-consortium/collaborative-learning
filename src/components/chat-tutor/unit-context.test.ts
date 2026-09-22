import { UnitModel } from "../../models/curriculum/unit";
import { IUnitSummary } from "../../../shared/unit-summary-types";
import { buildUnitContext, currentProblemOrdinal } from "./unit-context";

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

function summary(entries: IUnitSummary["entries"]): IUnitSummary {
  return { generatedAt: "2026-01-01T00:00:00.000Z", sourceHash: "h", sourceManifest: [], overview: "o", entries };
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

  it("includes priorKnowledge for the current problem and digests for current + next", () => {
    const unit = makeUnit(summary([
      { ordinal: "1.1", priorKnowledge: "", problemDigest: "digest one" },
      { ordinal: "1.2", priorKnowledge: "knows dataflow basics", problemDigest: "digest two" },
      { ordinal: "2.1", priorKnowledge: "knows dataflow and EMG", problemDigest: "digest three" },
    ]));
    const problem = unit.investigations[0].problems[1]; // 1.2
    const result = buildUnitContext(unit, problem);
    expect(result).toContain("knows dataflow basics");
    expect(result).toContain("This problem (1.2): digest two");
    expect(result).toContain("The next problem (2.1): digest three");
    // Only current + next digest, never a digest from before the current problem -- priorKnowledge
    // already covers that ground, and repeating it would be redundant (see unit-context.ts).
    expect(result).not.toContain("digest one");
  });

  it("omits the next-problem line for the unit's last problem", () => {
    const unit = makeUnit(summary([
      { ordinal: "1.1", priorKnowledge: "", problemDigest: "digest one" },
      { ordinal: "1.2", priorKnowledge: "pk", problemDigest: "digest two" },
      { ordinal: "2.1", priorKnowledge: "pk2", problemDigest: "digest three" },
    ]));
    const problem = unit.investigations[1].problems[0]; // 2.1, the last problem
    const result = buildUnitContext(unit, problem);
    expect(result).toContain("This problem (2.1): digest three");
    expect(result).not.toContain("The next problem");
  });

  it("shows a fallback for an empty priorKnowledge (the unit's first problem)", () => {
    const unit = makeUnit(summary([
      { ordinal: "1.1", priorKnowledge: "", problemDigest: "digest one" },
    ]));
    const problem = unit.investigations[0].problems[0];
    const result = buildUnitContext(unit, problem);
    expect(result).toContain("(nothing recorded)");
  });

  it("returns undefined when the summary has no entry for the current problem", () => {
    const unit = makeUnit(summary([
      { ordinal: "1.1", priorKnowledge: "pk", problemDigest: "digest one" },
    ]));
    const problem = unit.investigations[0].problems[1]; // 1.2 -- not in the summary above
    expect(buildUnitContext(unit, problem)).toBeUndefined();
  });
});
