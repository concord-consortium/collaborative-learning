import React, { useContext } from "react";
import classNames from "classnames/dedupe";
import {
  Editor,
  IDialogController, IRow,
  RenderElementProps,
  useSerializing,
  CustomElement,
  useSelected,
  ReactEditor,
  Transforms,
  registerElement,
  useSlateStatic,
  CustomEditor,
  BaseElement,
  EditorValue,
} from "@concord-consortium/slate-editor";
import { Variable, VariableChip, VariableType } from "@concord-consortium/diagram-view";
import { getVariables, getOrFindSharedModel } from "./variables-text-content";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { TextContentModelContext } from "../../../models/tiles/text/text-content-context";

const kVariableClass = "slate-variable-chip";
const kSlateVoidClass = "cc-slate-void";
const kVariableFormat = "clueVariable";

// FIXME: Clean up these types and this interface.
export function VariablePlugin(textContent: TextContentModelType): any {
  return {
    onInitEditor: (editor: CustomEditor) => withClueVariables(editor, textContent) 
  };
}

export interface VariableElement extends BaseElement { 
  type: "clueVariable",
  reference: string,
  children: EditorValue
}

export const isVariableElement = (element: CustomElement): element is VariableElement => {
  return element.type === kVariableFormat;
};

export const ClueVariableComponent = ({ attributes, children, element }: RenderElementProps) => {
  const textContent = useContext(TextContentModelContext);
  const isHighlighted =  useSelected(); 
  const isSerializing = useSerializing();
  const e = useSlateStatic();
  const editor = isSerializing ? null : e;

  if (!isVariableElement(element)) return null;
 
  const {reference} = element;

  // This works because slate-editor has a built in emit command which triggers
  // an emitter. text-toolbar.tsx adds a listener to this emitter for the
  // toolbarDialog event. When this event is received it calls the command
  // which is the 3rd arg here (in this case configureVariable), and also gives
  // it the dialogController object followed by the node object
  //
  // This is all necessary so the configureVariable command can be triggered and
  // it is passed the dialogController. The dialogController is managed by the
  // text-toolbar so the configuredVariable command defined above doesn't have
  // direct access to it.
  const _onDoubleClick = () => {
    editor?.emitEvent("configureVariable", element);
  };

  const onDoubleClick = isSerializing ? undefined : _onDoubleClick; // Don't serialize click handler
  const classes = classNames(kSlateVoidClass, kVariableClass) || undefined;
  const selectedClass = isHighlighted && !isSerializing ? "slate-selected" : undefined;
  const variables = getVariables(textContent); 
  const variable = variables.find(v => v.id === reference);
  // FIXME: HTML serialization/deserialization. This will serialize the VariableChip too.
  return (
    <span className={classes} onDoubleClick={onDoubleClick} {...attributes} contentEditable={false}>
      {children}
      { variable ?
        <VariableChip variable={variable} className={selectedClass} /> :
        `invalid reference: ${reference}`
      }
    </span>
  );
};

export function withClueVariables(editor: Editor, textContent: TextContentModelType) {
  const { isInline, isVoid } = editor;
  editor.isInline = (element:BaseElement) => (element.type === kVariableFormat) || isInline(element);
  editor.isVoid = (element:BaseElement) => (element.type === kVariableFormat) || isVoid(element);

  editor.configureElement = (format: string, dialogController: IDialogController, element?: any) =>{ // FIXME: type
    const variables = getVariables(textContent); 
    const hasVariable = editor.isElementActive(kVariableFormat);

    // If there is a selected node we do not allow the user to change this node
    // so the options only have this variable
    const nodeVariable = getNodeVariable(variables, element);
    const variableOptions = nodeVariable ? [nodeVariable] : variables;
    const rows: IRow[] = [
      {
        name: "reference", type: "select", label: "Reference existing variable:",
        options: variableOptions.map(v => ({ value: v.id, label: v.name || "no name" }))
      },
      { name: "or", type: "label", label: "or" },
      { name: "create", type: "label", label: "Create new variable:" },
      [
        { name: "name", type: "input", label: "Name:" },
        { name: "value", type: "input", label: "Value:" }
      ]
    ];
    dialogController.display({
      title: hasVariable ? "Edit Variable" : "Insert Variable",
      rows,
      values: getDialogValuesFromNode(editor, variables, element),
      onChange: (_editor, name, value, values) => {
        if (name === "name") {
          dialogController.update({ name: value });
        }
        else if (name === "value") {
          if (parseFloat(value) == null) return false;
          dialogController.update({ value });
        }
        else if (name === "reference") {
          const reference = value;
          const variable = variables.find(v => v.id === reference);
          const variableName = variable?.name || "";
          const variableValue = variableValueToString(variable?.value);
          dialogController.update({ reference, name: variableName, value: variableValue });
        }
      },
      onValidate: (values) => {
          return values.reference || values.name ? values : "Error: invalid name or value";
      },
      onAccept: (_editor, values) => {
        // ... make any necessary changes to the shared model
        let {reference} = values;
        if (reference) {
          const variable = variables.find(v => v.id === reference);
          variable?.setName(values.name);
          variable?.setValue(parseVariableValue(values.value));

          // If there is a node it means they are editing an existing chip
          // In this case we do not let them change the variable node is referencing
          // Trying to change the reference was breaking slate
          // So we don't need to "add" the chip because it is already there and
          // pointing at this variable
          if (element) {
            return;
          }
        }
        else {
          const sharedModel = getOrFindSharedModel(textContent);
          if (!sharedModel) {
            return;
          }

          let value = parseVariableValue(values.value);
          if (value == null) {
            value = undefined;
          }
          const variable = Variable.create({name: values.name, value});
          sharedModel.addVariable(variable);
          reference = variable.id;
        }
        const varElt: VariableElement = { type: "clueVariable", reference, children: [{text: "" }]};
        const nodePath = element && ReactEditor.findPath(_editor, element);
        nodePath && Transforms.removeNodes(_editor, { at: nodePath });
        Transforms.insertNodes(_editor, varElt, { select: element != null });
      }
    });
  };
  registerElement(kVariableFormat, props => <ClueVariableComponent {...props}/>);
  return editor;
}

function getReferenceFromNode(node?: VariableElement) {
  const { reference } = node || {};
  return reference;
}

function getDialogValuesFromNode(editor: Editor, variables: VariableType[], node: VariableElement | undefined) {
  const values: Record<string, string> = {};
  const highlightedText = (editor && editor.selection) ? Editor.string(editor, editor.selection) : "";
  const reference = getReferenceFromNode(node);
  if (reference) {
    // I think the only time this will happen is when the user double clicked on a
    // node. The node is not set otherwise.
    values.reference = reference;
    const variable = variables.find(v => v.id === reference);
    values.name = variable?.name || "";
    values.value = variableValueToString(variable?.value);
  } else if (highlightedText !== "") {
    const matchingVariable = variables.find(v => v.name === highlightedText);
    if (matchingVariable) {
      values.reference = matchingVariable.id;
      values.name = matchingVariable.name || "";
      values.value = variableValueToString(matchingVariable.value);
    } else {
      values.name = highlightedText;
    }
  }
  return values;
}

function getNodeVariable(variables: VariableType[], node?: VariableElement) {
  const {reference} = node || {};
  return variables.find(v => v.id === reference);
}

function parseVariableValue(value?: string) {
  return value ? parseFloat(value) : undefined;
}

// This is for the input field
function variableValueToString(value?: number) {
  if (value === undefined) {
    return "";
  }
  // The first argument is the locale, using undefined means it should pick up the default
  // browser locale
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}
