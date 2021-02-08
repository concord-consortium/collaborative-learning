import { types } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { SupportModel } from "./support";
import { each } from "lodash";

export type SectionType = string;

export interface ISectionInfo {
  initials: string;
  title: string;
  placeholder?: string;
}

export interface ISectionInfoMap {
  [sectionId: string]: ISectionInfo;
}

export const kAllSectionType = "all";
const kAllSectionInfo = { initials: "*", title: "All" };
export const kUnknownSectionType = "unknown";
export const kDefaultPlaceholder = "Create or drag tiles here";
const kUnknownSectionInfo = { initials: "?", title: "Unknown", placeholder: kDefaultPlaceholder };

const gSectionInfoMap: ISectionInfoMap = { [kAllSectionType]: kAllSectionInfo };

export function setSectionInfoMap(sectionInfoMap?: ISectionInfoMap) {
  // regular content and teacher guide are two separate units, so we merge them into a single map
  // teacher guide section types should be unique from regular content; we don't replace existing entries
  each(sectionInfoMap, (sectionInfo, sectionType) => {
    if (!gSectionInfoMap[sectionType]) {
      gSectionInfoMap[sectionType] = sectionInfo;
    }
    else {
      console.warn("setSectionInfoMap skipping redundant assignment of section type:",
                  `${sectionType} "${sectionInfo.title}"`);
    }
  });
}

function getSectionInfo(type: SectionType) {
  return gSectionInfoMap && gSectionInfoMap[type] || kUnknownSectionInfo;
}

export function getSectionInitials(type: SectionType) {
  return getSectionInfo(type).initials;
}

export function getSectionTitle(type: SectionType) {
  return getSectionInfo(type).title;
}

export function getSectionPlaceholder(type: SectionType) {
  return getSectionInfo(type).placeholder || kDefaultPlaceholder;
}

export const SectionModel = types
  .model("Section", {
    type: types.string, // sectionId corresponding to entry in unit
    disabled: types.array(types.string),
    content: types.maybe(DocumentContentModel),
    supports: types.array(SupportModel),
  })
  .views(self => {
    return {
      get initials() {
        return getSectionInitials(self.type);
      },
      get title() {
        return getSectionTitle(self.type);
      },
      get placeholder() {
        return getSectionPlaceholder(self.type);
      }
    };
  });
export type SectionModelType = typeof SectionModel.Type;
