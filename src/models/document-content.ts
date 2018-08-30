import { types } from "mobx-state-tree";

export const DocumentContentModel = types
  .model("AuthoredContent", {
    // placeholder - will need to accommodate layout of text, images, etc.
    content: types.array(types.string)
  });

export type DocumentContentModelType = typeof DocumentContentModel.Type;
