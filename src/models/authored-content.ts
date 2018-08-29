import { types } from "mobx-state-tree";

export const AuthoredContentModel = types
  .model("AuthoredContent", {
    // placeholder - will need to accommodate layout of text, images, etc.
    content: types.array(types.string)
  });

export type AuthoredContentModelType = typeof AuthoredContentModel.Type;
