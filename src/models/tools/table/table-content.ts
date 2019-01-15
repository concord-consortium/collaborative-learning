import { types, Instance } from "mobx-state-tree";

export const kTableToolID = "Table";

export const kTableDefaultHeight = 320;

export function defaultTableContent() {
  return TableContentModel.create({
                            type: "Table"
                          });
}

export const TableContentModel = types
  .model("TableContent", {
    type: types.literal(kTableToolID),
    // tool-specific types
  });

export type TableContentModelType = Instance<typeof TableContentModel>;
