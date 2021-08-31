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

export const kAllSectionType = "all";
const kAllSectionInfo = { initials: "*", title: "All" };
export const kUnknownSectionType = "unknown";
export const kDefaultPlaceholder = "Create or drag tiles here";
const kUnknownSectionInfo = { initials: "?", title: "Unknown", placeholder: kDefaultPlaceholder };

/*
 * SectionInfoMap
 *
 * Global map from sectionType to SectionInfo, e.g.
 * "introduction" => { initials: "IN", title: "introduction", placeholder: ... }
 *
 * Problem document sections are loaded from the `sections` property of the curriculum unit JSON.
 * Teacher guide sections were originally loaded from the `sections` property of the teacher guide unit JSON.
 * Planning document shares the same sections as teacher guide (overview, launch, explore, summarize).
 *
 * Since not all curriculum has a teacher guide, however, we can't rely on teacher guide JSON to
 * initialize the map for the planning document. Therefore, the non-curriculum sections are now
 * configured via the curriculum unit JSON.
 */
export type ISectionInfoMap = Record<string, ISectionInfo>;

const gSectionInfoMap: ISectionInfoMap = { [kAllSectionType]: kAllSectionInfo };

export function registerSectionInfo(sectionInfoMap?: ISectionInfoMap) {
  // regular content and teacher guide are two separate units, so we merge them into a single map
  // teacher guide section types should be unique from regular content; we don't replace existing entries
  each(sectionInfoMap, (sectionInfo, sectionType) => {
    if (!gSectionInfoMap[sectionType]) {
      gSectionInfoMap[sectionType] = sectionInfo;
    }
    else {
      console.warn("registerSectionInfo skipping redundant assignment of section type:",
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
    // list of features to be disabled for this section
    // currently unused as features are only disabled at the problem level
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
