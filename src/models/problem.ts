import { types } from "mobx-state-tree";

export const ProblemModel = types
  .model("Problem", {
    name: types.string,
  });

export type ProblemModelType = typeof ProblemModel.Type;
