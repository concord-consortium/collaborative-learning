import { types, Instance } from "mobx-state-tree";
import { Value } from "slate";
import Plain from "slate-plain-serializer";
import Markdown from "slate-md-serializer";
import { registerToolContentInfo } from "../tool-content-info";
import {
  deserializeValueFromLegacy, htmlToSlate, serializeValueToLegacy, textToSlate
} from "@concord-consortium/slate-editor";

export const kTextToolID = "Text";

export function defaultTextContent(initialText?: string) {
  return TextContentModel.create({ text: initialText || "" });
}

const MarkdownSerializer = new Markdown();

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
      return !self.text || Array.isArray(self.text)
              ? textToSlate("")
              : deserializeValueFromLegacy(self.text);
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
      self.text = serializeValueToLegacy(value);
    }
  }));

export type TextContentModelType = Instance<typeof TextContentModel>;

registerToolContentInfo({
  id: kTextToolID,
  tool: "text",
  modelClass: TextContentModel,
  defaultContent: defaultTextContent
});
