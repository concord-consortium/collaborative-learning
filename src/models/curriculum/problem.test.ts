import { getSnapshot } from "mobx-state-tree";
import { ProblemModel } from "./problem";
import { SectionModelType } from "./section";
import { omitUndefined } from "../../utilities/test-utils";

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
      disabled: [],
      sections: [],
      supports: []
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
          type: "introduction"
        },
        {
          type: "initialChallenge"
        }
      ]
    });
    // omit undefined properties for comparison purposes
    expect(omitUndefined(getSnapshot(problem))).toEqual({
      ordinal: 1,
      title: "test",
      subtitle: "sub",
      disabled: [],
      sections: [
        {
          type: "introduction",
          disabled: [],
          supports: []
        },
        {
          type: "initialChallenge",
          disabled: [],
          supports: []
        }
      ],
      supports: []
    });
    expect(problem.fullTitle).toBe("test: sub");
  });

  it("can get sections by index", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test",
      subtitle: "sub",
      sections: [
        {
          type: "introduction"
        },
        {
          type: "initialChallenge"
        }
      ]
    });
    const firstSection = problem.getSectionByIndex(0) as SectionModelType;
    expect(firstSection.type).toBe("introduction");
    const lastSection = problem.getSectionByIndex(1) as SectionModelType;
    expect(lastSection.type).toBe("initialChallenge");

    // < 0 returns first section
    const underflowSection = problem.getSectionByIndex(-1) as SectionModelType;
    expect(underflowSection.type).toBe("introduction");
    // > length return last section
    const overflowSection = problem.getSectionByIndex(10) as SectionModelType;
    expect(overflowSection.type).toBe("initialChallenge");
  });

  it("can get sections by id", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test",
      subtitle: "sub",
      sections: [
        {
          type: "introduction"
        },
        {
          type: "initialChallenge"
        }
      ]
    });
    const firstSection = problem.getSectionById("introduction") as SectionModelType;
    expect(firstSection.type).toBe("introduction");
    const lastSection = problem.getSectionById("initialChallenge") as SectionModelType;
    expect(lastSection.type).toBe("initialChallenge");

  });
});
