import { types, Instance } from "mobx-state-tree";

export function defaultImage() {
  return ImageModel.create({
    key: "",
    imageData: "",
    title: "Placeholder",
    originalSource: "",
    createdAt: 0,
    createdBy: ""
  });
}

export const ImageModel = types
  .model("Image", {
    key: types.string,
    imageData: types.string,
    title: types.maybe(types.string),
    originalSource: types.maybe(types.string),
    createdAt: types.number,
    createdBy: types.string
  })
  .actions((self) => ({
    setKey(key: string) {
      self.key = key;
    }

  }));

export type ImageModelType = Instance<typeof ImageModel>;
