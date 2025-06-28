import React, { useContext, useEffect, useRef } from "react";
import classNames from "classnames/dedupe";

import {
  BaseElement, CustomEditor, CustomElement, Editor, isCustomElement, kSlateVoidClass, registerElementComponent,
  RenderElementProps, useSelected, useSerializing
} from "@concord-consortium/slate-editor";
import { action, autorun, computed, IReactionDisposer, makeObservable, observable } from "mobx";
import { getType } from "mobx-state-tree";
import { observer } from "mobx-react";
import { VariableChip, VariableType } from "@concord-consortium/diagram-view";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { ITextPlugin } from "../../../models/tiles/text/text-plugin-info";
import { TextPluginsContext } from "../../../components/tiles/text/text-plugins-context";

import { DEBUG_SHARED_MODELS } from "../../../lib/debug";
import { SharedVariables, SharedVariablesType } from "../shared-variables";

const kVariableClass = "slate-variable-chip";
export const kVariableFormat = "m2s-variable";
export const kVariableTextPluginName = "variables";

// Variable registry context for bounding box tracking
export interface IVariableBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const VariableRegistryContext = React.createContext<((id: string, box: IVariableBox) => void) | undefined>(undefined);

export class VariablesPlugin implements ITextPlugin {
  public textContent;
  private disposeSharedModelManagerAutorun: IReactionDisposer|undefined;

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
    return this.sharedModel?.variables || [];
  }

  /**
   * Add the shared model to the text tile when it is ready.
   */
  addTileSharedModelWhenReady() {
    this.disposeSharedModelManagerAutorun = autorun(() => {
      // Make sure there is a sharedModelManager and it is ready
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

      // Our text tile doesn't have a shared model, see if the document has one
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

      // We could dispose the autorun here, but we aren't. There is a chance
      // that the shared model will be removed from the document and a new one
      // added. This is not currently supported, but it seems pretty harmless to
      // leave the autorun in place just in case we support this later.
    });
  }

  onInitEditor(editor: CustomEditor) {
    return withVariables(editor, this.textContent);
  }

  dispose() {
    this.disposeSharedModelManagerAutorun?.();
  }

  get chipVariables() {
    const {editor} = this.textContent;
    const variableIds: string[] = [];
    if (editor) {
      for (const [node] of Editor.nodes(editor, {at: [], mode: 'all'})) {
        if (isCustomElement(node)) {
          if (Editor.isInline(editor, node) && isVariableElement(node)) {
            variableIds.push(node.reference);
          }
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

export const VariableComponent = observer(function({ attributes, children, element }: RenderElementProps) {
  const plugins = useContext(TextPluginsContext);
  const variablesPlugin = plugins[kVariableTextPluginName] as VariablesPlugin|undefined;
  const isHighlighted = useSelected();
  const isSerializing = useSerializing();
  const registryFn = useContext(VariableRegistryContext);
  const chipRef = useRef<HTMLSpanElement>(null);

  if (!isVariableElement(element)) return null;

  const {reference} = element;

  useEffect(() => {
    const el = chipRef.current;
    if (!el || !registryFn) return;

    const reportBox = () => {
      const variableRect = el.getBoundingClientRect();
      const textBoxRect = el.closest('.text-tool-wrapper')?.getBoundingClientRect();
      if (textBoxRect) {
        registryFn(reference, {
          left: variableRect.left - textBoxRect.left,
          top: variableRect.top - textBoxRect.top,
          width: variableRect.width - 2,
          height: variableRect.height - 2
        });
      }
    };

    requestAnimationFrame(reportBox);

    const variableObserver = new ResizeObserver(reportBox);
    variableObserver.observe(el);
    return () => variableObserver.disconnect();
  }, [registryFn, reference]);

  const classes = classNames(kSlateVoidClass, kVariableClass);
  const selectedClass = isHighlighted && !isSerializing ? "slate-selected" : undefined;
  const variable = variablesPlugin?.variables.find(v => v.id === reference);
  // FIXME: HTML serialization/deserialization. This will serialize the VariableChip too.
  return (
    <span className={classes} {...attributes} contentEditable={false}>
      {children}
      { variable ?
        <span ref={chipRef}>
          <VariableChip variable={variable} className={selectedClass} />
        </span> :
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
