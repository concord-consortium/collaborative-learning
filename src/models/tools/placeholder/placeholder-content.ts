import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { registerToolContentInfo } from "../tool-content-info";

export const kPlaceholderToolID = "Placeholder";

export function defaultPlaceholderContent(sectionId = "") {
  return PlaceholderContentModel.create({
    type: kPlaceholderToolID,
    sectionId
  });
}

export const PlaceholderContentModel = types
  .model("PlaceholderContent", {
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

registerToolContentInfo({
  id: kPlaceholderToolID,
  tool: "placeholder",
  modelClass: PlaceholderContentModel,
  defaultContent: defaultPlaceholderContent
});
