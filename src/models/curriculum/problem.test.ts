import { getSnapshot, getRoot, hasParent, getEnv } from "mobx-state-tree";
import { ProblemModel } from "./problem";
import { SectionModelType } from "./section";
import { omitUndefined } from "../../utilities/test-utils";
import { SharedModel } from "../shared/shared-model";
import { registerSharedModelInfo } from "../shared/shared-model-registry";

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
      sectionsFromSnapshot: []
    });
    expect(problem.fullTitle).toBe("test");
  });

  it("uses override values and renames sections to sectionsFromSnapshot", () => {
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
      sectionsFromSnapshot: [
        {
          type: "introduction",
        },
        {
          type: "initialChallenge",
        }
      ],
      config: {}
    });
    expect(problem.fullTitle).toBe("test: sub");
  });

  test("each section is its own MST tree", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test",
      sections: [
        {
          type: "introduction"
        },
        {
          type: "initialChallenge"
        }
      ]
    });
    problem.sections.forEach(section => {
      expect(hasParent(section)).toBeFalsy();
      expect(getRoot(section)).toBe(section);
      expect(section.realParent).toBe(problem);
    });
  });

  test("sections with content have a unique sharedModelManager in their environment", async () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test",
      sections: [
        {
          type: "introduction"
        },
        {
          type: "initialChallenge"
        }
      ]
    });

    await problem.loadSections("");
    const sharedModelManagers = problem.sections.map(section =>
      getEnv(section)?.sharedModelManager
    );
    const uniqueManagers = [...new Set(sharedModelManagers)];
    expect(uniqueManagers).toHaveLength(2);
  });

  test("sections can use the same ids as other sections", async () => {
    // Make a test shared model to demonstrate duplicate id problems
    const TestSharedModel = SharedModel
      .named("TestSharedModel")
      .props({
        type: "TestSharedModel",
      });

    registerSharedModelInfo({
      type: "TestSharedModel",
      modelClass: TestSharedModel,
      hasName: false
    });

    const duplicatedSection = {
      type: "introduction",
      content: {
        tiles: [
          {
            id: "duplicate-tile-id",
            content: {
              type: "Text",
              format: "html",
              text: [ "Hello" ]
            }
          }
        ],
        sharedModels: [
          {
            sharedModel: {
              type: "TestSharedModel",
              id: "shared-model-id"
            },
            tiles: [ "duplicate-tile-id" ]
          }
        ]
      } as any
    };

    const problem = ProblemModel.create({
      ordinal: 1,
      title: "test",
      sections: [
        duplicatedSection,
        duplicatedSection
      ]
    });
    await problem.loadSections("");
    expect(problem.sections.length).toBe(2);
    const firstTileContent = problem.sections[0].content?.getTile("duplicate-tile-id")?.content as any;
    expect(firstTileContent).toBeDefined();
    const secondTileContent = problem.sections[1].content?.getTile("duplicate-tile-id")?.content as any;
    expect(firstTileContent).not.toBe(secondTileContent);
  });

  it("can get sections by index", async () => {
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
    await problem.loadSections("");
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

  it("can get sections by id", async () => {
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
    await problem.loadSections("");
    const firstSection = problem.getSectionById("introduction") as SectionModelType;
    expect(firstSection.type).toBe("introduction");
    const lastSection = problem.getSectionById("initialChallenge") as SectionModelType;
    expect(lastSection.type).toBe("initialChallenge");

  });

  it("can import legacy snapshots", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "Test",
      disabled: ["foo"],
      settings: { foo: "bar" }
    });
    expect(problem).toEqual({
      ordinal: 1,
      title: "Test",
      subtitle: "",
      sections: [],
      sectionsFromSnapshot: [],
      config: {
        disabledFeatures: ["foo"],
        settings: { foo: "bar" }
      }
    });
  });

  it("can import mixed legacy/modern snapshots", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "Test",
      disabled: ["foo"],
      config: {
        settings: { foo: "bar" }
      }
    });
    expect(problem).toEqual({
      ordinal: 1,
      title: "Test",
      subtitle: "",
      sections: [],
      sectionsFromSnapshot: [],
      config: {
        disabledFeatures: ["foo"],
        settings: { foo: "bar" }
      }
    });
  });

  it("prioritizes modern config when importing mixed legacy/modern snapshots", () => {
    const problem = ProblemModel.create({
      ordinal: 1,
      title: "Test",
      disabled: ["roo"],
      settings: { roo: "baz"},
      config: {
        disabledFeatures: ["foo"],
        settings: { foo: "bar" }
      }
    });
    expect(problem).toEqual({
      ordinal: 1,
      title: "Test",
      subtitle: "",
      sections: [],
      sectionsFromSnapshot: [],
      config: {
        disabledFeatures: ["foo"],
        settings: { foo: "bar" }
      }
    });
  });
});
