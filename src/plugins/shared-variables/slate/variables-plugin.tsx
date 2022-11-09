import React, { ReactNode } from "react";
import classNames from "classnames/dedupe";
import clone from "lodash/clone";
import { Inline } from "slate";
import {
  Editor, HtmlSerializablePlugin, RenderAttributes, RenderInlineProps, hasActiveInline, IFieldValues,
  IDialogController, getDataFromElement, getRenderAttributesFromNode, classArray, EFormat, IRow,
  kSlateVoidClass
} from "@concord-consortium/slate-editor";
import { Variable, VariableChip, VariableType } from "@concord-consortium/diagram-view";
import { kVariableSlateType, getVariables, getOrFindSharedModel } from "./variables-text-content";
import { TextContentModelType } from "../../../models/tiles/text/text-content";

const kVariableClass = "slate-variable-chip";

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

interface IRenderOptions {
  textTile: TextContentModelType;
  isSerializing?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}
function renderVariable(node: Inline, attributes: RenderAttributes, children: ReactNode, options?: IRenderOptions) {
  const { data } = node;
  const { className, ...otherAttributes } = attributes;
  const { isHighlighted, isSerializing, onClick: _onClick, onDoubleClick: _onDoubleClick } = options || {};
  const selectedClass = isHighlighted && !isSerializing ? "slate-selected" : undefined;
  const reference: string = data.get("reference");
  const classes = classNames(classArray(className), kSlateVoidClass, kVariableClass) || undefined;
  const onClick = isSerializing ? undefined : _onClick;
  const onDoubleClick = isSerializing ? undefined : _onDoubleClick;

  if (!options) {
    throw new Error("Can't render variable without options");
  }

  const variables = getVariables(options.textTile);
  const variable = variables.find(v => v.id === reference);

  return (
    <span className={classes} onClick={onClick} onDoubleClick={onDoubleClick} {...otherAttributes}>
      { variable ?
        <VariableChip variable={variable} className={selectedClass} /> :
        `invalid reference: ${reference}`
      }
    </span>
  );
}

function getDataFromVariableElement(el: Element) {
  const { data } = getDataFromElement(el);
  const _data: Record<string, string | number | boolean | undefined> = clone(data) || {};
  if (data?.name) {
    _data.name = data.name;
  }
  _data.value = parseVariableValue(data?.value);
  return { data: _data };
}

function getReferenceFromNode(node?: Inline) {
  const { data } = node || {};
  return data?.get("reference");
}

function getDialogValuesFromNode(editor: Editor, variables: VariableType[], node?: Inline) {
  const values: Record<string, string> = {};
  const highlightedText = editor.value.fragment.text;
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

const kSpanTag = "span";

function getNodeVariable(variables: VariableType[], node?: Inline) {
  const reference = node?.data?.get("reference");
  return variables.find(v => v.id === reference);
}

export function VariablesPlugin(textTile: TextContentModelType): HtmlSerializablePlugin {
  return {
    deserialize(el: any, next: any) {
      if ((el.tagName.toLowerCase() === kSpanTag) && el.classList.contains(kVariableClass)) {
        const data = getDataFromVariableElement(el);
        return {
          object: "inline",
          type: kVariableSlateType,
          ...data,
          nodes: next(el.childNodes),
        };
      }
    },
    serialize(obj: any, children: any) {
      const { object, type } = obj;
      if ((object === "inline") && (type === kVariableSlateType)) {
        const variable: Inline = obj;
        const omits = ["reference"];
        return renderVariable(variable, getRenderAttributesFromNode(variable, omits),
                              children, { textTile, isSerializing: true });
      }
    },

    queries: {
      isVariableActive(editor: Editor) {
        return hasActiveInline(editor.value, kVariableSlateType as EFormat);
      },
      isVariableEnabled(editor: Editor) {
        return (editor.value.blocks.size <= 1) && (editor.value.inlines.size === 0);
      }
    },
    commands: {
      configureVariable(editor: Editor, dialogController: IDialogController | null, node?: Inline): Editor {
        const variables = getVariables(textTile);

        if (!dialogController) {
          const variable = variables[0];
          // TODO when we've upgraded Slate see if we can clean up this `as unknown as Editor`;
          return editor.command("addVariable", {reference: variable.id}) as unknown as Editor;
        }

        // If there is a selected node we do not allow the user to change this node
        // so the options only have this variable
        const nodeVariable = getNodeVariable(variables, node);
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

        const _reference = getReferenceFromNode(node);
        dialogController.display({
          title: _reference ? "Edit Variable" : "Insert Variable",
          rows,
          values: getDialogValuesFromNode(editor, variables, node),
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
              if (node) {
                return;
              }
            }
            else {
              const sharedModel = getOrFindSharedModel(textTile);
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
            return _editor.command("addVariable", {reference});
          }
        });
        return editor;
      },
      addVariable(editor: Editor, values: IFieldValues) {
        const { reference } = values;
        if (!editor || !reference ) return editor;
        if (editor.value.selection) {
          // The documentation for moveToEnd says it will collapse the selection
          // to the end point of the current selection. This is why insertText
          // does not clear the text of the current selection.
          //
          // We only want to do this when there is a selection. We don't want to
          // add a space otherwise. And if a node is selected we want it to be
          // selected so it can be replaced.
          editor.moveToEnd().insertText(" ");
        }
        editor.insertInline({
          type: kVariableSlateType,
          data: { reference }
        });
        return editor;
      },
    },
    schema: {
      inlines: {
        [kVariableSlateType]: {
          isVoid: true
        }
      }
    },

    renderInline: (props: RenderInlineProps, editor: Editor, next: () => any) => {
      const { attributes, node, children } = props;
      if (node.type !== kVariableSlateType) return next();

      const omits = ["reference"];
      const dataAttrs = getRenderAttributesFromNode(node, omits);

      const options: IRenderOptions = {
              textTile,
              isSerializing: false,
              isHighlighted: props.isSelected || props.isFocused,
              onClick: () => editor.moveFocusToStartOfNode(node),
              // This works because slate-editor has a built in emit command which triggers
              // an emitter.  text-toolbar.tsx adds a listener to this emitter for the
              // toolbarDialog event. When this event is received it calls the command
              // which is the 3rd arg here (in this case configureVariable), and also gives
              // it the dialogController object followed by the node object
              //
              // This is all necessary so the configureVariable command can be triggered and
              // it is passed the dialogController. The dialogController is managed by the
              // text-toolbar so the configuredVariable command defined above doesn't have
              // direct access to it.
              onDoubleClick: () => editor.command("emit", "toolbarDialog", "configureVariable", node)
            };
      return renderVariable(node, { ...dataAttrs, ...attributes }, children, options);
    }
  };
}
