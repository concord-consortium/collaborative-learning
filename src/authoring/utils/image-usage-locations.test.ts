import { IUnit } from "../types";
import { describeUsagePath } from "./image-usage-locations";

const unitConfig = {
  title: "Stretching and Shrinking",
  investigations: [
    {
      ordinal: 0, title: "Introduction to CLUE",
      problems: [
        {
          ordinal: 1, title: "0.1 Intro to CLUE",
          sections: [
            "investigation-0/problem-1/introduction/content.json",
            "investigation-0/problem-1/initialChallenge/content.json"
          ]
        }
      ]
    },
    {
      ordinal: 1, title: "Enlarging and Reducing Shapes",
      problems: [
        {
          ordinal: 2, title: "1.2 Changing Shapes",
          sections: ["investigation-1/problem-2/introduction/content.json"]
        }
      ]
    }
  ]
} as unknown as IUnit;

const teacherGuideConfig = {
  title: "Teacher Guide",
  investigations: [
    {
      ordinal: 1, title: "Enlarging and Reducing Shapes",
      problems: [
        {
          ordinal: 2, title: "1.2 Changing Shapes",
          sections: ["investigation-1/problem-2/launch/content.json"]
        }
      ]
    }
  ]
} as unknown as IUnit;

describe("describeUsagePath", () => {
  it("resolves a declared section path to its Investigation/Problem titles and section type", () => {
    const loc = describeUsagePath(
      "investigation-0/problem-1/introduction/content.json", unitConfig, teacherGuideConfig);
    expect(loc).toEqual({
      path: "investigation-0/problem-1/introduction/content.json",
      isTeacherGuide: false,
      investigationTitle: "Introduction to CLUE",
      problemTitle: "0.1 Intro to CLUE",
      sectionType: "introduction"
    });
  });

  it("flags teacher-guide paths and resolves them against the teacher guide config", () => {
    const loc = describeUsagePath(
      "teacher-guide/investigation-1/problem-2/launch/content.json", unitConfig, teacherGuideConfig);
    expect(loc.isTeacherGuide).toBe(true);
    expect(loc.investigationTitle).toBe("Enlarging and Reducing Shapes");
    expect(loc.problemTitle).toBe("1.2 Changing Shapes");
    expect(loc.sectionType).toBe("launch");
  });

  it("falls back to ordinal parsing when the path is not a declared section", () => {
    // nowWhatDoYouKnow is not in the declared sections, but the ordinals identify the problem
    const loc = describeUsagePath(
      "investigation-1/problem-2/nowWhatDoYouKnow/content.json", unitConfig, teacherGuideConfig);
    expect(loc.investigationTitle).toBe("Enlarging and Reducing Shapes");
    expect(loc.problemTitle).toBe("1.2 Changing Shapes");
    expect(loc.sectionType).toBe("nowWhatDoYouKnow");
  });

  it("returns undefined titles for an unrecognizable path but still parses the section type", () => {
    const loc = describeUsagePath("investigation-9/problem-9/explore/content.json", unitConfig, undefined);
    expect(loc.investigationTitle).toBeUndefined();
    expect(loc.problemTitle).toBeUndefined();
    expect(loc.sectionType).toBe("explore");
  });
});
