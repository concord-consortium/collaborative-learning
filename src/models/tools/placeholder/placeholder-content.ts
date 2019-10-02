import { types, Instance, SnapshotOut } from "mobx-state-tree";

export const kPlaceholderToolID = "Placeholder";

export const PlaceholderContentModel = types
  .model("PlaceholderContent", {
    type: types.optional(types.literal(kPlaceholderToolID), kPlaceholderToolID),
    prompt: types.string
  });

export type PlaceholderContentModelType = Instance<typeof PlaceholderContentModel>;
export type PlaceholderContentSnapshotOutType = SnapshotOut<typeof PlaceholderContentModel>;
