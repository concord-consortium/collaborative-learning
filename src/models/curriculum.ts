import { SnapshotIn, types } from "mobx-state-tree";
import { AuthoredContentModel } from "./authored-content";
import { InvestigationModel } from "./investigation";
import { SectionModelType, SectionType } from "./section";
import { each, isObject } from "lodash";

export const CurriculumModel = types
  .model("Curriculum", {
    title: types.string,
    subtitle: types.optional(types.string, ""),
    lookingAhead: types.maybe(AuthoredContentModel),
    investigations: types.array(InvestigationModel)
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
