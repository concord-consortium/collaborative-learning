import { getSnapshot } from "mobx-state-tree";
import { ProblemModel } from "./problem";
import { SectionType } from "./section";
import { omitUndefined } from "../utilities/test-utils";

describe("problem model", () => {

  it("has default values", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test"
    });
    expect(getSnapshot(problem)).toEqual({
      ordinal: 1,
      title: "test",
      subtitle: "",
      sections: []
    });
    expect(problem.fullTitle).toBe("test");
  });

  it("uses override values", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test",
      subtitle: "sub",
      sections: [
        {
          type: SectionType.introduction
        },
        {
          type: SectionType.initialChallenge
        }
      ]
    });
    // omit undefined properties for comparison purposes
    expect(omitUndefined(getSnapshot(problem))).toEqual({
      ordinal: 1,
      title: "test",
      subtitle: "sub",
      sections: [
        {
          type: SectionType.introduction,
          supports: []
        },
        {
          type: SectionType.initialChallenge,
          supports: []
        }
      ]
    });
    expect(problem.fullTitle).toBe("test: sub");
  });

});
