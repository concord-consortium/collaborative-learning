import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { exportImageTileSpec, isLegacyImageTileImport, convertLegacyImageTile } from "./image-import-export";
import { ITileExportOptions, IDefaultContentOptions } from "../tool-content-info";
import { ToolContentModel } from "../tool-types";
import { isPlaceholderImage } from "../../../utilities/image-utils";
import placeholderImage from "../../../assets/image_placeholder.png";

export const kImageToolID = "Image";

// This is only used directly by tests
export function defaultImageContent(options?: IDefaultContentOptions) {
  return ImageContentModel.create({url: options?.url || placeholderImage});
}

export const ImageContentModel = ToolContentModel
  .named("ImageTool")
  .props({
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    changes: types.maybe(types.array(types.string)), //keeping for legacy documents
    url: types.maybe(types.string),
    filename: types.maybe(types.string),
  })
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
  .actions(self => ({
    setUrl(url: string, filename?: string) {
      self.url = url;
      self.filename = filename;
    },
    updateImageUrl(oldUrl: string, newUrl: string) {
      if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
      self.url = newUrl;
    }
  }));

export type ImageContentModelType = Instance<typeof ImageContentModel>;
export type ImageContentSnapshotOutType = SnapshotOut<typeof ImageContentModel>;
