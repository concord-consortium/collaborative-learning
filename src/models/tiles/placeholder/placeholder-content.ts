import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { TileContentModel } from "../tile-types";

export const kPlaceholderTileType = "Placeholder";

export const PlaceholderContentModel = TileContentModel
  .named("PlaceholderContent")
  .props({
    type: types.optional(types.literal(kPlaceholderTileType), kPlaceholderTileType),
    sectionId: ""
  })
  .actions(self => ({
    setSectionId(sectionId = "") {
      self.sectionId = sectionId;
    }
  }));

export type PlaceholderContentModelType = Instance<typeof PlaceholderContentModel>;
export type PlaceholderContentSnapshotOutType = SnapshotOut<typeof PlaceholderContentModel>;

export function isPlaceholderContent(content: any): content is PlaceholderContentModelType {
  return content?.type === kPlaceholderTileType;
}
