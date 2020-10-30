import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { registerToolContentInfo } from "../tool-content-info";
import { safeJsonParse } from "../../../utilities/js-utils";
import placeholderImage from "../../../assets/image_placeholder.png";

export const kImageToolID = "Image";

export type ImageOperation = "update";

export interface ImageToolChange {
  operation: ImageOperation;
  url: string;
}

export function defaultImageContent(url?: string) {
  const change = JSON.stringify({
                  operation: "update",
                  url: url || placeholderImage
                });
  return ImageContentModel.create({
                            type: "Image",
                            changes: [change]
                          });
}

function createChange(url: string) {
  return JSON.stringify({ operation: "update", url });
}

export const ImageContentModel = types
  .model("ImageTool", {
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    changes: types.array(types.string)
  })
  .preProcessSnapshot(snapshot => {
    const { url, changes, ...others } = snapshot as any;
    return url && !changes
            ? { changes: [createChange(url)], ...others }
            : snapshot;
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get changeCount() {
      return self.changes.length;
    },
    get url() {
      if (!self.changes.length) return;
      const lastChangeJson = self.changes[self.changes.length - 1];
      const lastChange = safeJsonParse(lastChangeJson);
      return lastChange?.url;
    }
  }))
  .views(self => ({
    get hasValidImage() {
      return self.url !== placeholderImage;
    }
  }))
  .actions(self => ({
    setUrl(url: string) {
      self.changes.push(createChange(url));
    },
    updateImageUrl(oldUrl: string, newUrl: string) {
      if (!oldUrl || !newUrl || (oldUrl === newUrl)) return;
      // identify change entries to be modified
      const updates: Array<{ index: number, change: string }> = [];
      self.changes.forEach((changeJson, index) => {
        const change: ImageToolChange = safeJsonParse(changeJson);
        switch (change && change.operation) {
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
