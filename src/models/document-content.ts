import { types, Instance } from "mobx-state-tree";
import { DataSet } from "./data/data-set";
import { ToolTileModel } from "./tools/tool-tile";

export const DocumentContentModel = types
  .model("DocumentContent", {
    tiles: types.array(ToolTileModel),
    // data shared between tools
    shared: types.maybe(DataSet)
  })
  .views(self => {
    return {
      get isEmpty() {
        return self.tiles.length === 0;
      }
    };
  })
  .actions((self) => ({
    addTextTile() {
      self.tiles.push(ToolTileModel.create({
        content: {
          type: "Text",
          text: ""
        }
      }));
    }
  }));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
