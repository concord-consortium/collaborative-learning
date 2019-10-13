import { types, Instance } from "mobx-state-tree";
import { Value, ValueJSON } from "slate";
import Plain from "slate-plain-serializer";
import SlateHtmlSerializer from "./slate-deserializer";
import { safeJsonParse } from "../../../utilities/js-utils";

export const kTextToolID = "Text";

export function defaultTextContent(initialText?: string) {
  return TextContentModel.create({ text: initialText || "" });
}

const Html = new SlateHtmlSerializer();

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

const errorJson: ValueJSON = {
        document: {
          nodes: [{
            object: "block",
            type: "paragraph",
            nodes: [{
              object: "text",
              text: "A slate error occurred"
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
          return Html.deserialize(self.joinText);
        case "markdown":
          // handle markdown import here; for now we treat as text
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
