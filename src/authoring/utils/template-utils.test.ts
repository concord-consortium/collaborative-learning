import { buildSectionDividerTemplate } from "./template-utils";

describe("buildSectionDividerTemplate", () => {
  it("seeds a section divider followed by a placeholder for each section id, in order", () => {
    const { tiles } = buildSectionDividerTemplate(["intro", "nowWhatDoYouKnow"]);
    // Same header + "put content here" placeholder structure the default sectioned problem document uses.
    expect(tiles).toEqual([
      { content: { isSectionHeader: true, sectionId: "intro" } },
      { content: { type: "Placeholder", sectionId: "intro", containerType: "DocumentContent" } },
      { content: { isSectionHeader: true, sectionId: "nowWhatDoYouKnow" } },
      { content: { type: "Placeholder", sectionId: "nowWhatDoYouKnow", containerType: "DocumentContent" } },
    ]);
  });

  it("returns an empty tile list when there are no sections", () => {
    expect(buildSectionDividerTemplate(undefined).tiles).toEqual([]);
    expect(buildSectionDividerTemplate([]).tiles).toEqual([]);
  });
});
