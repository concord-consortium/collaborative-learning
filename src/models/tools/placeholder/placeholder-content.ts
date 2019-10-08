import { types, Instance, SnapshotOut } from "mobx-state-tree";

export const kPlaceholderToolID = "Placeholder";

export function defaultPlaceholderContent() {
  return PlaceholderContentModel.create({
    type: kPlaceholderToolID,
    prompt: "Create or drag tiles here"
  });
}

export const PlaceholderContentModel = types
  .model("PlaceholderContent", {
    type: types.optional(types.literal(kPlaceholderToolID), kPlaceholderToolID),
    prompt: ""
  })
  .actions(self => ({
    setPrompt(prompt: string) {
      self.prompt = prompt;
    }
  }));

export type PlaceholderContentModelType = Instance<typeof PlaceholderContentModel>;
export type PlaceholderContentSnapshotOutType = SnapshotOut<typeof PlaceholderContentModel>;
