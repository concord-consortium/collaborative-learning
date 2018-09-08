import { types, Instance } from "mobx-state-tree";

export const kTableToolID = "Table";

export const TableContentModel = types
  .model("TableContent", {
    type: types.literal(kTableToolID),
    // tool-specific types
  });

export type TableContentModelType = Instance<typeof TableContentModel>;
