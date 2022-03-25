import { types, Instance, hasParentOfType, getParentOfType, getSnapshot } from "mobx-state-tree";
import { Value, Inline } from "slate";
import Plain from "slate-plain-serializer";
import Markdown from "slate-md-serializer";
import {
  deserializeValueFromLegacy, Editor, htmlToSlate, serializeValueToLegacy, slateToHtml, textToSlate
} from "@concord-consortium/slate-editor";
import { ITileExportOptions } from "../tool-content-info";
import { ToolContentModel } from "../tool-types";
import { ToolTileModel } from "../tool-tile";
import { SharedModelType } from "../shared-model";
import { kVariableSlateType } from "../../../plugins/shared-variables/slate/variables-plugin";
import { DocumentContentModel } from "../../document/document-content";
import { SharedVariables } from "../../../plugins/shared-variables/shared-variables";
import { VariableType } from "@concord-consortium/diagram-view";

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
  .volatile(self => ({
    editor: undefined as Editor | undefined
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
  .views(self => ({
    get toolTile() {
      if (!hasParentOfType(self, ToolTileModel)) {
        // we aren't attached in the right place yet
        return undefined;
      }
      return getParentOfType(self, ToolTileModel);
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
    },
    setEditor(editor: Editor) {
      self.editor = editor;
    }
  }))
  .actions(self => {
    function getSharedModel() {
      const toolTileModel = self.toolTile;
      if (!toolTileModel || !hasParentOfType(toolTileModel, DocumentContentModel)) {
        // we aren't attached in the right place yet
        return;
      }
    
      // see if there is already a sharedModel in the document
      // FIXME: to support tiles in iframes, we won't have direct access to the
      // document like this, so some kind of API will need to be used instead.
      const document = getParentOfType(toolTileModel, DocumentContentModel);
    
      if (!document) {
        // We don't have a document yet
        return;
      }
    
      let sharedModel = document.getFirstSharedModelByType(SharedVariables);
    
      if (!sharedModel) {
        // The document doesn't have a shared model yet
        sharedModel = SharedVariables.create();
        console.log(getSnapshot(sharedModel));
        document.addSharedModel(sharedModel);
      }
    
      // TODO: currently we always just reset the shared model on the tool tile  
      toolTileModel.setSharedModel(sharedModel);
    
      return sharedModel;
    }
    
    function getVariables(): VariableType[] {
      const sharedModel = getSharedModel();
      return sharedModel ? sharedModel.variables : [];
    }

    return {
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
        if (!self.editor) {
          return;
        }

        const variables = getVariables();

        // FIXME: we shouldn't be aware of nodes managed by slate plugins. So when
        // the plugin is registered with the text tile, it should include a method
        // that can be called here to do this
        const document = self.editor.value.document;
        const variableNodes = document.filterDescendants((_node: Node) => {
          return Inline.isInline(_node) && _node.type === kVariableSlateType;
        });
        variableNodes.forEach((element: Inline) => {
          console.log("VariableNode", element.data.get("reference"));
          // Does this variable exist in our list?
          if(!variables.find(v => v.id === element.data.get("reference"))){
            self.editor.removeNodeByKey(element.key);
          }
        });
      }
    };
  });

export type TextContentModelType = Instance<typeof TextContentModel>;
