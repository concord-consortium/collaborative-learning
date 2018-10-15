import { UnitModel } from "./unit";

describe("UnitModel", () => {

  const problemOrdinal = 1;
  const problemTitle = "Problem 1";
  const inProblem1 = { ordinal: problemOrdinal, title: problemTitle };
  const investigation1Title = "Investigation 1";
  const investigation2Title = "Investigation 2";
  const inInvestigation1 = { ordinal: 1, title: investigation1Title, problems: [ inProblem1 ] };
  const inInvestigation2 = { ordinal: 2, title: investigation2Title, problems: [ inProblem1 ] };
  const unit = UnitModel.create({
                title: "Unit 1",
                investigations: [ inInvestigation1, inInvestigation2 ]
              });

  it("getInvestigation() should work as expected", () => {
    expect(unit.getInvestigation(0)).toBeUndefined();
    const investigation1 = unit.getInvestigation(1);
    expect(investigation1 && investigation1.title).toBe(investigation1Title);
    const investigation2 = unit.getInvestigation(2);
    expect(investigation2 && investigation2.title).toBe(investigation2Title);
  });

  it("getProblem() should work as expected", () => {
    expect(unit.getProblem("")).toEqual({investigation: undefined, problem: undefined});
    expect(unit.getProblem("0")).toEqual({investigation: undefined, problem: undefined});
    const result1 = unit.getProblem("1");
    expect(result1.problem && result1.problem.title).toBe(problemTitle);
    expect(result1.investigation && result1.investigation.title).toBe(investigation1Title);
    const result11 = unit.getProblem("1.1");
    expect(result11.problem && result11.problem.title).toBe(problemTitle);
    expect(result11.investigation && result11.investigation.title).toBe(investigation1Title);
    const result21 = unit.getProblem("2.1");
    expect(result21.problem && result21.problem.title).toBe(problemTitle);
    expect(result21.investigation && result21.investigation.title).toBe(investigation2Title);
  });
});
