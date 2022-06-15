import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { exportImageTileSpec, isLegacyImageTileImport, convertLegacyImageTile } from "./image-import-export";
import { ITileExportOptions, IDefaultContentOptions } from "../tool-content-info";
import { ToolContentModel, ToolMetadataModel, getToolTileModel } from "../tool-types";
import { isPlaceholderImage } from "../../../utilities/image-utils";
import placeholderImage from "../../../assets/image_placeholder.png";

export const kImageToolID = "Image";

// This is only used directly by tests
export function defaultImageContent(options?: IDefaultContentOptions) {
  return ImageContentModel.create({url: options?.url || placeholderImage});
}

export const ImageMetadataModel = ToolMetadataModel
  .named("ImageMetadata")
  .props({
    title: types.maybe(types.string)
  })
  .actions(self => ({
    setTitle(title: string) {
      self.title = title;
    }
  }));
export type ImageMetadataModelType = Instance<typeof ImageMetadataModel>;

export const ImageContentModel = ToolContentModel
  .named("ImageTool")
  .props({
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    url: types.maybe(types.string),
    filename: types.maybe(types.string),
  })
  .volatile(self => ({
    metadata: undefined as any as ImageMetadataModelType
  }))
  .preProcessSnapshot(snapshot => {
    return isLegacyImageTileImport(snapshot)
            ? convertLegacyImageTile(snapshot)
            : snapshot;
  })
  .views(self => ({
    get title() {
      return self.metadata.title;
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
  .actions(self => ({
    doPostCreate(metadata: ImageMetadataModelType) {
      self.metadata = metadata;
      const toolTileModel = getToolTileModel(self);
      if (toolTileModel && toolTileModel.title) {
        self.metadata.setTitle(toolTileModel.title);
      }
    },
    setUrl(url: string, filename?: string) {
      self.url = url;
      self.filename = filename;
    },
    updateImageUrl(oldUrl: string, newUrl: string) {
      if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
      if (self.url === oldUrl) self.url = newUrl;
    },
    setTitle(title: string) {
      self.metadata.setTitle(title);
      const toolTileModel = getToolTileModel(self);
      if (toolTileModel) {
        toolTileModel.setTitle(title);
      }
    }
  }));

export type ImageContentModelType = Instance<typeof ImageContentModel>;
export type ImageContentSnapshotOutType = SnapshotOut<typeof ImageContentModel>;
