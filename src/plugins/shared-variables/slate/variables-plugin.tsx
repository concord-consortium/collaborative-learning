import React, { ReactNode } from "react";
import classNames from "classnames/dedupe";
import clone from "lodash/clone";
import { Inline } from "slate";
import { getParentOfType, getPath, getSnapshot, hasParentOfType } from "mobx-state-tree";
import {
  Editor, HtmlSerializablePlugin, RenderAttributes, RenderInlineProps, hasActiveInline, IFieldValues,
  IDialogController, getDataFromElement, getRenderAttributesFromNode, classArray, EFormat, IRow
} from "@concord-consortium/slate-editor";
import { VariableType, Variable } from "@concord-consortium/diagram-view";
import "./variables-plugin.scss";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DocumentContentModel } from "../../../models/document/document-content";
import { SharedVariables } from "../shared-variables";
import { VariableChip } from "./variable-chip";

export const kVariableSlateType = "m2s-variable";
const kVariableClass = "ccrte-variable";
const kVariableHighlightClass = "ccrte-variable-highlight";

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
  toolTileModel: ToolTileModelType;
  isSerializing?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}
function renderVariable(node: Inline, attributes: RenderAttributes, children: ReactNode, options?: IRenderOptions) {
  const { data } = node;
  const { className, ...otherAttributes } = attributes;
  const { isHighlighted, isSerializing, onClick: _onClick, onDoubleClick: _onDoubleClick } = options || {};
  const highlightClass = isHighlighted && !isSerializing ? kVariableHighlightClass : undefined;
  const reference: string = data.get("reference");
  const classes = classNames(classArray(className), kVariableClass, highlightClass) || undefined;
  const onClick = isSerializing ? undefined : _onClick;
  const onDoubleClick = isSerializing ? undefined : _onDoubleClick;

  if (!options) {
    throw new Error("Can't render variable without options");
  }

  const variables = getVariables(options.toolTileModel);
  const variable = variables.find(v => v.id === reference);

  return (
    <span className={classes} onClick={onClick} onDoubleClick={onDoubleClick} {...otherAttributes}>
      { variable ?
        <VariableChip {...{variable}}/> :
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
      // FIXME: We are not setting the name and value fields in the form.
      values.reference = matchingVariable.id;
      values.name = matchingVariable.name || "";
      values.value = variableValueToString(matchingVariable.value);
    } else {
      values.name = highlightedText;
    }
  }
  return values;
}

function getSharedModel(toolTileModel: ToolTileModelType) {
  console.log("afterAttach", getPath(toolTileModel));

  if (!hasParentOfType(toolTileModel, DocumentContentModel)) {
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

function getVariables(toolTileModel: ToolTileModelType): VariableType[] {
  const sharedModel = getSharedModel(toolTileModel);
  return sharedModel ? sharedModel.variables : [];
}

const kSpanTag = "span";

export function VariablesPlugin(toolTileModel: ToolTileModelType): HtmlSerializablePlugin {
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
                              children, { toolTileModel, isSerializing: true });
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
      configureVariable(editor: Editor, dialogController: IDialogController | null, node?: Inline) {
        const variables = getVariables(toolTileModel);

        if (!dialogController) {
          const variable = variables[0];
          return editor.command("addVariable", {reference: variable.id}, node);
        }

        const rows: IRow[] = [
          {
            name: "reference", type: "select", label: "Reference existing variable:",
            options: variables.map(v => ({ value: v.id, label: v.name || "no name" }))
          },
          { name: "or", type: "label", label: "or" },
          { name: "create", type: "label", label: "Create new variable:" },
          [
            { name: "name", type: "input", label: "Name:" },
            { name: "value", type: "input", label: "Value:" }
          ]
        ];
        console.log("rows", rows);

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
            }
            else {
              const sharedModel = getSharedModel(toolTileModel);
              if (!sharedModel) {
                // TODO: can we just return void here?
                return;
              } else {
                let value = parseVariableValue(values.value);
                if (value == null) {
                  value = undefined;
                }
                const variable = Variable.create({name: values.name, value});
                sharedModel.addVariable(variable);
                reference = variable.id;
              }
            }
            return _editor.command("addVariable", {reference}, node);
          }
        });
        return editor;
      },
      addVariable(editor: Editor, values: IFieldValues, node?: Inline) {
        const { reference } = values;
        if (!editor || !reference ) return editor;
        // The intention here is to select the node that was double clicked on
        // so the following insert will replace this node. However this isn't
        // working. Just manually selecting a node and typing a character or
        // hitting delete also doesn't work. So I suspect when those things are
        // fixed this will be fixed too.
        //
        // If the only thing changed is the contents of the variable (name,
        // value, or unit) it isn't necessary to replace the node.  But it
        // doesn't hurt.
        if (node) {
          editor.moveToRangeOfNode(node);
        }
        if (editor.value.selection) {
          // The documentation for moveToEnd says it will collapse the selection
          // to the end point of the current selection. This is why insertText
          // does not clear the text of the current selection.
          //
          // However in some cases the text is remaining selected: When text is
          // selected with a matching variable name, the dialog will preselect
          // that variable in the reference drop down menu. When the dialog is
          // closed (without doing anything else), the text remains selected
          // along with the new chip.
          //
          // If you follow the same steps but also click in the name or value
          // fields then text will not remained selected.
          //
          // So this seems to be related to focus somehow.
          editor.moveToEnd()
                .insertText(" ");
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
        variable: {
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
              toolTileModel,
              isSerializing: false,
              isHighlighted: props.isSelected || props.isFocused,
              onClick: () => editor.moveFocusToStartOfNode(node),
              // FIXME: this isn't working, I don't understand how it should
              // work because it isn't passing the dialogController, but it does
              // work when this is done in the slate-editor repo.
              onDoubleClick: () => editor.command("emit", "toolbarDialog", "configureVariable", node)
            };
      return renderVariable(node, { ...dataAttrs, ...attributes }, children, options);
    }
  };
}
