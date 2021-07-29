import { types, Instance } from "mobx-state-tree";
import { registerToolContentInfo } from "../tool-content-info";

export const kDataflowToolID = "Dataflow";

export function defaultDataflowContent(): DataflowContentModelType {
  return DataflowContentModel.create();
}

export const kDataflowDefaultHeight = 480;

export const DataflowContentModel = types
  .model("DataflowTool", {
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

registerToolContentInfo({
  id: kDataflowToolID,
  tool: "dataflow",
  modelClass: DataflowContentModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent,
});
