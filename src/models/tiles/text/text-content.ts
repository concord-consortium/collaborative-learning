import { ObservableMap } from "mobx";
import { types, Instance, SnapshotIn, cast } from "mobx-state-tree";
import {
  convertDocument, CustomEditor, Editor, EditorValue, htmlToSlate, serializeValue, slateToHtml, textToSlate, slateToText
} from "@concord-consortium/slate-editor";
import { ITileExportOptions } from "../tile-content-info";
import { TileContentModel } from "../tile-content";
import { SharedModelType } from "../../shared/shared-model";
import { getAllTextPluginInfos } from "./text-plugin-info";
import { escapeBackslashes, escapeDoubleQuotes, removeNewlines, removeTabs } from "../../../utilities/string-utils";
import { tileContentAPIViews } from "../tile-model-hooks";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { kHighlightFormat } from "../../../plugins/text/highlights-plugin";
import { IHighlightBox } from "../../../plugins/text/highlight-registry-context";

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
    format: types.maybe(types.string),
    highlightedText: types.optional(types.array(types.model({id: types.identifier, text: types.string})), [])
  })
  .volatile(self => ({
    editor:  undefined as CustomEditor | undefined,
    highlightBoxesCache: new ObservableMap<string, IHighlightBox>(),
  }))
  .views(self => ({
    // guarantees string (not readonly string) types
    get textStr(): string | string[] {
      return Array.isArray(self.text)
              ? self.text as string[]
              : self.text as string;
    }
  }))
  .views(self => ({
    get joinText() {
      return Array.isArray(self.textStr)
        ? self.textStr.join("\n")
        : self.textStr;

    },
    get joinHtml() {
      return Array.isArray(self.textStr)
        ? self.textStr.join("")
        : self.textStr;
    },
    getSlate() {
      if (!self.textStr || Array.isArray(self.textStr)) {
        return textToSlate("");
      }

      let parsed = null;
      try {
        parsed = JSON.parse(self.textStr);
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
      return textToSlate(self.textStr);
    }
  }))
  .views(self => ({
    asSlate(): EditorValue {
      switch (self.format) {
        case "slate":
          return self.getSlate();
        case "html":
          return htmlToSlate(self.joinHtml);
        case "markdown":
          // TODO: figure out what to do about markdown
          return []; // return self.joinText;
          //return MarkdownSerializer.deserialize(self.joinText);
        default:
          return textToSlate(self.joinText);
      }
    },
    asPlainText(): string {
      if (self.format) {
        return slateToText(this.asSlate());
      } else {
        // Undefined format means it's plain text already
        return self.joinText;
      }
    }
  }))
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      const value = self.asSlate();
      const html = value ? slateToHtml(value) : "";
      // We need to escape both double quotes and backslashes, otherwise the curriculum json will break.
      const processLine = (line: string) => escapeDoubleQuotes(escapeBackslashes(removeTabs(removeNewlines(line))));
      const exportHtml = html.split("\n")
        .map((line, i, arr) =>
          `    "${processLine(line)}"${i < arr.length - 1 ? "," : ""}`);
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
      self.text = cast(text);
    },
    setMarkdown(text: string | string[]) {
      self.format = "markdown";
      self.text = cast(text);
    },
    setSlate(value: EditorValue) {
      self.format = "slate";
      const serialized = serializeValue(value);
      self.text = JSON.stringify(serialized);
    },
    setEditor(editor?: Editor) {
     self.editor = editor;
    },
    addHighlight(id: string, text: string) {
      self.highlightedText.push({ id, text });
    },
    removeHighlight(id: string) {
      const index = self.highlightedText.findIndex(ht => ht.id === id);
      if (index >= 0) {
        self.highlightedText.splice(index, 1);
      }
    },
    setHighlightBoxesCache(id: string, box: IHighlightBox) {
      if (box) {
        self.highlightBoxesCache.set(id, box);
      } else {
        self.highlightBoxesCache.delete(id);
      }
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel: SharedModelType | undefined) {
      getAllTextPluginInfos().forEach(pluginInfo => {
        pluginInfo?.updateTextContentAfterSharedModelChanges?.(self, sharedModel);
      });
    }
  }))
  .views(self => tileContentAPIViews({
    get annotatableObjects(): IClueTileObject[] {
      const objects: IClueTileObject[] = [];
      const objectType = kHighlightFormat;
      self.highlightedText.forEach(highlight => {
        objects.push({objectId: highlight.id, objectType});
      });
      return objects;
    },
  }));

export type TextContentModelType = Instance<typeof TextContentModel>;

// TODO: Replace the textContent provider with a tile level one.
export function createTextContent(snapshot?: SnapshotIn<typeof TextContentModel>) {
  return TextContentModel.create({
    ...snapshot
  });
}
