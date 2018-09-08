import { types, Instance } from "mobx-state-tree";

export const kUnknownToolID = "Unknown";

export const UnknownContentModel = types
  .model("UnknownTool", {
    type: types.literal(kUnknownToolID),
    originalType: types.string,
    originalContent: types.maybe(types.string)
  })
  .preProcessSnapshot(snapshot => {
    const { type, ...others }: { type: string } = snapshot || {};
    return type && (type !== kUnknownToolID)
            ? {
              type: kUnknownToolID,
              originalType: type,
              originalContent: others && JSON.stringify(others)
            }
            : snapshot;
  });

export type UnknownContentModelType = Instance<typeof UnknownContentModel>;
