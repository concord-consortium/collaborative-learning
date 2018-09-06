import { types } from "mobx-state-tree";

export const kUnknownToolID = "Unknown";

export const UnknownToolContent = types
  .model("UnknownToolContent", {
    originalType: types.string,
    originalContent: types.maybe(types.string)
  });

export const UnknownToolModel = types
  .model("UnknownTool", {
    type: types.literal(kUnknownToolID),
    content: UnknownToolContent
  })
  .preProcessSnapshot((snapshot: any) => {
    // if we're already Unknown, just return the snapshot
    if (snapshot.type === kUnknownToolID) {
      return snapshot;
    }
    // capture the original tool content
    return {
      type: kUnknownToolID,
      content: {
        originalType: snapshot.type,
        // JSONify the original content
        originalContent: snapshot.content != null
                          ? typeof snapshot.content === "string"
                              ? snapshot.content
                              : JSON.stringify(snapshot.content)
                          : undefined
      }
    };
  });

export type UnknownToolModelType = typeof UnknownToolModel.Type;
