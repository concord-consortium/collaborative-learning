import { types } from "mobx-state-tree";

export const kUnknownToolID = "Unknown";

export const UnknownToolModel = types
  .model("UnknownTool", {
    type: types.literal(kUnknownToolID)
  });

export type UnknownToolModelType = typeof UnknownToolModel.Type;
