import { types, Instance, getType } from "mobx-state-tree";
import { Value, Inline } from "slate";
import Plain from "slate-plain-serializer";
import Markdown from "slate-md-serializer";
import {
  deserializeValueFromLegacy, Editor, htmlToSlate, serializeValueToLegacy, slateToHtml, textToSlate
} from "@concord-consortium/slate-editor";
import { ITileExportOptions } from "../tool-content-info";
import { ToolContentModel } from "../tool-types";
import { SharedModelType } from "../shared-model";
import { kVariableSlateType } from "../../../plugins/shared-variables/slate/variables-plugin";
import { SharedVariables, SharedVariablesType } from "../../../plugins/shared-variables/shared-variables";
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
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
      // just like findFirstSharedModelByType does
      //
      // For now we are checking the type ourselves, and we are assuming the shared model we want
      // is the first one.
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== SharedVariables) {
        return undefined;
      }
      return firstSharedModel as SharedVariablesType;
    },
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
  .actions(self => ({
    // FIXME: we shouldn't be aware of shared model managed by a slate plugin.
    // This is an action because it can modify the state if there isn't a shared
    // model already associated with this tile
    getOrFindSharedModel() {
      let sharedModel = self.sharedModel; 
    
      if (!sharedModel) {
        // The document doesn't have a shared model yet, or the manager might
        // not be ready yet
        const sharedModelManager = self.tileEnv?.sharedModelManager;
        if (!sharedModelManager || !sharedModelManager.isReady) {
          // In this case we can't do anything. 
          // Print a warning because it should be unusual
          console.warn("shared model manager isn't available");
          return;
        }

        const containerSharedModel = sharedModelManager.findFirstSharedModelByType(SharedVariables);
        if (!containerSharedModel) {
          console.warn("no shared variables model in the document");
          // In the future we might want to create a new shared variables shared
          // model in this case.  If we do that, we have to be careful that we don't
          // cause an infinite loop. This getOrFindSharedModel is called from the 
          // updateAfterSharedModelChanges so it might be called immediately after 
          // this new shared model is added to the document.
          //
          // FIXME: It would be best if the searching for the shared variables model was 
          // separated from this getOrFindSharedModel. That way getVariables could
          // just be a view that doesn't modify any state. That could be handled by
          // a reaction or autorun like with diagram-content.ts does. However it
          // seems better try to fix that when move all of this code out of text-content
          // and into the shared-variables text plugin.
          return;
        }

        sharedModelManager.addTileSharedModel(self, containerSharedModel);
        sharedModel = containerSharedModel;
      }
    
      return sharedModel;
    }
  }))
  .actions(self => {
    function getVariables(): VariableType[] {
      const sharedModel = self.getOrFindSharedModel();
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
          // Does this variable exist in our list?
          if(!variables.find(v => v.id === element.data.get("reference"))){
            self.editor.removeNodeByKey(element.key);
          }
        });
      }
    };
  });

export type TextContentModelType = Instance<typeof TextContentModel>;
