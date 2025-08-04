import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { exportImageTileSpec, isLegacyImageTileImport, convertLegacyImageTile } from "./image-import-export";
import { ITileExportOptions, IDefaultContentOptions } from "../tile-content-info";
import { ITileMetadataModel } from "../tile-metadata";
import { tileContentAPIActions } from "../tile-model-hooks";
import { TileContentModel } from "../tile-content";
import { isPlaceholderImage } from "../../../utilities/image-utils";
import { PLACEHOLDER_IMAGE_PATH } from "../../../utilities/image-constants";

export const kImageTileType = "Image";

// This is only used directly by tests
export function defaultImageContent(options?: IDefaultContentOptions) {
  return ImageContentModel.create({url: options?.url || PLACEHOLDER_IMAGE_PATH});
}

export const ImageContentModel = TileContentModel
  .named("ImageTool")
  .props({
    type: types.optional(types.literal(kImageTileType), kImageTileType),
    url: types.maybe(types.string),
    filename: types.maybe(types.string),
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel
  }))
  .preProcessSnapshot(snapshot => {
    return isLegacyImageTileImport(snapshot)
            ? convertLegacyImageTile(snapshot)
            : snapshot;
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
  }))
  .views(self => ({
    get hasValidImage() {
      const url = self.url;
      return !!url && !isPlaceholderImage(url);
    },
    exportJson(options?: ITileExportOptions) {
      return exportImageTileSpec(self.url, self.filename, options);
    }
  }))
  .actions(self => tileContentAPIActions({
      doPostCreate(metadata: ITileMetadataModel) {
        self.metadata = metadata;
      },
  }))
  .actions(self => ({
    setUrl(url: string, filename?: string) {
      self.url = url;
      self.filename = filename;
    },
    updateImageUrl(oldUrl: string, newUrl: string) {
      if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
      if (self.url === oldUrl) self.url = newUrl;
    }
  }));

export type ImageContentModelType = Instance<typeof ImageContentModel>;
export type ImageContentSnapshotOutType = SnapshotOut<typeof ImageContentModel>;
