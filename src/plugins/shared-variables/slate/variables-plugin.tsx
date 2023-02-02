import React, { useContext } from "react";
import classNames from "classnames/dedupe";

import {
  Editor,
  RenderElementProps,
  useSerializing,
  useSelected,
  Transforms,
  CustomEditor,
  BaseElement,
  CustomElement,
  registerElementComponent,
} from "@concord-consortium/slate-editor";
import { getType } from "mobx-state-tree";
import { VariableChip, VariableType } from "@concord-consortium/diagram-view";
import { variableBuckets } from "../shared-variables-utils";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { TextContentModelContext } from "../../../components/tiles/text/text-content-context";
import { IButtonDefProps } from "../../../models/tiles/text/text-plugin-info";
import { useNewVariableDialog } from "../dialog/use-new-variable-dialog";
import { TextToolbarButton } from "../../../components/tiles/text/text-toolbar-button";
import { TextPluginsContext } from "../../../components/tiles/text/text-plugins-context";

import AddVariableChipIcon from "../assets/add-variable-chip-icon.svg";
import InsertVariableChipIcon from "../assets/insert-variable-chip-icon.svg";
import VariableEditorIcon from "../assets/variable-editor-icon.svg";
import { useInsertVariableDialog } from "../dialog/use-insert-variable-dialog";
import { useEditVariableDialog } from "../dialog/use-edit-variable-dialog";
import { observer } from "mobx-react";
import { action, autorun, computed, makeObservable, observable } from "mobx";
import { DEBUG_SHARED_MODELS } from "../../../lib/debug";
import { SharedVariables, SharedVariablesType } from "../shared-variables";

const kVariableClass = "slate-variable-chip";
const kSlateVoidClass = "cc-slate-void";
export const kVariableFormat = "m2s-variable";

export class VariablesPlugin {
  public textContent;

  constructor(textContent: TextContentModelType) {
    makeObservable(this, {
      textContent: observable,
      sharedModel: computed,
      variables: computed,
      onInitEditor: action
    });
    this.textContent = textContent;
  }

  get sharedModel() {
    const sharedModelManager = this.textContent.tileEnv?.sharedModelManager;
    // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
    // just like findFirstSharedModelByType does
    //
    // For now we are checking the type ourselves, and we are assuming the shared model we want
    // is the first one.
    // TODO: can this handle the case when the sharedModelManager is not ready yet?
    const firstSharedModel = sharedModelManager?.getTileSharedModels(this.textContent)?.[0];
    if (!firstSharedModel || getType(firstSharedModel) !== SharedVariables) {
      return undefined;
    }
    return firstSharedModel as SharedVariablesType;
  }

  get variables() {
    return this.sharedModel ? this.sharedModel.variables : [];
  }

  /**
   * Add the shared model to the text tile when it is ready.
   */
  addTileSharedModelWhenReady() {
    // TODO: add a disposer
    autorun(() => {
      // Make sure there is a sharedModelManage and it is ready
      // TODO this is duplicate code from `get sharedModel`
      const sharedModelManager = this.textContent.tileEnv?.sharedModelManager;
      if (!sharedModelManager || !sharedModelManager.isReady) {
        // So we need to keep waiting until the sharedModelManager is ready
        if (DEBUG_SHARED_MODELS) {
          console.log("shared model manager isn't available");
        }
        return;
      }

      if (this.sharedModel) {
        // We already have a shared model so we don't need to do anything
        return;
      }

      // We don't have a shared model, see if the there a SharedVariables model
      const containerSharedModel = sharedModelManager.findFirstSharedModelByType(SharedVariables);
      if (!containerSharedModel) {
        if (DEBUG_SHARED_MODELS) {
          console.log("no shared variables model in the document");
        }

        // If we want to automatically create a shared model this would be the
        // place to put it.
        return;
      }

      // We found a SharedVariables model, and we don't have one on the textContent yet
      // So add it
      sharedModelManager.addTileSharedModel(this.textContent, containerSharedModel);
    });
  }

  onInitEditor(editor: CustomEditor) {
    return withVariables(editor, this.textContent);
  }

  get chipVariables() {
    const {editor} = this.textContent;
    const variableIds: string[] = [];
    if (editor) {
      for (const [node] of Editor.nodes(editor, {at: [], mode: 'all'})) {
        if (Editor.isInline(editor, node) && isVariableElement(node)) {
          variableIds.push(node.reference);
        }
      }
    }
    const variables = variableIds.map(id => this.findVariable(id));
    const filteredVariables = variables.filter(variable => variable !== undefined);
    return filteredVariables as VariableType[];
  }

  findVariable(variableId: string) {
    return this.variables.find(v => v.id === variableId);
  }

}

export interface VariableElement extends BaseElement {
  type: typeof kVariableFormat;
  reference: string;
}

export const isVariableElement = (element: CustomElement): element is VariableElement => {
  return element.type === kVariableFormat;
};

export const findSelectedVariable = (selectedElements: any, variables: VariableType[]) => {
  let selected = undefined;
    // FIXME: The editor.selectedElements claims that it returns a BaseElement[] but it really returns a NodeEntry
    // which is a list of pairs. [Node, Path]
    // https://docs.slatejs.org/api/nodes/node-entry
    // There's some weirdness below to work around that, but
    // we should either update the return type our slate lib or just return the BaseElement list.
  selectedElements?.forEach((selectedItem: any) => {
    const baseElement = (selectedItem as any)[0];
    if (isVariableElement(baseElement)) {
      const {reference} = baseElement;
      selected = variables.find(v => v.id === reference);
    }
  });
  return selected;
};

export const insertTextVariable = (variable: VariableType, editor?: Editor) => {
  if (!editor) {
    console.warn("inserting variable but there is no editor");
    return;
  }
  const reference = variable.id;
  const varElt: VariableElement = { type: kVariableFormat, reference, children: [{text: "" }]};
  Transforms.insertNodes(editor, varElt);
};

export const insertTextVariables = (variables: VariableType[], editor?: Editor) => {
  if (!editor) {
    console.warn("inserting variable but there is no editor");
    return;
  }
  variables.forEach((variable) =>{
    insertTextVariable(variable, editor);
 });
};

export const VariableComponent = observer(function({ attributes, children, element }: RenderElementProps) {
  const plugins = useContext(TextPluginsContext);
  // FIXME: need a const for the plugin name
  // FIXME: need error handling of the plugin doesn't exist for some reason
  const variablesPlugin = plugins.Variables as VariablesPlugin;
  const isHighlighted = useSelected();
  const isSerializing = useSerializing();

  if (!isVariableElement(element)) return null;

  const {reference} = element;

  const classes = classNames(kSlateVoidClass, kVariableClass);
  const selectedClass = isHighlighted && !isSerializing ? "slate-selected" : undefined;
  const variables = variablesPlugin.variables;
  const variable = variables.find(v => v.id === reference);
  // FIXME: HTML serialization/deserialization. This will serialize the VariableChip too.
  return (
    <span className={classes} {...attributes} contentEditable={false}>
      {children}
      { variable ?
        <VariableChip variable={variable} className={selectedClass} /> :
        `invalid reference: ${reference}`
      }
    </span>
  );
});

let isRegistered = false;

export function registerVariables() {
  if (isRegistered) return;

  registerElementComponent(kVariableFormat, props => <VariableComponent {...props}/>);

  // TODO: register deserializer

  isRegistered = true;
}

export function withVariables(editor: Editor, textContent: TextContentModelType) {
  registerVariables();

  const { isInline, isVoid } = editor;
  editor.isInline = element => (element.type === kVariableFormat) || isInline(element);
  editor.isVoid = element => (element.type === kVariableFormat) || isVoid(element);

  return editor;
}

//   {
//     iconName: "new-variable",
//     Icon: AddVariableChipIcon,
//     toolTip: "New Variable",
//     buttonEnabled: () => true,
//     command(editor) {
//       // do something like useNewVariableDialog
//     },
//   },
export const NewVariableTextButton = observer(function NewVariableTextButton(
    {editor, pluginInstance}: IButtonDefProps) {

  // TODO: perhaps the pluginInstance is undefined?
  const variablesPlugin = pluginInstance as VariablesPlugin;

  const isSelected = false;

  const sharedModel = variablesPlugin.sharedModel;

  const enabled = !!sharedModel;

  const highlightedText = (editor && editor.selection) ? Editor.string(editor, editor.selection) : "";
  const namePrefill = highlightedText;
  const [showDialog] = useNewVariableDialog({
    addVariable(variable) {
      insertTextVariable(variable, editor);
    },
    sharedModel, namePrefill});
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showDialog();
  };
  return (
    <TextToolbarButton iconName="new-variable" Icon={AddVariableChipIcon}
      tooltip={"New Variable"}  enabled={enabled} isSelected={isSelected}
      onClick={handleClick} />
  );
});

//   {
//     iconName: "insert-variable",
//     Icon: InsertVariableChipIcon,
//     toolTip: "Insert Variable",
//     buttonEnabled: () => true,
//     command(editor) {
//       // do something like useInsertVariableDialog
//     },
//   },
export const InsertVariableTextButton = observer(function InsertVariableTextButton(
     {editor, pluginInstance}: IButtonDefProps) {
  // TODO: perhaps the pluginInstance is undefined?
  const variablesPlugin = pluginInstance as VariablesPlugin;


  const isSelected = false;
  const textContent = useContext(TextContentModelContext);
  const sharedModel = variablesPlugin.sharedModel;
  const enabled = !!sharedModel;

  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(textContent, sharedModel);

  const [showDialog] = useInsertVariableDialog({
    Icon: InsertVariableChipIcon,
    insertVariables(variables){
      insertTextVariables(variables, editor);
    },
    otherVariables, selfVariables, unusedVariables });
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showDialog();
  };
  return (
    <TextToolbarButton iconName="insert-variable" Icon={InsertVariableChipIcon}
      tooltip={"Insert Variable"}  enabled={enabled} isSelected={isSelected}
      onClick={handleClick} />
  );
});

//   {
//     iconName: "edit-variable",
//     Icon: VariableEditorIcon,
//     toolTip: "Edit Variable",
//     buttonEnabled: shouldShowEditVariableButton,
//     command(editor) {
//       // do something like useEditVariableDialog
//     },
//   }
export const EditVariableTextButton = observer(function EditVariableTextButton(
    {editor, pluginInstance}: IButtonDefProps) {
  // TODO: perhaps the pluginInstance is undefined?
  const variablesPlugin = pluginInstance as VariablesPlugin;

  const isSelected = false;

  const selectedElements = editor?.selectedElements();
  const variables = variablesPlugin.variables;
  const hasVariable = editor?.isElementActive(kVariableFormat);
  const selectedVariable = hasVariable ? findSelectedVariable(selectedElements, variables) : undefined;
  const enabled = !!selectedVariable;

  const [showDialog] = useEditVariableDialog({variable: selectedVariable});
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showDialog();
  };

  return (
    <TextToolbarButton iconName="edit-variable" Icon={VariableEditorIcon}
      tooltip={"Edit Variable"} enabled={enabled} isSelected={isSelected}
      onClick={handleClick} />
  );
});
