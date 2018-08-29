import { types } from "mobx-state-tree";
import { AuthoredContentModel } from "./authored-content";
import { InvestigationModel } from "./investigation";

export const CurriculumModel = types
  .model("Curriculum", {
    title: types.string,
    subtitle: types.optional(types.string, ""),
    lookingAhead: types.maybe(AuthoredContentModel),
    investigations: types.array(InvestigationModel)
  });

export type CurriculumModelType = typeof CurriculumModel.Type;
