import React, { useCallback, useContext, useState } from "react";
import classNames from "classnames/dedupe";

import {
  BaseElement, CustomEditor, CustomElement, Editor, EditorValue, isCustomElement, kSlateVoidClass,
  registerElementComponent, registerElementDeserializer, RenderElementProps, useSelected, useSerializing
} from "@concord-consortium/slate-editor";
import { action, autorun, computed, IReactionDisposer, makeObservable, observable, runInAction } from "mobx";
import { getType } from "mobx-state-tree";
import { observer } from "mobx-react";
import { VariableChip, VariableType } from "@concord-consortium/diagram-view";
import { TextContentModelType } from "../../../models/tiles/text/text-content";
import { ITextPlugin } from "../../../models/tiles/text/text-plugin-info";
import { TextPluginsContext } from "../../../components/tiles/text/text-plugins-context";
import { IOffsetModel, ObjectBoundingBox, OffsetModel } from "../../../models/annotations/clue-object";
import { IStores } from "../../../models/stores/stores";
import { removeAnnotationsForChip } from "../../../components/tiles/text/plugins/chip-annotation-cleanup";
import { getChipBoxInWrapperCoords, useChipMeasurement } from "../../../components/tiles/text/plugins/use-chip-measurement";
import { kSlateChipTypeAttr, kVariableChipReferenceAttr } from "../../../components/tiles/text/plugins/chip-serialization";

import { DEBUG_SHARED_MODELS } from "../../../lib/debug";
import { SharedVariables, SharedVariablesType } from "../shared-variables";

// Returns the references of all variable chip elements in a Slate value.
function collectVariableReferences(value: EditorValue): Set<string> {
  const refs = new Set<string>();
  const walk = (nodes: readonly any[]) => {
    for (const node of nodes) {
      if (node?.type === kVariableFormat && typeof node.reference === "string") {
        refs.add(node.reference);
      }
      if (Array.isArray(node?.children)) walk(node.children);
    }
  };
  walk(value as any);
  return refs;
}

const kVariableClass = "slate-variable-chip";
const kVariableChipOffset = 2;
export const kVariableFormat = "m2s-variable";
export const kVariableTextPluginName = "variables";

export class VariablesPlugin implements ITextPlugin {
  public textContent;
  private disposeSharedModelManagerAutorun: IReactionDisposer|undefined;
  private variableBoxesCache: Map<string, ObjectBoundingBox> = new Map();
  private previousVariableIds: Set<string> = new Set();
  private chipBoxesCacheTick = observable({ count: 0 });
  private stores: IStores | undefined;
  private tileId: string | undefined;
  // Bumped when variable chips are added to or removed from the Slate editor. Read by
  // the variables plugin's `getAnnotatableObjects` so `annotatableObjects` re-evaluates
  // when the chip set changes — Slate's editor state isn't otherwise observable.
  variableChipsRevision = 0;

  constructor(textContent: TextContentModelType) {
    makeObservable(this, {
      textContent: observable,
      sharedModel: computed,
      variables: computed,
      onInitEditor: action,
      variableChipsRevision: observable,
      bumpRevision: action
    });
    this.textContent = textContent;
  }

  /**
   * Publish a chip's bounding box (in `.text-tool-wrapper` coords) to the per-plugin cache.
   * Skips the tick bump if the box hasn't changed, so a no-op ResizeObserver fire doesn't
   * wake up downstream observers (e.g. AnnotationLayer's render).
   */
  publishChipBox(reference: string, box: ObjectBoundingBox) {
    const existing = this.variableBoxesCache.get(reference);
    if (existing && existing.left === box.left && existing.top === box.top
        && existing.width === box.width && existing.height === box.height) return;
    this.variableBoxesCache.set(reference, box);
    runInAction(() => { this.chipBoxesCacheTick.count++; });
  }

  private clearChipBox(reference: string) {
    if (!this.variableBoxesCache.has(reference)) return;
    this.variableBoxesCache.delete(reference);
    runInAction(() => { this.chipBoxesCacheTick.count++; });
  }

  getObjectBoundingBox(id: string, type?: string): ObjectBoundingBox | undefined {
    if (type !== kVariableFormat) return undefined;
    // Track the tick so MobX observers re-run when the cache is written.
    // eslint-disable-next-line unused-imports/no-unused-vars
    const _tick = this.chipBoxesCacheTick.count;
    return this.variableBoxesCache.get(id);
  }

  getObjectDefaultOffsets(id: string, type?: string): IOffsetModel | undefined {
    if (type !== kVariableFormat) return undefined;
    // Track the tick so MobX observers re-run when the cache is written.
    // eslint-disable-next-line unused-imports/no-unused-vars
    const _tick = this.chipBoxesCacheTick.count;
    const offsets = OffsetModel.create({});
    const box = this.variableBoxesCache.get(id);
    if (box) {
      offsets.setDx(box.width / 2);
      offsets.setDy(-box.height / 2);
    }
    return offsets;
  }

  /**
   * Provide the plugin with the application stores and the owning tile id.
   * Required so `handleSlateValueChange` can clean up annotations attached to chips
   * the user edited out. Called by the text tile after the plugin is constructed —
   * `createSlatePlugin(textContent)` doesn't expose either of these.
   */
  setTileContext(stores: IStores, tileId: string) {
    this.stores = stores;
    this.tileId = tileId;
  }

  /**
   * Seed `previousVariableIds` from the initial Slate value before the first user edit,
   * so the first `handleSlateValueChange` diff has the correct baseline.
   */
  initializeFromValue(value: EditorValue) {
    this.previousVariableIds = collectVariableReferences(value);
  }

  /**
   * Diff the variable-chip set on each Slate change. For every removed chip, prune any
   * annotation attached to it and clear its bbox cache entry. Bumps the revision counter
   * when the chip set changes, so observers of `annotatableObjects` re-run.
   */
  handleSlateValueChange(value: EditorValue) {
    const currentIds = collectVariableReferences(value);
    const removed = [...this.previousVariableIds].filter(id => !currentIds.has(id));
    const changed = removed.length > 0 || currentIds.size !== this.previousVariableIds.size;
    this.previousVariableIds = currentIds;

    for (const id of removed) {
      removeAnnotationsForChip(this.stores, this.tileId, id, kVariableFormat);
      this.clearChipBox(id);
    }
    if (changed) this.bumpRevision();
  }

  bumpRevision() {
    this.variableChipsRevision++;
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

const VariableComponent = observer(function({ attributes, children, element }: RenderElementProps) {
  const plugins = useContext(TextPluginsContext);
  const variablesPlugin = plugins[kVariableTextPluginName] as VariablesPlugin|undefined;
  const isHighlighted = useSelected();
  const isSerializing = useSerializing();
  // useState + callback ref so the effect in useChipMeasurement re-runs when the chip
  // element appears — the chip is conditionally rendered (only when the variable
  // resolves), and a useRef wouldn't trigger a re-run when `.current` changes.
  const [chipEl, setChipEl] = useState<HTMLSpanElement | null>(null);

  const reference = isVariableElement(element) ? element.reference : undefined;

  // Publish the chip's bbox in `.text-tool-wrapper` coordinates. Skips zero-sized
  // measurements so the registry only sees real layout. useChipMeasurement handles
  // the retry/observer scaffolding.
  const measure = useCallback(() => {
    if (!chipEl || !variablesPlugin || !reference) return;
    const box = getChipBoxInWrapperCoords(chipEl, kVariableChipOffset);
    if (box) variablesPlugin.publishChipBox(reference, box);
  }, [chipEl, reference, variablesPlugin]);

  useChipMeasurement(chipEl, measure);

  if (!isVariableElement(element)) return null;

  // When serializing to HTML (slateToHtml), emit only the marker span so the round-trip
  // back via htmlToSlate can reconstruct the chip element. Without this, the rendered
  // VariableChip below would serialize as plain text and lose the reference id.
  if (isSerializing) {
    const serializeAttrs = {
      [kSlateChipTypeAttr]: kVariableFormat,
      [kVariableChipReferenceAttr]: element.reference,
    };
    return <span {...attributes} {...serializeAttrs}>{children}</span>;
  }

  const classes = classNames(kSlateVoidClass, kVariableClass);
  const selectedClass = isHighlighted ? "slate-selected" : undefined;
  const variable = variablesPlugin?.variables.find(v => v.id === element.reference);
  return (
    <span className={classes} {...attributes} contentEditable={false}>
      {children}
      { variable ?
        <span ref={setChipEl} className="variable-chip-measure-wrapper">
          <VariableChip variable={variable} className={selectedClass} />
        </span> :
        `invalid reference: ${element.reference}`
      }
    </span>
  );
});

let isRegistered = false;

export function registerVariables() {
  if (isRegistered) return;

  registerElementComponent(kVariableFormat, props => <VariableComponent {...props}/>);

  // Pair to the serialization above: when htmlToSlate sees a span with our marker
  // data-slate-type attribute, reconstruct the variable chip element.
  registerElementDeserializer("span", {
    test: (el: HTMLElement) => el.getAttribute(kSlateChipTypeAttr) === kVariableFormat,
    deserialize: (el: HTMLElement): VariableElement => ({
      type: kVariableFormat,
      reference: el.getAttribute(kVariableChipReferenceAttr) ?? "",
      children: [{ text: "" }]
    } as VariableElement)
  });

  isRegistered = true;
}

export function withVariables(editor: Editor, textContent: TextContentModelType) {
  registerVariables();

  const { isInline, isVoid } = editor;
  editor.isInline = element => (element.type === kVariableFormat) || isInline(element);
  editor.isVoid = element => (element.type === kVariableFormat) || isVoid(element);

  return editor;
}
