import React, { useContext } from "react";
import { VariableType } from "@concord-consortium/diagram-view";
import { Editor, ReactEditor, Transforms, useSlate } from "@concord-consortium/slate-editor";
import { observer } from "mobx-react";
import { IButtonDefProps, ITextPlugin } from "../../../models/tiles/text/text-plugin-info";
import { TextToolbarButton } from "../../../components/tiles/text/text-toolbar-button";
import { TextContentModelContext } from "../../../components/tiles/text/text-content-context";
import { useNewVariableDialog } from "../dialog/use-new-variable-dialog";
import { variableBuckets } from "../shared-variables-utils";
import { useInsertVariableDialog } from "../dialog/use-insert-variable-dialog";
import { useEditVariableDialog } from "../dialog/use-edit-variable-dialog";
import { isVariableElement, kVariableFormat, VariableElement, VariablesPlugin } from "./variables-plugin";

import AddVariableChipIcon from "../assets/add-variable-chip-icon.svg";
import InsertVariableChipIcon from "../assets/insert-variable-chip-icon.svg";
import VariableEditorIcon from "../assets/variable-editor-icon.svg";

export const kNewVariableButtonName = "new-variable";
export const kInsertVariableButtonName = "insert-variable";
export const kEditVariableButtonName = "edit-variable";

export function insertTextVariable(variable: VariableType, editor?: Editor) {
  if (!editor) {
    console.warn("inserting variable but there is no editor");
    return;
  }

  // If any text is selected, move the insertion point to immediately after the selection.
  const selectionLength = editor.selection ? Editor.string(editor, editor.selection).length : 0;
  Transforms.move(editor, { distance: selectionLength, unit: "character", edge: "start" });

  const newNodes = [];

  // If the insertion point is preceded by a character that's not a space, add a space.
  const range = editor.selection || [0,0];
  const beforeInsertPoint = Editor.before(editor, range, { unit: "character" });
  const charBefore = editor.selection && beforeInsertPoint &&
                       Editor.string(editor, {anchor: editor.selection.anchor, focus: beforeInsertPoint });
  if (charBefore && charBefore !== " ") {
    newNodes.push({text: " "});
  }

  // Add the variable chip.
  const reference = variable.id;
  const varElt: VariableElement = { type: kVariableFormat, reference, children: [{text: "" }]};
  newNodes.push(varElt);

  // If insertion point is followed by a character that's not a space or punctuation, add a space.
  const afterInsertPoint = Editor.after(editor, range, { unit: "character" });
  const charAfter = editor.selection && afterInsertPoint &&
                      Editor.string(editor, {anchor: editor.selection.anchor, focus: afterInsertPoint });
  if (charAfter && !(/^[.,;:!? ]/.test(charAfter))) {
    newNodes.push({text: " "});
  }

  Transforms.insertNodes(editor, newNodes);
}

export function insertTextVariables(variables: VariableType[], editor?: Editor) {
  if (!editor) {
    console.warn("inserting variable but there is no editor");
    return;
  }
  variables.forEach((variable) =>{
    insertTextVariable(variable, editor);
 });
}

export function findSelectedVariable(selectedElements: any, variables: VariableType[]) {
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
}

function castToVariablesPlugin(plugin?: ITextPlugin): VariablesPlugin|undefined {
  if (!plugin) {
    console.warn("undefined plugin in toolbar button");
    return;
  }

  if (plugin instanceof VariablesPlugin) {
    return plugin;
  }

  console.warn("plugin is not a VariablesPlugin in toolbar button");
}

function handleClose(editor: Editor) {
  // focus the editor after closing the dialog, which is what the user expects and
  // also required for certain slate selection synchronization mechanisms to work.
  // focusing twice shouldn't be necessary, but sometimes seems to help ¯\_(ツ)_/¯
  ReactEditor.focus(editor);
  setTimeout(() => {
    ReactEditor.focus(editor);
  }, 10);
}

export const NewVariableTextButton = observer(function NewVariableTextButton(
    {pluginInstance}: IButtonDefProps) {

  const editor = useSlate();
  const variablesPlugin = castToVariablesPlugin(pluginInstance);

  const isSelected = false;
  const sharedModel = variablesPlugin?.sharedModel;
  const enabled = !!sharedModel;

  const highlightedText = (editor && editor.selection) ? Editor.string(editor, editor.selection) : "";
  const descriptionPrefill = highlightedText;
  const [showDialog] = useNewVariableDialog({
    addVariable(variable) {
      insertTextVariable(variable, editor);
    },
    sharedModel, descriptionPrefill,
    noUndo: true,
    onClose: () => handleClose(editor)
  });
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showDialog();
  };
  return (
    <TextToolbarButton iconName={kNewVariableButtonName} Icon={AddVariableChipIcon}
      tooltip={"New Variable"}  enabled={enabled} isSelected={isSelected}
      onClick={handleClick} />
  );
});

export const InsertVariableTextButton = observer(function InsertVariableTextButton(
    {pluginInstance}: IButtonDefProps) {
  const editor = useSlate();
  const variablesPlugin = castToVariablesPlugin(pluginInstance);

  const isSelected = false;
  const textContent = useContext(TextContentModelContext);
  const sharedModel = variablesPlugin?.sharedModel;
  const enabled = !!sharedModel;

  const { selfVariables, otherVariables, unusedVariables } = variableBuckets(textContent, sharedModel);

  const [showDialog] = useInsertVariableDialog({
    Icon: InsertVariableChipIcon,
    insertVariables(variables){
      insertTextVariables(variables, editor);
    },
    otherVariables, selfVariables, unusedVariables,
    onClose: () => handleClose(editor)
   });
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showDialog();
  };
  return (
    <TextToolbarButton iconName={kInsertVariableButtonName} Icon={InsertVariableChipIcon}
      tooltip={"Insert Variable"} enabled={enabled} isSelected={isSelected}
      onClick={handleClick} />
  );
});

export const EditVariableTextButton = observer(function EditVariableTextButton(
    {pluginInstance}: IButtonDefProps) {
    const editor = useSlate();
    const variablesPlugin = castToVariablesPlugin(pluginInstance);

  const isSelected = false;
  const selectedElements = editor?.selectedElements();
  const variables = variablesPlugin?.variables || [];
  const hasVariable = editor?.isElementActive(kVariableFormat);
  const selectedVariable = hasVariable ? findSelectedVariable(selectedElements, variables) : undefined;
  const enabled = !!selectedVariable;

  const [showDialog] = useEditVariableDialog({
    variable: selectedVariable,
    onClose: () => handleClose(editor)
  });
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showDialog();
  };

  return (
    <TextToolbarButton iconName={kEditVariableButtonName} Icon={VariableEditorIcon}
      tooltip={"Edit Variable"} enabled={enabled} isSelected={isSelected}
      onClick={handleClick} />
  );
});
