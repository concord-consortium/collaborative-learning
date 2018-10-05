import { types, Instance } from "mobx-state-tree";

export const kImageToolID = "Image";

export const ImageContentModel = types
  .model("ImageTool", {
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    url: types.maybe(types.string),
    storePath: types.maybe(types.string)
  })
  .extend(self => {

    // actions
    function setUrl(url?: string) {
      self.url = url;
    }
    function setStorePath(storePath?: string) {
      self.storePath = storePath;
    }

    return {
      actions: {
        setUrl,
        setStorePath
      }
    };
  });

export type ImageContentModelType = Instance<typeof ImageContentModel>;
