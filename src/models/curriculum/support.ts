import { types } from "mobx-state-tree";

export const SupportModel = types
  .model("Support", {
    text: types.string,
  });

export type SupportModelType = typeof SupportModel.Type;
