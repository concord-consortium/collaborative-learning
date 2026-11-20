import { UnitModel } from "../../models/curriculum/unit";
import { describePromptSource } from "./ai-summary";

const unit = UnitModel.create({
  code: "sas",
  title: "Stretching and Shrinking",
  investigations: [
    {
      ordinal: 1,
      title: "Enlarging Figures",
      problems: [{ ordinal: 1, title: "Solving a Mystery" }, { ordinal: 2, title: "Scaling Up" }]
    }
  ]
});

describe("describePromptSource", () => {
  it("names the problem whose rules ran, with its title", () => {
    expect(describePromptSource(unit, { level: "problem", ordinal: "1.2" }))
      .toBe("Summarizing using rules for Problem 1.2: Scaling Up");
  });

  it("names the investigation whose rules ran, with its title", () => {
    expect(describePromptSource(unit, { level: "investigation", ordinal: "1" }))
      .toBe("Summarizing using rules for Investigation 1: Enlarging Figures");
  });

  it("names the unit by title, which carries no ordinal", () => {
    expect(describePromptSource(unit, { level: "unit" }))
      .toBe("Summarizing using rules for Unit: Stretching and Shrinking");
  });

  it("says the built-in rules ran when nothing was authored", () => {
    expect(describePromptSource(unit, undefined)).toBe("Summarizing using the default rules");
  });

  // The summary outlives the content.json it was built from, so a prompt authored on a problem
  // since removed must still say which problem rather than read as a broken sentence.
  it("names an ordinal the unit no longer has, without its title", () => {
    expect(describePromptSource(unit, { level: "problem", ordinal: "9.9" }))
      .toBe("Summarizing using rules for Problem 9.9");
  });
});
