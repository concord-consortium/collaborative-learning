import { types } from "mobx-state-tree";

export const kTextToolID = "Text";

export const TextToolModel = types
  .model("TextTool", {
    type: types.literal(kTextToolID)
    // tool-specific types
  });

export type TextToolModelType = typeof TextToolModel.Type;
