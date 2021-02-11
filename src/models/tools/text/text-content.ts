import { types, Instance } from "mobx-state-tree";
import { Value, ValueJSON } from "slate";
import Plain from "slate-plain-serializer";
import Markdown from "slate-md-serializer";
import { registerToolContentInfo } from "../tool-content-info";
import { safeJsonParse } from "../../../utilities/js-utils";
import { htmlToSlate } from "@concord-consortium/slate-editor";

export const kTextToolID = "Text";

export function defaultTextContent(initialText?: string) {
  return TextContentModel.create({ text: initialText || "" });
}

const MarkdownSerializer = new Markdown();

export const emptyJson: ValueJSON = {
              document: {
                nodes: [{
                  object: "block",
                  type: "paragraph",
                  nodes: [{
                    object: "text",
                    text: ""
                  }]
                }]
              }
            };

export const TextContentModel = types
  .model("TextTool", {
    type: types.optional(types.literal(kTextToolID), kTextToolID),
    text: types.optional(types.union(types.string, types.array(types.string)), ""),
    // e.g. "html", "markdown", "slate", "quill", empty => plain text
    format: types.maybe(types.string)
  })
  .views(self => ({
    get joinText() {
      return Array.isArray(self.text)
              ? self.text.join("\n")
              : self.text as string;

    },
    getSlate() {
      const parsed = Array.isArray(self.text)
                      ? emptyJson
                      : safeJsonParse(self.text as string) || emptyJson;
      return Value.fromJSON(parsed);
    }
  }))
  .views(self => ({
    asSlate(): Value {
      switch (self.format) {
        case "slate":
          return self.getSlate();
        case "html":
          return htmlToSlate(self.joinText);
        case "markdown":
          return MarkdownSerializer.deserialize(self.joinText);
        default:
          return Plain.deserialize(self.joinText);
      }
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.format = undefined;
      self.text = text;
    },
    setHtml(text: string | string[]) {
      self.format = "html";
      self.text = text;
    },
    setMarkdown(text: string | string[]) {
      self.format = "markdown";
      self.text = text;
    },
    setSlate(value: Value) {
      self.format = "slate";
      self.text = JSON.stringify(value.toJSON());
    }
  }));

export type TextContentModelType = Instance<typeof TextContentModel>;

registerToolContentInfo({
  id: kTextToolID,
  tool: "text",
  modelClass: TextContentModel,
  defaultContent: defaultTextContent
});
