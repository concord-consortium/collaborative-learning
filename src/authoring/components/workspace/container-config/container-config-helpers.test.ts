import { IInvestigation, IProblem, IUnit } from "../../../types";
import { CurriculumItem } from "../../../utils/nav-path";
import {
  isUnit,
  isInvestigation,
  isProblem,
  buildProblemSectionsFormData,
  parseItemPath,
} from "./container-config-helpers";

const makeProblem = (ordinal: number, title: string, sections: string[] = []): IProblem => ({
  description: "",
  ordinal,
  title,
  subtitle: "",
  sections,
});

const makeInvestigation = (ordinal: number, title: string, problems: IProblem[] = []): IInvestigation => ({
  description: "",
  ordinal,
  title,
  problems,
});

const makeUnit = (investigations: IInvestigation[] = []): IUnit => ({
  code: "test",
  abbrevTitle: "T",
  title: "Test Unit",
  subtitle: "",
  config: {} as any,
  sections: {},
  planningDocument: {} as any,
  investigations,
});

describe("isUnit", () => {
  it("returns true for a unit", () => {
    expect(isUnit(makeUnit())).toBe(true);
  });

  it("returns false when investigations is not an array", () => {
    expect(isUnit({ investigations: "nope" } as unknown as CurriculumItem)).toBe(false);
  });

  it("returns false for an investigation", () => {
    expect(isUnit(makeInvestigation(1, "Inv") as CurriculumItem)).toBe(false);
  });

  it("returns false for a problem", () => {
    expect(isUnit(makeProblem(1, "Prob") as CurriculumItem)).toBe(false);
  });
});

describe("isInvestigation", () => {
  it("returns true for an investigation", () => {
    expect(isInvestigation(makeInvestigation(1, "Inv"))).toBe(true);
  });

  it("returns false when problems is not an array", () => {
    expect(isInvestigation({ problems: {} } as unknown as CurriculumItem)).toBe(false);
  });

  it("returns false for a unit", () => {
    expect(isInvestigation(makeUnit())).toBe(false);
  });

  it("returns false for a problem", () => {
    expect(isInvestigation(makeProblem(1, "Prob") as CurriculumItem)).toBe(false);
  });
});

describe("isProblem", () => {
  it("returns true for a problem", () => {
    expect(isProblem(makeProblem(1, "Prob"))).toBe(true);
  });

  it("returns false when sections is not an array", () => {
    expect(isProblem({ sections: "nope" } as unknown as CurriculumItem)).toBe(false);
  });

  it("returns false for a unit", () => {
    expect(isProblem(makeUnit())).toBe(false);
  });

  it("returns false for an investigation", () => {
    expect(isProblem(makeInvestigation(1, "Inv"))).toBe(false);
  });
});

describe("parseItemPath", () => {
  it("parses a regular investigation path", () => {
    expect(parseItemPath("investigations/investigation-0/problem-1")).toEqual({
      investigationIndex: 0,
      isTeacherGuide: false,
    });
  });

  it("parses a teacher guide path", () => {
    expect(parseItemPath("teacher-guides/investigation-2/problem-0")).toEqual({
      investigationIndex: 2,
      isTeacherGuide: true,
    });
  });

  it("parses a path with just root and investigation", () => {
    expect(parseItemPath("investigations/investigation-3")).toEqual({
      investigationIndex: 3,
      isTeacherGuide: false,
    });
  });

  it("returns undefined when no investigation segment", () => {
    expect(parseItemPath("investigations")).toBeUndefined();
  });

  it("returns undefined for invalid investigation format", () => {
    expect(parseItemPath("investigations/inv-0/problem-0")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseItemPath("")).toBeUndefined();
  });

  it("returns undefined for unknown root", () => {
    expect(parseItemPath("something-else/investigation-0/problem-1")).toBeUndefined();
  });
});

describe("buildProblemSectionsFormData", () => {
  const availableSections = {
    introduction: { initials: "IN", title: "Introduction", placeholder: "" },
    initialChallenge: { initials: "IC", title: "Initial Challenge", placeholder: "" },
    whatIf: { initials: "WI", title: "What If...?", placeholder: "" },
  };

  it("returns all sections disabled when problem has no sections", () => {
    const problem = makeProblem(1, "P1");
    const result = buildProblemSectionsFormData(problem, availableSections, undefined);
    expect(result).toHaveLength(3);
    expect(result.every(s => !s.enabled)).toBe(true);
    expect(result.map(s => s.type)).toEqual(["introduction", "initialChallenge", "whatIf"]);
  });

  it("marks existing sections as enabled with their paths", () => {
    const problem = makeProblem(1, "P1", [
      "inv-1/prob-1/introduction/content.json",
      "inv-1/prob-1/whatIf/content.json",
    ]);
    const files = {
      "inv-1/prob-1/introduction/content.json": { type: "introduction" },
      "inv-1/prob-1/whatIf/content.json": { type: "whatIf" },
    };
    const result = buildProblemSectionsFormData(problem, availableSections, files);

    // Enabled first, in saved order
    expect(result[0]).toEqual({
      type: "introduction",
      enabled: true,
      existingPath: "inv-1/prob-1/introduction/content.json",
    });
    expect(result[1]).toEqual({
      type: "whatIf",
      enabled: true,
      existingPath: "inv-1/prob-1/whatIf/content.json",
    });
    // Disabled after
    expect(result[2]).toEqual({
      type: "initialChallenge",
      enabled: false,
    });
  });

  it("preserves the saved order of enabled sections", () => {
    // whatIf before introduction in the saved order
    const problem = makeProblem(1, "P1", [
      "inv-1/prob-1/whatIf/content.json",
      "inv-1/prob-1/introduction/content.json",
    ]);
    const files = {
      "inv-1/prob-1/whatIf/content.json": { type: "whatIf" },
      "inv-1/prob-1/introduction/content.json": { type: "introduction" },
    };
    const result = buildProblemSectionsFormData(problem, availableSections, files);

    expect(result[0].type).toBe("whatIf");
    expect(result[1].type).toBe("introduction");
    expect(result[2].type).toBe("initialChallenge");
  });

  it("infers section type from path when files map has no type", () => {
    const problem = makeProblem(1, "P1", [
      "inv-1/prob-1/introduction/content.json",
    ]);
    // No files map at all
    const result = buildProblemSectionsFormData(problem, availableSections, undefined);

    expect(result[0]).toEqual({
      type: "introduction",
      enabled: true,
      existingPath: "inv-1/prob-1/introduction/content.json",
    });
  });

  it("prefers files[type] over inferring from path", () => {
    const problem = makeProblem(1, "P1", [
      "inv-1/prob-1/weirdName/content.json",
    ]);
    const files = {
      "inv-1/prob-1/weirdName/content.json": { type: "introduction" },
    };
    const result = buildProblemSectionsFormData(problem, availableSections, files);

    expect(result[0]).toEqual({
      type: "introduction",
      enabled: true,
      existingPath: "inv-1/prob-1/weirdName/content.json",
    });
  });

  it("preserves duplicate enabled section types when present", () => {
    const problem = makeProblem(1, "P1", [
      "inv-1/prob-1/a/content.json",
      "inv-1/prob-1/b/content.json",
    ]);
    const files = {
      "inv-1/prob-1/a/content.json": { type: "introduction" },
      "inv-1/prob-1/b/content.json": { type: "introduction" },
    };

    const result = buildProblemSectionsFormData(problem, availableSections, files);
    const enabled = result.filter(s => s.enabled);
    expect(enabled.map(s => s.type)).toEqual(["introduction", "introduction"]);
    expect(enabled.map(s => s.existingPath)).toEqual([
      "inv-1/prob-1/a/content.json",
      "inv-1/prob-1/b/content.json",
    ]);
  });

  it("ignores section paths that cannot be typed", () => {
    const problem = makeProblem(1, "P1", [
      "inv-1/prob-1/introduction/not-content.json",
    ]);
    const result = buildProblemSectionsFormData(problem, availableSections, undefined);
    expect(result.every(s => !s.enabled)).toBe(true);
    expect(result.map(s => s.type)).toEqual(["introduction", "initialChallenge", "whatIf"]);
  });

  it("applies sectionPathPrefix when looking up files", () => {
    const problem = makeProblem(1, "P1", [
      "overview/content.json",
    ]);
    const tgSections = {
      overview: { initials: "OV", title: "Overview", placeholder: "" },
      launch: { initials: "LA", title: "Launch", placeholder: "" },
    };
    const files = {
      "teacher-guide/overview/content.json": { type: "overview" },
    };
    const result = buildProblemSectionsFormData(problem, tgSections, files, "teacher-guide/");

    expect(result[0]).toEqual({
      type: "overview",
      enabled: true,
      existingPath: "overview/content.json",
    });
    expect(result[1]).toEqual({
      type: "launch",
      enabled: false,
    });
  });

  it("skips sections not in availableSections", () => {
    const problem = makeProblem(1, "P1", [
      "inv-1/prob-1/unknownType/content.json",
    ]);
    const files = {
      "inv-1/prob-1/unknownType/content.json": { type: "unknownType" },
    };
    const result = buildProblemSectionsFormData(problem, availableSections, files);

    // unknownType is not in availableSections, so it's skipped
    expect(result.every(s => s.type !== "unknownType")).toBe(true);
    expect(result).toHaveLength(3); // just the 3 available sections, all disabled
    expect(result.every(s => !s.enabled)).toBe(true);
  });
});
