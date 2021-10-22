import { types, Instance } from "mobx-state-tree";
import { registerToolContentInfo } from "./tool-content-info";
import { ToolContentModel } from "./tool-types";

export const kUnknownToolID = "Unknown";

export function defaultContent(): UnknownContentModelType {
  return UnknownContentModel.create();
}

export const UnknownContentModel = ToolContentModel
  .named("UnknownTool")
  .props({
    type: types.optional(types.literal(kUnknownToolID), kUnknownToolID),
    original: types.maybe(types.string)
  })
  .preProcessSnapshot(snapshot => {
    const type = snapshot && snapshot.type;
    return type && (type !== kUnknownToolID)
            ? {
              type: kUnknownToolID,
              original: JSON.stringify(snapshot)
            }
            : snapshot;
  });

export type UnknownContentModelType = Instance<typeof UnknownContentModel>;

registerToolContentInfo({
  id: kUnknownToolID,
  tool: "unknown",
  modelClass: UnknownContentModel,
  defaultContent
});
