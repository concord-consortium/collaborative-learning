import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { ToolContentModel } from "../tool-types";

export const kPlaceholderToolID = "Placeholder";

export const PlaceholderContentModel = ToolContentModel
  .named("PlaceholderContent")
  .props({
    type: types.optional(types.literal(kPlaceholderToolID), kPlaceholderToolID),
    sectionId: ""
  })
  .actions(self => ({
    setSectionId(sectionId = "") {
      self.sectionId = sectionId;
    }
  }));

export type PlaceholderContentModelType = Instance<typeof PlaceholderContentModel>;
export type PlaceholderContentSnapshotOutType = SnapshotOut<typeof PlaceholderContentModel>;
