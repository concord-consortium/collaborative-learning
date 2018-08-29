import { types } from "mobx-state-tree";
import { AuthoredContentModel } from "./authored-content";
import { ProblemModel } from "./problem";

export const InvestigationModel = types
  .model("Investigation", {
    ordinal: types.integer,
    title: types.string,
    introduction: types.maybe(AuthoredContentModel),
    problems: types.array(ProblemModel),
    reflections: types.maybe(AuthoredContentModel)
  });

export type InvestigationModelType = typeof InvestigationModel.Type;
