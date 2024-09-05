import { types, Instance } from "mobx-state-tree";
import { ITileContentModel, TileContentModel } from "../../models/tiles/tile-content";
import { kBarGraphTileType, kBarGraphContentType } from "./bar-graph-types";

export function defaultBarGraphContent(): BarGraphContentModelType {
  return BarGraphContentModel.create({yAxisLabel: "Counts"});
}

export const BarGraphContentModel = TileContentModel
  .named(kBarGraphContentType)
  .props({
    type: types.optional(types.literal(kBarGraphTileType), kBarGraphTileType),
    yAxisLabel: "",
    primaryAttribute: types.maybe(types.string),
    secondaryAttribute: types.maybe(types.string)
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setYAxisLabel(text: string) {
      self.yAxisLabel = text;
    },
    setPrimaryAttribute(attrId: string) {
      self.primaryAttribute = attrId;
    },
    setSecondaryAttribute(attrId: string) {
      self.secondaryAttribute = attrId;
    }
  }));

export interface BarGraphContentModelType extends Instance<typeof BarGraphContentModel> {}


export function isBarGraphModel(model?: ITileContentModel): model is BarGraphContentModelType {
  return model?.type === kBarGraphTileType;
}
