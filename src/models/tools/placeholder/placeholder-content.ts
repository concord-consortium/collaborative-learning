import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { registerToolContentInfo } from "../tool-content-info";
import { ToolContentModel } from "../tool-types";

export const kPlaceholderToolID = "Placeholder";

function defaultPlaceholderContent() {
  return PlaceholderContentModel.create();
}

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

registerToolContentInfo({
  id: kPlaceholderToolID,
  tool: "placeholder",
  modelClass: PlaceholderContentModel,
  defaultContent: defaultPlaceholderContent
});
