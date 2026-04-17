import { getSnapshot, types, Instance } from "mobx-state-tree";
import stringify from "json-stringify-pretty-compact";
import { TileContentModel } from "../../models/tiles/tile-content";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";
import { kStarterTileType } from "./starter-types";

export function defaultStarterContent(): StarterContentModelType {
  return StarterContentModel.create({text: "Hello World"});
}


export const StarterContentModel = TileContentModel
  .named("StarterTool")
  .props({
    type: types.optional(types.literal(kStarterTileType), kStarterTileType),
    text: "",
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      return stringify(getSnapshot(self), {maxLength: 200});
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.text = text;
    }
  }));

export interface StarterContentModelType extends Instance<typeof StarterContentModel> {}
