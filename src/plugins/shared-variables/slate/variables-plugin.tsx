import React, { ReactNode } from "react";
import classNames from "classnames/dedupe";
import clone from "lodash/clone";
import { Inline, Node } from "slate";
import { getParentOfType, getPath, getSnapshot, hasParentOfType } from "mobx-state-tree";
import { Editor, HtmlSerializablePlugin, RenderAttributes, 
  RenderInlineProps, hasActiveInline, IFieldValues, 
  IDialogController, 
  getDataFromElement, getRenderAttributesFromNode, classArray, EFormat, IRow
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
  const highlightClass = options?.isHighlighted && !options?.isSerializing ? kVariableHighlightClass : undefined;
  const reference: string = data.get("reference");
  const classes = classNames(classArray(className), kVariableClass, highlightClass) || undefined;
  const onClick = options?.isSerializing ? undefined : options?.onClick;
  const onDoubleClick = options?.isSerializing ? undefined : options?.onDoubleClick;

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
  const _data: Record<string, string | number | boolean> = clone(data) || {};
  if (data?.name) {
    _data.name = data.name;
  }
  if (data?.value) {
    _data.value = Math.round(parseFloat(data.value));
  }
  return { data: _data };
}

function getDialogValuesFromNode(node?: Inline) {
  const values: Record<string, string> = {};
  const { data } = node || {};
  let name, value;
  if ((name = data?.get("name"))) {
    values.name = name;
  }
  if ((value = data?.get("value"))) {
    values.value = value;
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

        dialogController.display({
          title: "Insert Variable",
          rows,
          values: getDialogValuesFromNode(node),
          onChange: (_editor, name, value, values) => {
            if (name === "name") {
              dialogController.update({ name: value });
            }
            else if (name === "value") {
              if (parseFloat(value) == null) return false;
              dialogController.update({ value });
            }
            else if (name === "reference") {
              dialogController.update({ reference: value });
            }
          },
          onValidate: (values) => {
            const name = values.reference || values.name;
            if (values.reference) {
              // If we have a reference assume it is value
              return values;
            }
            const value = parseFloat(values.value);
            // FIXME: It is normal to allow variables with out values
            return !!name && isFinite(value) ? values : "Error: invalid name or value";
          },
          onAccept: (_editor, values) => {
            // ... make any necessary changes to the shared model
            let {reference} = values;
            if (!reference) {
              const sharedModel = getSharedModel(toolTileModel);
              if (!sharedModel) {
                // TODO: can we just return void here?
                return;
              } else {
                let value = values.value ? parseFloat(values.value) : undefined;
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
        if (node) {
          editor.moveToStartOfNode(node)
                .deleteForward();
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
