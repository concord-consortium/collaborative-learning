import { types } from "mobx-state-tree";

export const ProblemSectionModel = types
  .model("ProblemSection", {
    name: types.string,
    shortName: types.string,
  });

export const ProblemModel = types
  .model("Problem", {
    name: types.string,
    sections: types.array(ProblemSectionModel),
  });

export type ProblemModelType = typeof ProblemModel.Type;
