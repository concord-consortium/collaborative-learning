import { getSnapshot } from "mobx-state-tree";
import { ProblemModel } from "./problem";
import { SectionType, SectionModelType } from "./section";
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
          type: SectionType.introduction
        },
        {
          type: SectionType.initialChallenge
        }
      ]
    });
    const firstSection = problem.getSectionByIndex(0) as SectionModelType;
    expect(firstSection.type).toBe(SectionType.introduction);
    const lastSection = problem.getSectionByIndex(1) as SectionModelType;
    expect(lastSection.type).toBe(SectionType.initialChallenge);

    // < 0 returns first section
    const underflowSection = problem.getSectionByIndex(-1) as SectionModelType;
    expect(underflowSection.type).toBe(SectionType.introduction);
    // > length return last section
    const overflowSection = problem.getSectionByIndex(10) as SectionModelType;
    expect(overflowSection.type).toBe(SectionType.initialChallenge);
  });

  it("can get sections by id", () => {
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
    const firstSection = problem.getSectionById(SectionType.introduction) as SectionModelType;
    expect(firstSection.type).toBe(SectionType.introduction);
    const lastSection = problem.getSectionById(SectionType.initialChallenge) as SectionModelType;
    expect(lastSection.type).toBe(SectionType.initialChallenge);

  });
});
