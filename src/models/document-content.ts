import { types, Instance } from "mobx-state-tree";
import { DataSet } from "./data/data-set";
import { defaultGeometryContent, kGeometryDefaultHeight } from "./tools/geometry/geometry-content";
import { ToolTileModel, ToolTileModelType } from "./tools/tool-tile";

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
    addGeometryTile() {
      self.tiles.push(ToolTileModel.create({
        layout: {
          height: kGeometryDefaultHeight
        },
        content: defaultGeometryContent()
      }));
    },
    addTextTile(initialText?: string) {
      self.tiles.push(ToolTileModel.create({
        content: {
          type: "Text",
          text: initialText
        }
      }));
    },
    deleteTile(tileId: string) {
      const index = self.tiles.findIndex(tile => tile.id === tileId);
      if (index >= 0) {
        self.tiles.splice(index, 1);
      }
    },
    addTileSnapshot(snapshot: ToolTileModelType) {
      self.tiles.push(ToolTileModel.create(snapshot));
    }
  }));

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
