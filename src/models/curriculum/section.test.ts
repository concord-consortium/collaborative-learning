import { sectionInfo, SectionModel, SectionType } from "./section";
import { each } from "lodash";

describe("workspace model", () => {

  it("supports built-in section types", () => {
    each(SectionType, type => {
      const section = SectionModel.create({ id: type, type });
      const info = sectionInfo[type];
      expect(section.title).toBe(info.title);
      expect(section.abbrev).toBe(info.abbrev);
    });
  });

});
