import { SnapshotIn, types } from "mobx-state-tree";
import { DocumentContentModel } from "./document-content";
import { InvestigationModel } from "./investigation";
import { SectionModelType, SectionType } from "./section";
import { each, isObject } from "lodash";

export const CurriculumModel = types
  .model("Curriculum", {
    title: types.string,
    subtitle: "",
    lookingAhead: types.maybe(DocumentContentModel),
    investigations: types.array(InvestigationModel)
  })
  .views(self => {
    return {
      getInvestigation(investigationOrdinal: number) {
        return (investigationOrdinal > 0) && (investigationOrdinal <= self.investigations.length)
                ? self.investigations[investigationOrdinal - 1]
                : undefined;
      }
    };
  })
  .views(self => {
    return {
      // ordinalString: e.g. "2.1", "2.2", etc.
      getProblem(ordinalString: string) {
        const ordinals = ordinalString.split(".");
        const investigationOrdinal = ordinals[0] ? +ordinals[0] : 1;
        const problemOrdinal = ordinals[1] ? +ordinals[1] : 1;
        const investigation = self.getInvestigation(investigationOrdinal);
        return investigation && investigation.getProblem(problemOrdinal);
      }
    };
  });

export type CurriculumModelType = typeof CurriculumModel.Type;

/*
  createFromJson

  The JSON representation contains strings for things like SectionTypes.
  CurriculumModel.create() expects proper TypeScript enumerated values instead.
  This function recursively replaces SectionType strings with the corresponding
  SectionType enumerated values and returns the resulting CurriculumModel.
 */
export function createFromJson(json: any) {
  const snapshot = replaceSectionTypes(json);
  return CurriculumModel.create(snapshot);
}

/*
  replaceSectionTypes

  Recursively replaces SectionType strings in 'type' fields with corresponding
  SectionType enumerated values.
 */
function replaceSectionTypes(obj: {}): SnapshotIn<typeof CurriculumModel> {
  each(obj, (v, k) => {
    if ((k === "type") && (SectionType[v] != null)) {
      (obj as SectionModelType).type = SectionType[v] as SectionType;
    }
    else if (isObject(v)) {
      replaceSectionTypes(v);
    }
  });
  return obj as SnapshotIn<typeof CurriculumModel>;
}
