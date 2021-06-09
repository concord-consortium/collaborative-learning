import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { createChange, ImageToolChange } from "./image-change";
import { exportImageTileSpec, importImageTileSpec, isImageTileImportSpec } from "./image-import-export";
import { ITileExportOptions, registerToolContentInfo } from "../tool-content-info";
import { isPlaceholderImage } from "../../../utilities/image-utils";
import { safeJsonParse } from "../../../utilities/js-utils";
import placeholderImage from "../../../assets/image_placeholder.png";

export const kImageToolID = "Image";

export function defaultImageContent(url?: string) {
  const change = createChange(url || placeholderImage);
  return ImageContentModel.create({
                            type: "Image",
                            changes: [change]
                          });
}

export const ImageContentModel = types
  .model("ImageTool", {
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    changes: types.array(types.string)
  })
  .preProcessSnapshot(snapshot => {
    return isImageTileImportSpec(snapshot)
            ? importImageTileSpec(snapshot)
            : snapshot;
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get changeCount() {
      return self.changes.length;
    },
    get filename() {
      if (!self.changes.length) return;
      const lastChangeJson = self.changes[self.changes.length - 1];
      const lastChange = safeJsonParse<ImageToolChange>(lastChangeJson);
      return lastChange?.filename;
    },
    get url() {
      if (!self.changes.length) return;
      const lastChangeJson = self.changes[self.changes.length - 1];
      const lastChange = safeJsonParse<ImageToolChange>(lastChangeJson);
      return lastChange?.url;
    }
  }))
  .views(self => ({
    get hasValidImage() {
      const url = self.url;
      return !!url && !isPlaceholderImage(url);
    },
    exportJson(options?: ITileExportOptions) {
      return exportImageTileSpec(self.changes);
    }
  }))
  .actions(self => ({
    setUrl(url: string, filename?: string) {
      self.changes.push(createChange(url, filename));
    },
    updateImageUrl(oldUrl: string, newUrl: string) {
      if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
      // identify change entries to be modified
      const updates: Array<{ index: number, change: string }> = [];
      self.changes.forEach((changeJson, index) => {
        const change = safeJsonParse<ImageToolChange>(changeJson);
        switch (change?.operation) {
          case "update":
            if (change.url && (change.url === oldUrl)) {
              change.url = newUrl;
              updates.push({ index, change: JSON.stringify(change) });
            }
            break;
        }
      });
      // make the corresponding changes
      updates.forEach(update => {
        self.changes[update.index] = update.change;
      });
    }
  }));

export type ImageContentModelType = Instance<typeof ImageContentModel>;
export type ImageContentSnapshotOutType = SnapshotOut<typeof ImageContentModel>;

registerToolContentInfo({
  id: kImageToolID,
  tool: "image",
  modelClass: ImageContentModel,
  defaultContent: defaultImageContent
});
