import { types, Instance } from "mobx-state-tree";

export const kUnknownToolID = "Unknown";

export const UnknownContentModel = types
  .model("UnknownTool", {
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
