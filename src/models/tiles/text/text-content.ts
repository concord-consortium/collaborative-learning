import { types, Instance, SnapshotIn } from "mobx-state-tree";
import {
  htmlToSlate, slateToHtml, textToSlate, EditorValue, serializeValue, convertDocument, Editor
} from "@concord-consortium/slate-editor";
import { ITileExportOptions } from "../tile-content-info";
import { TileContentModel } from "../tile-content";
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
    editor:  undefined as Editor | undefined,
  }))
  .views(self => ({
    get joinText() {
      return Array.isArray(self.text)
              ? self.text.join("")
              : self.text as string;

    },
    getSlate() {
      if (!self.text || Array.isArray(self.text)) {
        return textToSlate("");
      }

      let parsed = null;
      try {
        parsed = JSON.parse(self.text);
        // If this is old style json
        if (parsed.document?.nodes) {
          const convertedDoc = convertDocument(parsed.document);
          return convertedDoc.children;
        }
        // If this is new style

        return parsed.document.children;
      } catch (e) {
        console.warn('json did not parse');
      }
      return textToSlate(self.text);
    }
  }))
  .views(self => ({
    asSlate(): EditorValue {
      switch (self.format) {
        case "slate":
          return self.getSlate();
        case "html":
          return htmlToSlate(self.joinText);
        case "markdown":
          // TODO: figure out what to do about markdown
          return []; // return self.joinText;
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
      const serialized = serializeValue(value);
      self.text = JSON.stringify(serialized);
    },
    setEditor(editor?: Editor) {
     self.editor = editor;
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

// FIXME: Replace the textContent provider with a tile level one.
export function createTextContent(snapshot?: SnapshotIn<typeof TextContentModel>) {
  return TextContentModel.create({
    ...snapshot
  });
}
