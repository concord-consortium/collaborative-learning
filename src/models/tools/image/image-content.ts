import { types, Instance } from "mobx-state-tree";
const placeholderImage = require("../../../assets/image_placeholder.png");

export const kImageToolID = "Image";

export function defaultImageContent() {
  return ImageContentModel.create({
                            type: "Image",
                            url: placeholderImage
                          });
}

export const ImageContentModel = types
  .model("ImageTool", {
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    url: types.maybe(types.string),
    storePath: types.maybe(types.string)
  })
  .extend(self => {

    // actions
    function setUrl(url?: string, storePath?: string) {
      self.url = url;
      self.storePath = storePath;
    }

    return {
      actions: {
        setUrl
      }
    };
  });

export type ImageContentModelType = Instance<typeof ImageContentModel>;
