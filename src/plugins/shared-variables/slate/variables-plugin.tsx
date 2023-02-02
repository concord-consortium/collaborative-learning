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
import _ from "lodash";
import { useInsertVariableDialog } from "../dialog/use-insert-variable-dialog";
import { useEditVariableDialog } from "../dialog/use-edit-variable-dialog";
import { observer } from "mobx-react";
import { autorun, computed, makeObservable, observable } from "mobx";
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
      variables: computed
    });
    this.textContent = textContent;
    this.addTileSharedModelIfNecessary();
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
  private addTileSharedModelIfNecessary() {
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
}

export interface VariableElement extends BaseElement {
  type: typeof kVariableFormat;
  reference: string;
}

export const isVariableElement = (element: CustomElement): element is VariableElement => {
  return element.type === kVariableFormat;
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
  // TODO: this will return an empty array if the sharedModelManager is not ready yet
  // because this component is not observing it might not be updated when the
  // sharedModelManager is ready.
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

  // TODO: this will return undefined when the sharedModelManager is not available and when
  // there is no shared variables model in the document.
  // Because this can change (the sharedModelManager can become available and the user could
  // add a diagram view tile), this component should be an observing component.
  // Currently the DEBUG_SHARED_MODELS flag will cause these cases to print a warning.
  // We might want to find a way to capture the reason for no shared model and provide it as
  // a roll over message explaining why the button is disabled.
  //
  // FIXME: this causes a React error sometimes. The DiagramToolComponent is observing the shared
  // model manager state, so when when this updates it by adding the shared variables model to the
  // text tile, it triggers an update of the DiagramToolComponent. This is update is triggered via
  // a setState call by mobx-react.
  // I guess the result is that we should never call things that modify state from within the render
  // We can put this in a useEffect, but then we'd have to store the sharedModel in our react state.
  // Instead of this getOrFindSharedModel just looked for an existing shared model
  // and we are an observing component. The getOrFindSharedModel could do the useEffect itself.
  // So then we should change it to a hook like `useSharedModel(textContent)`;
  // But this seems like mixing frameworks. Since we are using observers it'd be better to use
  // some kind of MobX object to manage this.
  // So then the issue is where store this MobX object. It would be specific to these 3 toolbar buttons
  // it could possibly be a plugin instance that the text tile automatically passes to them, like
  // it passes the editor.
  const sharedModel = variablesPlugin.sharedModel;

  // FIXME: even though this is an observing component when the text tile is added without
  // a diagram, and then the diagram is added the button doesn't become enabled automatically
  const enabled = !!sharedModel;

  // addVariable: (variable: VariableType ) => void;
  // sharedModel: SharedVariablesType;
  // namePrefill? : string
  const addVariable = _.bind(insertTextVariable, null, _, editor);
  const highlightedText = (editor && editor.selection) ? Editor.string(editor, editor.selection) : "";
  const namePrefill = highlightedText;
  const [showDialog] = useNewVariableDialog({addVariable, sharedModel, namePrefill});
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
  const insertVariables = _.bind(insertTextVariables, null, _, editor);
  const textContent = useContext(TextContentModelContext);
  const sharedModel = variablesPlugin.sharedModel;
  const enabled = !!sharedModel;

  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(textContent, sharedModel);

  const [showDialog] = useInsertVariableDialog({
    Icon: InsertVariableChipIcon,
    insertVariables, otherVariables, selfVariables, unusedVariables });
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
