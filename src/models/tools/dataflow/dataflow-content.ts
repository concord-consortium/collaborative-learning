import { types, Instance } from "mobx-state-tree";
import { ToolContentModel } from "../tool-types";

export const kDataflowToolID = "Dataflow";

export function defaultDataflowContent(): DataflowContentModelType {
  return DataflowContentModel.create();
}

export const kDataflowDefaultHeight = 480;

export const DataflowContentModel = ToolContentModel
  .named("DataflowTool")
  .props({
    type: types.optional(types.literal(kDataflowToolID), kDataflowToolID),
  })
  .views(self => ({
    isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
