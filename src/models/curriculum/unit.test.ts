import { UnitModel } from "./unit";

describe("UnitModel", () => {

  const problemOrdinal = 1;
  const problemTitle = "Problem 1";
  const inProblem1 = { ordinal: problemOrdinal, title: problemTitle };
  const investigation1Title = "Investigation 1";
  const investigation2Title = "Investigation 2";
  const inInvestigation1 = { ordinal: 1, title: "Investigation 1", problems: [ inProblem1 ] };
  const inInvestigation2 = { ordinal: 2, title: "Investigation 2", problems: [ inProblem1 ] };
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
    expect(unit.getProblem("")).toBeUndefined();
    expect(unit.getProblem("0")).toBeUndefined();
    const problem1 = unit.getProblem("1");
    expect(problem1 && problem1.title).toBe(problemTitle);
    const problem11 = unit.getProblem("1.1");
    expect(problem11 && problem11.title).toBe(problemTitle);
    const problem21 = unit.getProblem("2.1");
    expect(problem21 && problem21.title).toBe(problemTitle);
  });
});
