import { expect } from "chai";
import { sectionInfo, SectionModel, SectionType } from "./section";
import { each } from "lodash";

describe("workspace model", () => {

  it("supports built-in section types", () => {
    each(SectionType, type => {
      const section = SectionModel.create({ type });
      const info = sectionInfo[type];
      expect(section.title).to.equal(info.title);
      expect(section.abbrev).to.equal(info.abbrev);
    });
  });

});
