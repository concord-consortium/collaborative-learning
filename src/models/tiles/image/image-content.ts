import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { exportImageTileSpec, isLegacyImageTileImport, convertLegacyImageTile } from "./image-import-export";
import { ITileExportOptions, IDefaultContentOptions } from "../tile-content-info";
import { ITileMetadataModel } from "../tile-metadata";
import { tileModelHooks } from "../tile-model-hooks";
import { getTileModel, setTileTitleFromContent } from "../tile-model";
import { TileContentModel } from "../tile-types";
import { isPlaceholderImage } from "../../../utilities/image-utils";
import placeholderImage from "../../../assets/image_placeholder.png";

export const kImageToolID = "Image";

// This is only used directly by tests
export function defaultImageContent(options?: IDefaultContentOptions) {
  return ImageContentModel.create({url: options?.url || placeholderImage});
}

export const ImageContentModel = TileContentModel
  .named("ImageTool")
  .props({
    type: types.optional(types.literal(kImageToolID), kImageToolID),
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
    get title() {
      return getTileModel(self)?.title;
    },
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
  .actions(self => tileModelHooks({
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
    },
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    }
  }));

export type ImageContentModelType = Instance<typeof ImageContentModel>;
export type ImageContentSnapshotOutType = SnapshotOut<typeof ImageContentModel>;
