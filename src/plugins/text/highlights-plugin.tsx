import React, { useContext } from "react";
import classNames from "classnames/dedupe";
import { v4 as uuid } from "uuid";
import { BaseElement, CustomEditor, CustomElement, Descendant, Editor, kSlateVoidClass, Range, registerElementComponent, RenderElementProps,
   Transforms, useSelected, useSerializing } from "@concord-consortium/slate-editor";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import { TextContentModelType } from "../../models/tiles/text/text-content";
import { ITextPlugin } from "../../models/tiles/text/text-plugin-info";
import { TextPluginsContext } from "../../components/tiles/text/text-plugins-context";

export const kHighlightChipType = "highlight-chip";
export const kHighlightFormat = "highlight";
export const kHighlightTextPluginName = "highlights";
const kHighlightChipClass = "slate-highlight-chip";

export class HighlightsPlugin implements ITextPlugin {
  public textContent: TextContentModelType;

  constructor(textContent: TextContentModelType) {
    makeObservable(this, {
      textContent: observable,
      addHighlight: action,
      onInitEditor: action
    });
    this.textContent = textContent;
  }

  get highlightedText(): { id: string, text: string }[] {
    return this.textContent.highlightedText ?? [];
  }

  addHighlight(id: string, text: string) {
    console.log("HighlightsPlugin.addHighlight", {id, text})
    this.textContent.addHighlight(id, text );
  }

  onInitEditor(editor: CustomEditor) {
    return withHighlights(editor);
  }
};

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
  const isSerializing = useSerializing();

  if (!isHighlightElement(element)) return null;
  const {reference} = element;
  const highlightEntry = highlightPlugin?.highlightedText.find(ht => ht.id === reference);
  const textToHighlight = highlightEntry?.text ?? `invalid reference: ${reference}`;

  const classes = classNames(kSlateVoidClass, "slate-highlight-chip",
                              {"slate-selected": isSelected && !isSerializing});

  return (
    <span className={classes} {...attributes} contentEditable={false}>
      <span className="highlight-chip">
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
  // registerHighlight();
  const { isInline } = editor;
  editor.isInline = element => (element.type === kHighlightFormat) || isInline(element);
  return editor;
}
