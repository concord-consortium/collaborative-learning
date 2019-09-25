import { types } from "mobx-state-tree";
import { values } from "lodash";
import { DocumentContentModel } from "../document/document-content";
import { SupportModel } from "./support";

export enum SectionType {
  introduction = "introduction",
  initialChallenge = "initialChallenge",
  whatIf = "whatIf",
  nowWhatDoYouKnow = "nowWhatDoYouKnow",
  didYouKnow = "didYouKnow"
}

// TODO: figure out way to add SectionType as the index type to this const
export const sectionInfo = {
  [SectionType.introduction]: { title: "Introduction", abbrev: "In" },
  [SectionType.initialChallenge]: { title: "Initial Challenge", abbrev: "IC" },
  [SectionType.whatIf]: { title: "What if...?", abbrev: "W?" },
  [SectionType.nowWhatDoYouKnow]: { title: "Now What Do You Know?", abbrev: "N?" },
  [SectionType.didYouKnow]: { title: "Did You Know?", abbrev: "D?" }
};

export type AllSectionType = "all";
export const allSectionInfo = {
  title: "All"
};

export const SectionModel = types
  .model("Section", {
    type: types.enumeration<SectionType>("SectionType", values(SectionType) as SectionType[]),
    content: types.maybe(DocumentContentModel),
    supports: types.array(SupportModel),
  })
  .views(self => {
    return {
      get id() {
        // until we come up with a more permanent ID
        return self.type;
      },
      get title() {
        return sectionInfo[self.type].title;
      },
      get abbrev() {
        return sectionInfo[self.type].abbrev;
      }
    };
  });
export type SectionModelType = typeof SectionModel.Type;
