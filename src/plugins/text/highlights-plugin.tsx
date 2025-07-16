import React, { useCallback, useContext, useEffect, useRef } from "react";
import classNames from "classnames/dedupe";
import { BaseElement, CustomEditor, CustomElement, Editor, kSlateVoidClass, registerElementComponent,
  RenderElementProps, useSelected } from "@concord-consortium/slate-editor";
import { action, makeObservable, observable } from "mobx";
import { TextContentModelType } from "../../models/tiles/text/text-content";
import { ITextPlugin } from "../../models/tiles/text/text-plugin-info";
import { TextPluginsContext } from "../../components/tiles/text/text-plugins-context";
import { HighlightRegistryContext, HighlightRevisionContext } from "./highlight-registry-context";

export const kHighlightFormat = "highlight";
export const kHighlightTextPluginName = "highlights";

const kHighlightOffset = 2;

export class HighlightsPlugin implements ITextPlugin {
  public textContent: TextContentModelType;

  constructor(textContent: TextContentModelType) {
    makeObservable(this, {
      textContent: observable,
      addHighlight: action,
      removeHighlight: action,
      onInitEditor: action
    });
    this.textContent = textContent;
  }

  get highlightedText(): { id: string, text: string }[] {
    return this.textContent.highlightedText ?? [];
  }

  addHighlight(id: string, text: string) {
    this.textContent.addHighlight(id, text );
  }

  removeHighlight(id: string) {
    this.textContent.removeHighlight(id);
  }

  onInitEditor(editor: CustomEditor) {
    return withHighlights(editor);
  }
}

export interface HighlightElement extends BaseElement {
  type: typeof kHighlightFormat;
  highlightId: string;
  //store the start offset of the selected text so we can restore the selection after removing the highlight
  startOffset: number;
}

export const isHighlightElement = (element: CustomElement): element is HighlightElement => {
  return element.type === kHighlightFormat;
};

export const HighlightComponent = ({ attributes, children, element }: RenderElementProps) => {
  const plugins = useContext(TextPluginsContext);
  const highlightPlugin = plugins[kHighlightTextPluginName] as HighlightsPlugin|undefined;
  const isSelected = useSelected();
  const highlightRegistryContextFn = useContext(HighlightRegistryContext);
  const chipRef = useRef<HTMLSpanElement>(null);
  const editorRevisionContext = useContext(HighlightRevisionContext);

  const { highlightId } = element as HighlightElement;
  const highlightEntry = highlightPlugin?.highlightedText.find(ht => ht.id === highlightId);
  const textToHighlight = highlightEntry?.text ?? `invalid reference: ${highlightId}`;

  // Memoize getHighlightChipBoundingBox so it can be used in the dependency array
  const getHighlightChipBoundingBox = useCallback(() => {
    const el = chipRef.current;
    if (!el) return;
    const highlightRect = el.getBoundingClientRect();
    const textBoxRect = el.closest('.text-tool-wrapper')?.getBoundingClientRect();
    if (highlightRect && textBoxRect && highlightRect.width > 0 && highlightRect.height > 0
          && highlightRegistryContextFn) {
      highlightRegistryContextFn(highlightId, {
        left: highlightRect.left - textBoxRect.left,
        top: highlightRect.top - textBoxRect.top,
        width: highlightRect.width - kHighlightOffset,
        height: highlightRect.height - kHighlightOffset
      });
    }
  }, [highlightId, highlightRegistryContextFn]);

  useEffect(() => {
    getHighlightChipBoundingBox();
  }, [editorRevisionContext, getHighlightChipBoundingBox]);

  if (!isHighlightElement(element)) return null;

  const classes = classNames(kSlateVoidClass, "slate-highlight-chip");

  return (
    <span className={classes} {...attributes} contentEditable={false}>
      <span ref={chipRef} className={classNames("highlight-chip", {"slate-selected": highlightEntry && isSelected})} >
        {children}
        {textToHighlight}
      </span>
    </span>
  );
};

let isRegistered = false;

export function registerHighlight() {
  if (isRegistered) return;

  registerElementComponent(kHighlightFormat, props => <HighlightComponent {...props}/>);
  isRegistered = true;
}

registerHighlight();

export function withHighlights(editor: Editor) {
  const { isInline, isVoid } = editor;
  editor.isInline = element => element.type === kHighlightFormat || isInline(element);
  editor.isVoid = element => element.type === kHighlightFormat || isVoid(element);
  return editor;
}

export function isHighlightChipSelected(editor: Editor): boolean {
  if (!editor.selection) return false;

  const [match] = Editor.nodes(editor, {
    match: (n) => (n as CustomElement).type === kHighlightFormat
  });

  return !!match;
}
