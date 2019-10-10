import { types, Instance, SnapshotOut } from "mobx-state-tree";

export const kPlaceholderToolID = "Placeholder";

export function defaultPlaceholderContent(sectionId: string = "") {
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
    setSectionId(sectionId: string = "") {
      self.sectionId = sectionId;
    }
  }));

export type PlaceholderContentModelType = Instance<typeof PlaceholderContentModel>;
export type PlaceholderContentSnapshotOutType = SnapshotOut<typeof PlaceholderContentModel>;
