import { InvestigationModel } from "./investigation";

describe("InvestigationModel", () => {

  it("getProblem() should return appropriate result", () => {
    const problemOrdinal = 1;
    const problemTitle = "Problem 1.1";
    const inProblem1 = { ordinal: problemOrdinal, title: problemTitle };
    const investigation = InvestigationModel.create({
                            ordinal: 1,
                            title: "Investigation 1",
                            problems: [ inProblem1 ]
                          });
    expect(investigation.getProblem(0)).toBeUndefined();
    const problem1 = investigation.getProblem(1);
    expect(problem1 && problem1.ordinal).toBe(problemOrdinal);
    expect(problem1 && problem1.title).toBe(problemTitle);
    expect(investigation.getProblem(2)).toBeUndefined();
  });
});
