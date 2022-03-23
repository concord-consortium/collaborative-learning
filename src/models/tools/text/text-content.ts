import { types, Instance } from "mobx-state-tree";
import { Value } from "slate";
import Plain from "slate-plain-serializer";
import Markdown from "slate-md-serializer";
import {
  deserializeValueFromLegacy, htmlToSlate, serializeValueToLegacy, slateToHtml, textToSlate
} from "@concord-consortium/slate-editor";
import { ITileExportOptions } from "../tool-content-info";
import { ToolContentModel } from "../tool-types";
import { SharedModelType } from "../shared-model";


export const kTextToolID = "Text";

export function defaultTextContent() {
  return TextContentModel.create();
}

const MarkdownSerializer = new Markdown();

export const TextContentModel = ToolContentModel
  .named("TextTool")
  .props({
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
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      const value = self.asSlate();
      const html = value ? slateToHtml(value) : "";
      const exportHtml = html.split("\n").map((line, i, arr) => `    "${line}"${i < arr.length - 1 ? "," : ""}`);
      return [
        `{`,
        `  "type": "Text",`,
        `  "format": "html",`,
        `  "text": [`,
        ...exportHtml,
        `  ]`,
        `}`
      ].join("\n");
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
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      // Need to look for any references to items in shared models in the text
      // content, if they don't exist in the shared model any more then clean
      // them up in some way. 
      // 
      // Perhaps for just delete them. 
      //
      // Because it is up to the plugins to manage this, we'll have to find a
      // way to channel this action through all of the plugins.
      //
      // After cleaning up an invalid references, then it should decide if it
      // wants to change the text content if there is a new shared model item
      // that didn't exist before.
    }
  }));

export type TextContentModelType = Instance<typeof TextContentModel>;
