import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { ProblemModel } from "./problem";
import { SupportModel } from "./support";

export const InvestigationModel = types
  .model("Investigation", {
    ordinal: types.integer,
    title: types.string,
    disabled: types.array(types.string),
    introduction: types.maybe(DocumentContentModel),
    problems: types.array(ProblemModel),
    reflections: types.maybe(DocumentContentModel),
    supports: types.array(SupportModel),
  })
  .views(self => {
    return {
      getProblem(problemOrdinal: number) {
        return self.problems.find(problem => problem.ordinal === problemOrdinal);
      }
    };
  });

export type InvestigationModelType = Instance<typeof InvestigationModel>;
export type InvestigationSnapshotType = SnapshotIn<typeof InvestigationModel>;
