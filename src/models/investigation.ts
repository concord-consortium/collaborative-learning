import { types } from "mobx-state-tree";
import { DocumentContentModel } from "./document-content";
import { ProblemModel } from "./problem";

export const InvestigationModel = types
  .model("Investigation", {
    ordinal: types.integer,
    title: types.string,
    introduction: types.maybe(DocumentContentModel),
    problems: types.array(ProblemModel),
    reflections: types.maybe(DocumentContentModel)
  })
  .views(self => {
    return {
      getProblem(problemOrdinal: number) {
        return (problemOrdinal > 0) && (problemOrdinal <= self.problems.length)
                ? self.problems[problemOrdinal - 1]
                : undefined;
      }
    };
  });

export type InvestigationModelType = typeof InvestigationModel.Type;
