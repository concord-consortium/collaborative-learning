import { types } from "mobx-state-tree";

export const kTableToolID = "Table";

export const TableToolModel = types
  .model("TableTool", {
    type: types.literal(kTableToolID)
    // tool-specific types
  });

export type TableToolModelType = typeof TableToolModel.Type;
