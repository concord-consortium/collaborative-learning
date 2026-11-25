import { getSnapshot, types, Instance } from "mobx-state-tree";
import stringify from "json-stringify-pretty-compact";
import { TileContentModel } from "../../models/tiles/tile-content";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";
import { kFlowchartTileType } from "./flowchart-types";

export function defaultFlowchartContent(): FlowchartContentModelType {
  return FlowchartContentModel.create();
}

export const FlowchartContentModel = TileContentModel
  .named("FlowchartTool")
  .props({
    type: types.optional(types.literal(kFlowchartTileType), kFlowchartTileType)
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      return stringify(getSnapshot(self), {maxLength: 200});
    }
  }));

export interface FlowchartContentModelType extends Instance<typeof FlowchartContentModel> {}
