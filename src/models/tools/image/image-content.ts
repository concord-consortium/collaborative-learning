import { types, Instance } from "mobx-state-tree";
const placeholderImage = "assets/image_placeholder.png";

export const kImageToolID = "Image";

export function defaultImageContent() {
  return ImageContentModel.create({
                            type: "Image",
                            url: placeholderImage,
                            imageId: ""
                          });
}

export const ImageContentModel = types
  .model("ImageTool", {
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    url: types.string,
    imageId: types.maybe(types.string)
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

    function setId(id: string) {
      self.imageId = id;
    }

    return {
      actions: {
        setUrl,
        setId
      }
    };
  });

export type ImageContentModelType = Instance<typeof ImageContentModel>;
