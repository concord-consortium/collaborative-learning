import { types, Instance } from "mobx-state-tree";
import {
  htmlToSlate, slateToHtml, textToSlate, EditorValue, slateToText
} from "@concord-consortium/slate-editor";
import { ITileExportOptions } from "../tile-content-info";
import { TileContentModel } from "../tile-types";
import { SharedModelType } from "../../shared/shared-model";
import { getAllTextPluginInfos } from "./text-plugin-info";

export const kTextTileType = "Text";

export function defaultTextContent() {
  return TextContentModel.create();
}

export const TextContentModel = TileContentModel
  .named("TextContent")
  .props({
    type: types.optional(types.literal(kTextTileType), kTextTileType),
    text: types.optional(types.union(types.string, types.array(types.string)), ""),
    // e.g. "html", "markdown", "slate", "quill", empty => plain text
    format: types.maybe(types.string)
  })
  .volatile(self => ({
    editor: undefined
  }))
  .views(self => ({
    get joinText() {
      return Array.isArray(self.text)
              ? self.text.join("\n")
              : self.text as string;

    },
    getSlate() {
      return !self.text || Array.isArray(self.text)
              ? textToSlate("")
              : self.text; // THIS IS WRONG
    }
  }))
  .views(self => ({
    asSlate(): any {
      switch (self.format) {
        case "slate":
          return self.getSlate();
        case "html":
          return htmlToSlate(self.joinText);
        case "markdown":
          return self.joinText;
          //return MarkdownSerializer.deserialize(self.joinText);
        default:
          return textToSlate(self.joinText);
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
    setSlate(value: EditorValue) {
      self.format = "slate";
      self.text = slateToText(value);  // FIXME: This is probably wrong
    },
    setEditor(editor?: any) { // FIXME: type here is wrong
      console.log('calling set editor....');
;      self.editor = editor;
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      getAllTextPluginInfos().forEach(pluginInfo => {
        pluginInfo?.updateTextContentAfterSharedModelChanges?.(self, sharedModel);
      });
    }
  }));

export type TextContentModelType = Instance<typeof TextContentModel>;
