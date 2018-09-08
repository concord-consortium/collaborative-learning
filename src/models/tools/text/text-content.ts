import { types, Instance } from "mobx-state-tree";

export const kTextToolID = "Text";

export const TextContentModel = types
  .model("TextTool", {
    type: types.literal(kTextToolID),
    text: ""
  });

export type TextContentModelType = Instance<typeof TextContentModel>;
