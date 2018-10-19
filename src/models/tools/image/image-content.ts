import { types, Instance } from "mobx-state-tree";
const placeholderImage = "assets/image_placeholder.png";

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
    url: types.string
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }))
  .extend(self => {

    // actions
    function setUrl(url: string) {
      self.url = url;
    }

    return {
      actions: {
        setUrl
      }
    };
  });

export type ImageContentModelType = Instance<typeof ImageContentModel>;
