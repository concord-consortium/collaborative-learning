import React, { useContext } from "react";
import classNames from "classnames/dedupe";

import {
  BaseElement, CustomEditor, CustomElement, Editor, kSlateVoidClass, registerElementComponent,
  RenderElementProps, Transforms, useSelected, useSerializing,
} from "@concord-consortium/slate-editor";
import { VariableChip, VariableType } from "@concord-consortium/diagram-view";
import { getVariables } from "./variables-text-content";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { TextContentModelContext } from "../../../models/tiles/text/text-content-context";

const kVariableClass = "slate-variable-chip";
export const kVariableFormat = "m2s-variable";

export function VariablesPlugin(textContent: TextContentModelType): any {
  return {
    onInitEditor: (editor: CustomEditor) => withVariables(editor, textContent)
  };
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

export const shouldShowEditVariableButton = (selectedVariable?: VariableType) => {
  // Only show the Edit Variable button when there's a variable selected.
  return !!selectedVariable;
};

export const VariableComponent = ({ attributes, children, element }: RenderElementProps) => {
  const textContent = useContext(TextContentModelContext);
  const isHighlighted = useSelected();
  const isSerializing = useSerializing();

  if (!isVariableElement(element)) return null;

  const {reference} = element;

  const classes = classNames(kSlateVoidClass, kVariableClass);
  const selectedClass = isHighlighted && !isSerializing ? "slate-selected" : undefined;
  const variables = getVariables(textContent);
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
};

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
