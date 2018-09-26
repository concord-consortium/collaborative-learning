import { types, Instance } from "mobx-state-tree";

export const kImageToolID = "Image";

const NumberOrString = types.union(types.number, types.string);

export const ImageContentModel = types
  .model("ImageTool", {
    type: types.optional(types.literal(kImageToolID), kImageToolID),
    url: types.maybe(types.string),
    width: types.maybe(NumberOrString),
    height: types.maybe(NumberOrString),
    align: types.maybe(types.string),
  })
  .extend(self => {

    // actions
    function setUrl(url?: string) {
      self.url = url;
    }

    function setWidth(width?: number | string) {
      self.width = width;
    }

    function setHeight(height?: number | string) {
      self.height = height;
    }

    function setAlign(align?: string) {
      self.align = align;
    }

    return {
      actions: {
        setUrl,
        setWidth,
        setHeight,
        setAlign,
      }
    };
  });

export type ImageContentModelType = Instance<typeof ImageContentModel>;
