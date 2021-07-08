import { types, Instance } from "mobx-state-tree";

export const ImageModel = types
  .model("Image", {
    key: types.string,
    imageData: types.string,
    title: types.maybe(types.string),
    originalSource: types.maybe(types.string),
    createdAt: types.number,
    createdBy: types.string
  });

export type ImageModelType = Instance<typeof ImageModel>;
