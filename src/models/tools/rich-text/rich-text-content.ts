import { types, Instance } from "mobx-state-tree";

export const kRichTextToolID = "RichText";

export const RichTextContentModel = types
  .model("RichTextContent", {
    type: types.literal(kRichTextToolID),
    // tool-specific content
  });

export type RichTextContentModelType = Instance<typeof RichTextContentModel>;
