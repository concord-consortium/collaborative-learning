import { SnapshotIn, types } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { InvestigationModel } from "./investigation";
import { SectionModelType, SectionType } from "./section";
import { SupportModel } from "./support";
import { each, isObject } from "lodash";
import { StampModel } from "../tools/drawing/drawing-content";
import { ToolButtonModel } from "../tools/tool-types";
import { RightNavTabModel } from "../view/right-nav";

export const UnitModel = types
  .model("Unit", {
    code: "",
    abbrevTitle: "",
    title: types.string,
    subtitle: "",
    pageTitle: "",
    demoProblemTitle: "",
    lookingAhead: types.maybe(DocumentContentModel),
    investigations: types.array(InvestigationModel),
    supports: types.array(SupportModel),
    rightNavTabs: types.array(RightNavTabModel),
    toolbar: types.array(ToolButtonModel),
    defaultStamps: types.array(StampModel),
  })
  .views(self => ({
    get fullTitle() {
      return `${self.title}${self.subtitle ? ": " + self.subtitle : ""}`;
    },
    getInvestigation(investigationOrdinal: number) {
      return (investigationOrdinal > 0) && (investigationOrdinal <= self.investigations.length)
              ? self.investigations[investigationOrdinal - 1]
              : undefined;
    }
  }))
  .views(self => ({
    // ordinalString: e.g. "2.1", "2.2", etc.
    getProblem(ordinalString: string) {
      const ordinals = ordinalString.split(".");
      // if only one exists, investigation defaults to 1
      // if neither exists, investigation defaults to 0
      const investigationOrdinal = ordinals[1] ? +ordinals[0] : (+ordinals[0] ? 1 : 0);
      // if only one exists, it corresponds to problem
      const problemOrdinal = ordinals[1] ? +ordinals[1] : +ordinals[0];
      const investigation = self.getInvestigation(investigationOrdinal);
      return {
        investigation,
        problem:  investigation && investigation.getProblem(problemOrdinal)
      };
    }
  }));

export type UnitModelType = typeof UnitModel.Type;

/*
  createFromJson

  The JSON representation contains strings for things like SectionTypes.
  CurriculumModel.create() expects proper TypeScript enumerated values instead.
  This function recursively replaces SectionType strings with the corresponding
  SectionType enumerated values and returns the resulting CurriculumModel.
 */
export function createFromJson(json: any) {
  const snapshot = replaceSectionTypes(json);
  return UnitModel.create(snapshot);
}

/*
  replaceSectionTypes

  Recursively replaces SectionType strings in 'type' fields with corresponding
  SectionType enumerated values.
 */
function replaceSectionTypes(obj: {}): SnapshotIn<typeof UnitModel> {
  each(obj, (v, k) => {
    if ((k === "type") && (SectionType[v] != null)) {
      (obj as SectionModelType).type = SectionType[v] as SectionType;
    }
    else if (isObject(v)) {
      replaceSectionTypes(v);
    }
  });
  return obj as SnapshotIn<typeof UnitModel>;
}
