import React, { useContext } from "react";
import { v4 as uuid } from "uuid";
import { Path } from "slate";
import { Editor, Range, Transforms, useSlate } from "@concord-consortium/slate-editor";
import { HighlightsPlugin, kHighlightTextPluginName, kHighlightFormat, HighlightElement }
  from "../../../../plugins/text/highlights-plugin";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";
import { TextPluginsContext } from "../text-plugins-context";

import HighlightToolIcon from "../../../../assets/icons/text/highlight-text-icon.svg";

export const HighlightButton = ({name}: IToolbarButtonComponentProps) => {
  const editor = useSlate();
  const plugins = useContext(TextPluginsContext);
  const highlightsPlugin = plugins[kHighlightTextPluginName] as HighlightsPlugin | undefined;
  const { selection } = editor;
  const isHighlightedText = editor.isElementActive(kHighlightFormat);
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const isSelected = !!selection && !isCollapsed;
  const disabled = !isHighlightedText && isCollapsed && !isSelected;
  const getSelectedChip = () => {
    if (!selection) return undefined;
    // Find the highlight chip node at selection
    const [chipEntry] = Editor.nodes(editor, {
      match: n => (n as any).type === kHighlightFormat,
      at: selection
    });
    return chipEntry ? (chipEntry as [HighlightElement, Path]) : undefined;
  };

  const highlightText = (reference: string, text: string) =>{
    if (!editor.selection || Range.isCollapsed(editor.selection)) return;
    const selectionLength = Editor.string(editor, editor.selection).length;
    if (selectionLength === 0) return;

    const highlightNode: HighlightElement = {
      type: kHighlightFormat,
      reference,
      children: [{ text }]
    };
    // Replace selected text with the highlight chip
    Transforms.delete(editor, { at: editor.selection });
    Transforms.insertNodes(editor, highlightNode);
    Transforms.collapse(editor, { edge: "end" });
  };

  const unHighlightChip = () => {
    if (!editor.selection) return;
    const chipEntry = getSelectedChip();

    if (chipEntry) {
      const [chipNode, chipPath] = chipEntry as [HighlightElement, Path];
      const previousPath = Path.previous(chipPath);
      const insertPoint = Editor.end(editor, previousPath);
      const chipNodeChild = chipNode.children[0] as { text: string };
      const text = chipNodeChild.text || ""; // Assume the first child has the text
      const marks = Editor.marks(editor) || {};
      Transforms.removeNodes(editor, { at: chipPath });
      Transforms.insertNodes(editor, { text, ...marks }, { at: insertPoint });
      Object.keys(marks).forEach(key => {
        Editor.removeMark(editor, key);
      });
      Object.entries(marks).forEach(([key, value]) => {
        Editor.addMark(editor, key, value);
      });
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (isHighlightedText) {
      const selectedChip = getSelectedChip();
      const selectedReference = selectedChip ? selectedChip[0].reference : "";
      // Remove from plugin first, then from editor to prevent "invalid reference" issues
      highlightsPlugin?.removeHighlight(selectedReference);
      unHighlightChip();
      return;
    }
    if (!editor.selection || Range.isCollapsed(editor.selection)) return;

    const selectedText = Editor.string(editor, editor.selection);
    const reference = uuid();
    highlightsPlugin?.addHighlight(reference, selectedText);

    highlightText(reference, selectedText);
  };

  return (
    <TileToolbarButton name={name} title="Highlight" disabled={disabled} selected={isHighlightedText}
                        onClick={handleClick}>
      <HighlightToolIcon/>
    </TileToolbarButton>
  );
};
