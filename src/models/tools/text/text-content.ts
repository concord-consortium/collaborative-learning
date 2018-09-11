import { types, Instance } from "mobx-state-tree";

export const kTextToolID = "Text";

export const StringOrArray = types.union(types.string, types.array(types.string));

export const TextContentModel = types
  .model("TextTool", {
    type: types.literal(kTextToolID),
    text: types.optional(StringOrArray, ""),
    // e.g. "markdown", "slate", "quill", empty => plain text
    format: types.maybe(types.string)
  });

export type TextContentModelType = Instance<typeof TextContentModel>;
