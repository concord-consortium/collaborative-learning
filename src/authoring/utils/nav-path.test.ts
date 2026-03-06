import { IInvestigation, IUnit } from "../types";
import {
  getUnitItem,
  getCurriculumItem,
  getProblemOrdinal,
  getSectionTypeFromPath,
  inferProblemBasePath,
  findPathPatternFromUnit,
  generateSectionPath,
  getProblemBasePath,
  getUnitChildrenTree,
} from "./nav-path";

const makeProblem = (ordinal: number, title: string, sections: string[] = []) => ({
  description: "",
  ordinal,
  title,
  subtitle: "",
  sections,
});

const makeInvestigation = (
  ordinal: number,
  title: string,
  problems: ReturnType<typeof makeProblem>[] = []
): IInvestigation => ({
  description: "",
  ordinal,
  title,
  problems,
});

const makeUnit = (investigations: IInvestigation[]): IUnit => ({
  code: "test",
  abbrevTitle: "T",
  title: "Test Unit",
  subtitle: "",
  config: {} as any,
  sections: {
    introduction: { initials: "IN", title: "Introduction", placeholder: "" },
    initialChallenge: { initials: "IC", title: "Initial Challenge", placeholder: "" },
  },
  planningDocument: {} as any,
  investigations,
});

const unit = makeUnit([
  makeInvestigation(1, "Investigation 1", [
    makeProblem(1, "Problem 1.1", [
      "investigation-1/problem-1/introduction/content.json",
      "investigation-1/problem-1/initialChallenge/content.json",
    ]),
    makeProblem(2, "Problem 1.2", []),
  ]),
  makeInvestigation(2, "Investigation 2", [
    makeProblem(1, "Problem 2.1", [
      "investigation-2/problem-1/introduction/content.json",
    ]),
  ]),
]);

describe("getUnitItem", () => {
  it("returns undefined for undefined unit", () => {
    expect(getUnitItem(undefined, ["investigations"])).toBeUndefined();
  });

  it("returns undefined for empty path parts", () => {
    expect(getUnitItem(unit, [])).toBeUndefined();
  });

  it("returns the unit for a single-part path", () => {
    expect(getUnitItem(unit, ["investigations"])).toBe(unit);
  });

  it("returns an investigation by index", () => {
    expect(getUnitItem(unit, ["investigations", "investigation-0"])).toBe(unit.investigations[0]);
    expect(getUnitItem(unit, ["investigations", "investigation-1"])).toBe(unit.investigations[1]);
  });

  it("returns undefined for out-of-bounds investigation index", () => {
    expect(getUnitItem(unit, ["investigations", "investigation-5"])).toBeUndefined();
    expect(getUnitItem(unit, ["investigations", "investigation--1"])).toBeUndefined();
  });

  it("returns undefined for invalid investigation format", () => {
    expect(getUnitItem(unit, ["investigations", "inv-0"])).toBeUndefined();
    expect(getUnitItem(unit, ["investigations", "investigation-abc"])).toBeUndefined();
  });

  it("returns a problem by index", () => {
    expect(getUnitItem(unit, ["investigations", "investigation-0", "problem-0"]))
      .toBe(unit.investigations[0].problems[0]);
    expect(getUnitItem(unit, ["investigations", "investigation-0", "problem-1"]))
      .toBe(unit.investigations[0].problems[1]);
  });

  it("returns undefined for out-of-bounds problem index", () => {
    expect(getUnitItem(unit, ["investigations", "investigation-0", "problem-5"])).toBeUndefined();
  });

  it("returns undefined for invalid problem format", () => {
    expect(getUnitItem(unit, ["investigations", "investigation-0", "prob-0"])).toBeUndefined();
  });

  it("returns undefined for paths deeper than problem level", () => {
    expect(getUnitItem(unit, ["investigations", "investigation-0", "problem-0", "extra"])).toBeUndefined();
  });
});

describe("getCurriculumItem", () => {
  const teacherGuide = makeUnit([
    makeInvestigation(1, "TG Investigation 1", [
      makeProblem(1, "TG Problem 1.1"),
    ]),
  ]);

  it("returns undefined for empty path", () => {
    expect(getCurriculumItem(unit, teacherGuide, "")).toBeUndefined();
  });

  it("looks up items from unitConfig for investigations/ paths", () => {
    expect(getCurriculumItem(unit, teacherGuide, "investigations")).toBe(unit);
    expect(getCurriculumItem(unit, teacherGuide, "investigations/investigation-0"))
      .toBe(unit.investigations[0]);
  });

  it("looks up items from teacherGuideConfig for teacher-guides/ paths", () => {
    expect(getCurriculumItem(unit, teacherGuide, "teacher-guides"))
      .toBe(teacherGuide);
    expect(getCurriculumItem(unit, teacherGuide, "teacher-guides/investigation-0/problem-0"))
      .toBe(teacherGuide.investigations[0].problems[0]);
  });

  it("returns undefined for unknown root path", () => {
    expect(getCurriculumItem(unit, teacherGuide, "other/path")).toBeUndefined();
  });

  it("returns undefined when unitConfig is undefined", () => {
    expect(getCurriculumItem(undefined, teacherGuide, "investigations")).toBeUndefined();
  });

  it("returns undefined when teacherGuideConfig is undefined", () => {
    expect(getCurriculumItem(unit, undefined, "teacher-guides")).toBeUndefined();
  });
});

describe("getProblemOrdinal", () => {
  it("returns ordinal string for a valid problem path", () => {
    expect(getProblemOrdinal(unit, "investigations/investigation-0/problem-0")).toBe("1.1");
    expect(getProblemOrdinal(unit, "investigations/investigation-0/problem-1")).toBe("1.2");
    expect(getProblemOrdinal(unit, "investigations/investigation-1/problem-0")).toBe("2.1");
  });

  it("returns undefined for unit-level path", () => {
    expect(getProblemOrdinal(unit, "investigations")).toBeUndefined();
  });

  it("returns undefined for investigation-level path", () => {
    expect(getProblemOrdinal(unit, "investigations/investigation-0")).toBeUndefined();
  });

  it("returns undefined for teacher-guide paths", () => {
    expect(getProblemOrdinal(unit, "teacher-guides/investigation-0/problem-0")).toBeUndefined();
  });

  it("returns undefined for undefined unitConfig", () => {
    expect(getProblemOrdinal(undefined, "investigations/investigation-0/problem-0")).toBeUndefined();
  });

  it("returns undefined for undefined path", () => {
    expect(getProblemOrdinal(unit, undefined)).toBeUndefined();
  });

  it("returns undefined for out-of-bounds indices", () => {
    expect(getProblemOrdinal(unit, "investigations/investigation-99/problem-0")).toBeUndefined();
    expect(getProblemOrdinal(unit, "investigations/investigation-0/problem-99")).toBeUndefined();
  });

  it("handles paths with extra segments (config paths)", () => {
    // Path like "investigations/investigation-0/problem-0/section-0" still extracts problem ordinal
    expect(getProblemOrdinal(unit, "investigations/investigation-0/problem-0/section-0")).toBe("1.1");
  });
});

describe("getSectionTypeFromPath", () => {
  it("extracts section type from a full path", () => {
    expect(getSectionTypeFromPath("investigation-1/problem-1/whatIf/content.json")).toBe("whatIf");
  });

  it("extracts section type from a short path", () => {
    expect(getSectionTypeFromPath("whatIf/content.json")).toBe("whatIf");
  });

  it("extracts section type from a deeply nested path", () => {
    expect(getSectionTypeFromPath("a/b/c/introduction/content.json")).toBe("introduction");
  });

  it("returns undefined for paths not ending in content.json", () => {
    expect(getSectionTypeFromPath("whatIf/other.json")).toBeUndefined();
  });

  it("returns undefined for bare content.json", () => {
    expect(getSectionTypeFromPath("content.json")).toBeUndefined();
  });
});

describe("inferProblemBasePath", () => {
  it("returns undefined for empty array", () => {
    expect(inferProblemBasePath([])).toBeUndefined();
  });

  it("infers base path from the first section path", () => {
    expect(inferProblemBasePath([
      "investigation-1/problem-1/intro/content.json",
      "investigation-1/problem-1/whatIf/content.json",
    ])).toBe("investigation-1/problem-1");
  });

  it("returns undefined when section path has no base path prefix", () => {
    // "overview/content.json" has no base path — "overview" is the section type
    expect(inferProblemBasePath(["overview/content.json"])).toBeUndefined();
  });

  it("returns undefined for paths that don't match the pattern", () => {
    expect(inferProblemBasePath(["content.json"])).toBeUndefined();
  });
});

describe("findPathPatternFromUnit", () => {
  it("returns undefined for undefined config", () => {
    expect(findPathPatternFromUnit(undefined, 0)).toBeUndefined();
  });

  it("returns undefined when no problems have sections", () => {
    const emptyUnit = makeUnit([
      makeInvestigation(1, "Inv 1", [makeProblem(1, "P1")]),
    ]);
    expect(findPathPatternFromUnit(emptyUnit, 0)).toBeUndefined();
  });

  it("finds pattern from current investigation first", () => {
    const result = findPathPatternFromUnit(unit, 0);
    expect(result).toEqual({
      prefix: "",
      invPattern: "investigation-",
      probPattern: "/problem-",
    });
  });

  it("falls back to other investigations if current has no sections", () => {
    const unitWithGap = makeUnit([
      makeInvestigation(1, "Inv 1", [makeProblem(1, "P1")]), // no sections
      makeInvestigation(2, "Inv 2", [
        makeProblem(1, "P2.1", ["investigation-2/problem-1/intro/content.json"]),
      ]),
    ]);
    const result = findPathPatternFromUnit(unitWithGap, 0);
    expect(result).toEqual({
      prefix: "",
      invPattern: "investigation-",
      probPattern: "/problem-",
    });
  });

  it("handles paths with a prefix", () => {
    const prefixedUnit = makeUnit([
      makeInvestigation(1, "Inv 1", [
        makeProblem(1, "P1", ["curriculum/investigation-1/problem-1/intro/content.json"]),
      ]),
    ]);
    const result = findPathPatternFromUnit(prefixedUnit, 0);
    expect(result).toEqual({
      prefix: "curriculum/",
      invPattern: "investigation-",
      probPattern: "/problem-",
    });
  });

  it("skips invalid section paths and finds the next valid pattern", () => {
    const unitWithInvalidFirst = makeUnit([
      makeInvestigation(1, "Inv 1", [
        makeProblem(1, "P1", ["weird/path/intro/content.json"]),
        makeProblem(2, "P2", ["curriculum/investigation-1/problem-2/intro/content.json"]),
      ]),
    ]);
    const result = findPathPatternFromUnit(unitWithInvalidFirst, 0);
    expect(result).toEqual({
      prefix: "curriculum/",
      invPattern: "investigation-",
      probPattern: "/problem-",
    });
  });
});

describe("generateSectionPath", () => {
  it("generates a section path from base path and type", () => {
    expect(generateSectionPath("investigation-1/problem-1", "whatIf"))
      .toBe("investigation-1/problem-1/whatIf/content.json");
  });
});

describe("getProblemBasePath", () => {
  const investigation = unit.investigations[0];

  it("uses inferred path from existing sections (priority 1)", () => {
    const existing = ["investigation-1/problem-1/intro/content.json"];
    expect(getProblemBasePath(existing, unit, investigation, 0, 1))
      .toBe("investigation-1/problem-1");
  });

  it("uses pattern from unit when no existing sections (priority 2)", () => {
    expect(getProblemBasePath([], unit, investigation, 0, 3))
      .toBe("investigation-1/problem-3");
  });

  it("falls back to ordinal-based default (priority 3)", () => {
    const emptyUnit = makeUnit([
      makeInvestigation(1, "Inv 1", [makeProblem(1, "P1")]),
    ]);
    expect(getProblemBasePath([], emptyUnit, emptyUnit.investigations[0], 0, 2))
      .toBe("investigation-1/problem-2");
  });

  it("falls back to ordinal-based default with undefined unitConfig", () => {
    expect(getProblemBasePath([], undefined, investigation, 0, 1))
      .toBe("investigation-1/problem-1");
  });

  it("uses ordinals (not indices) when applying an inferred pattern", () => {
    const ordinalsUnit = makeUnit([
      makeInvestigation(10, "Inv 10", [
        makeProblem(1, "P10.1", ["curriculum/investigation-10/problem-1/intro/content.json"]),
        makeProblem(2, "P10.2"),
      ]),
    ]);
    const inv10 = ordinalsUnit.investigations[0];
    expect(getProblemBasePath([], ordinalsUnit, inv10, 0, 2))
      .toBe("curriculum/investigation-10/problem-2");
  });
});

describe("getUnitChildrenTree", () => {
  const files = {
    "investigation-1/problem-1/introduction/content.json": { sha: "a", type: "introduction" },
    "investigation-1/problem-1/initialChallenge/content.json": { sha: "b", type: "initialChallenge" },
    "investigation-2/problem-1/introduction/content.json": { sha: "c", type: "introduction" },
  };

  it("returns just config node for undefined unit", () => {
    const tree = getUnitChildrenTree(undefined, undefined);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("containerConfig");
  });

  it("builds a full tree with config nodes at each level", () => {
    const tree = getUnitChildrenTree(unit, files);
    expect(tree[0].id).toBe("containerConfig");

    const inv0 = tree.find(node => (node as any).id === "investigation-0") as any;
    expect(inv0?.label).toBe("Investigation 1");
    expect(inv0.children?.[0]?.id).toBe("containerConfig");

    const prob0 = inv0.children.find((child: any) => child.id === "problem-0");
    expect(prob0?.label).toBe("Problem 1.1");
    expect(prob0.children?.[0]?.id).toBe("containerConfig");

    const sectionLabels = (prob0.children || []).map((child: any) => child.label);
    expect(sectionLabels).toContain("Introduction");
    expect(sectionLabels).toContain("Initial Challenge");

    const introNode = (prob0.children || []).find((child: any) => child.label === "Introduction");
    expect(introNode?.path).toBe("investigation-1/problem-1/introduction/content.json");
  });

  it("labels unknown sections with path fallback", () => {
    const tree = getUnitChildrenTree(unit, {}); // no files -> no type lookup
    const inv0 = tree[1] as any;
    const prob0 = inv0.children[1];
    // sections exist in problem but files map is empty, so type is undefined
    expect(prob0.children[1].label).toContain("Unknown Section");
    expect(prob0.children[1].label).toContain("investigation-1/problem-1/introduction/content.json");
  });

  it("applies sectionPathPrefix when looking up files", () => {
    const tgFiles = {
      "teacher-guide/overview/content.json": { sha: "d", type: "overview" },
    };
    const tgUnit = makeUnit([
      makeInvestigation(1, "TG Inv", [
        makeProblem(1, "TG Prob", ["overview/content.json"]),
      ]),
    ]);
    tgUnit.sections = { overview: { initials: "OV", title: "Overview", placeholder: "" } };

    const tree = getUnitChildrenTree(tgUnit, tgFiles, "teacher-guide/");
    const inv0 = tree[1] as any;
    const prob0 = inv0.children[1];
    expect(prob0.children[1].label).toBe("Overview");
    expect(prob0.children[1].path).toBe("teacher-guide/overview/content.json");
  });
});
