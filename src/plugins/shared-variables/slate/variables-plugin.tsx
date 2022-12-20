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
export function VariablesPlugin(textContent: TextContentModelType): any {
  return {
    onInitEditor: (editor: CustomEditor) => withClueVariables(editor, textContent) 
  };
}

export interface VariableElement extends BaseElement { 
  type: "clueVariable",
  reference: string,
  children: EditorValue
}

export const isVariableElement = (element: BaseElement): element is VariableElement => {
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

  const _onDoubleClick = () => {
    // FIXME: call same function as the toolbar once that code is cleaner.
    console.log('double click variable');

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

  registerElement(kVariableFormat, props => <ClueVariableComponent {...props}/>);
  return editor;
}