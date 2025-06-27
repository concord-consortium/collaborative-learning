import React, { useContext, useEffect, useRef } from "react";
import classNames from "classnames/dedupe";
import { Element as SlateElement } from "slate";
import { BaseElement, CustomEditor, CustomElement, Editor, kSlateVoidClass, registerElementComponent,
  RenderElementProps, useSelected } from "@concord-consortium/slate-editor";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import { TextContentModelType } from "../../models/tiles/text/text-content";
import { ITextPlugin } from "../../models/tiles/text/text-plugin-info";
import { TextPluginsContext } from "../../components/tiles/text/text-plugins-context";
import { HighlightRegistryContext } from "./highlight-registry-context"; // 👈 new import

export const kHighlightFormat = "highlight";
export const kHighlightTextPluginName = "highlights";

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
  reference: string;
}

export const isHighlightElement = (element: CustomElement): element is HighlightElement => {
  return element.type === kHighlightFormat;
};

export const HighlightComponent = observer(function({ attributes, children, element }: RenderElementProps) {
  const plugins = useContext(TextPluginsContext);
  const highlightPlugin = plugins[kHighlightTextPluginName] as HighlightsPlugin|undefined;
  const isSelected = useSelected();
  const registryFn = useContext(HighlightRegistryContext);
  const chipRef = useRef<HTMLSpanElement>(null); // 👈 ref to DOM node


  if (!isHighlightElement(element)) return null;
  const {reference} = element;
  const highlightEntry = highlightPlugin?.highlightedText.find(ht => ht.id === reference);
  const textToHighlight = highlightEntry?.text ?? `invalid reference: ${reference}`;

  useEffect(() => {
    const el = chipRef.current;
    if (!el || !registryFn) return;

    const reportBox = () => {
      const highlightRect = el.getBoundingClientRect();
      const textBoxRect = el.closest('.text-tool-wrapper')?.getBoundingClientRect();
      if (textBoxRect) {
        registryFn(reference, {
          left: highlightRect.left - textBoxRect.left,
          top: highlightRect.top - textBoxRect.top,
          width: highlightRect.width - 2,
          height: highlightRect.height - 2
        });
      }
    };

    requestAnimationFrame(reportBox);

    const highlightObserver = new ResizeObserver(reportBox);
    highlightObserver.observe(el);
    return () => highlightObserver.disconnect();
  }, [registryFn, reference]);

  const classes = classNames(kSlateVoidClass, "slate-highlight-chip");

  return (
    <span className={classes} {...attributes} contentEditable={false}>
      <span ref={chipRef} className={classNames("highlight-chip", {"slate-selected": highlightEntry && isSelected})} >
        {children}
        {textToHighlight}
      </span>
    </span>
  );
});

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


export function getHighlightElement(editor: CustomEditor, id: string): HighlightElement | undefined {
  // Safely traverse the editor's children to find the highlight element.
  const findHighlightElement = (nodes: any[]): HighlightElement | undefined => {
    for (const node of nodes) {
      if (SlateElement.isElement(node)) {
        if ((node as HighlightElement).type === kHighlightFormat && (node as HighlightElement).reference === id) {
          return node as HighlightElement;
        }
        if (node.children) {
          const childResult = findHighlightElement(node.children);
          if (childResult) {
            return childResult;
          }
        }
      }
    }
    return undefined;
  };

  return findHighlightElement(editor.children);
}
