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
  const getSelectedChips = () => {
    if (!selection) return undefined;
    // Find the highlight chip nodes at selection
    return Array.from(Editor.nodes(editor, {
      match: n => (n as any).type === kHighlightFormat,
      at: selection
    })) as [HighlightElement, Path][];
  };

  const highlightText = (reference: string, text: string, marks?: Record<string, any>) =>{
    if (!editor.selection || Range.isCollapsed(editor.selection)) return;
    const selectionLength = Editor.string(editor, editor.selection).length;
    if (selectionLength === 0) return;

    const highlightNode: HighlightElement = {
      type: kHighlightFormat,
      reference,
      children: [{ text, ...marks }]
    };
    // Replace selected text with the highlight chip
    Transforms.delete(editor, { at: editor.selection });
    Transforms.insertNodes(editor, highlightNode);
    Transforms.collapse(editor, { edge: "end" });
  };

  const unHighlightChip = (chipEntry: [HighlightElement, Path]) => {
    if (!editor.selection) return;
    if (chipEntry) {
      const [chipNode, chipPath] = chipEntry as [HighlightElement, Path];
      const previousPath = Path.previous(chipPath);
      const insertPoint = Editor.end(editor, previousPath);
      const chipNodeChild = chipNode.children[0] as { text: string, marks?: Record<string, any> };
      const { text, ...marks } = chipNodeChild;
      Transforms.removeNodes(editor, { at: chipPath });
      Transforms.insertNodes(editor, { text, ...marks }, { at: insertPoint });
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (isHighlightedText) {
      const selectedChips = getSelectedChips();
      if (!selectedChips || selectedChips.length === 0) return;
      const chipReferences = selectedChips.map(([chipNode]) => chipNode.reference);

      chipReferences.forEach(ref => {
        // Find the chip node with this reference in the current editor state
        const [chipEntry] = Array.from(Editor.nodes(editor, {
          match: n => (n as any).type === kHighlightFormat && (n as any).reference === ref,
          at: selection ?? undefined
        })) as [HighlightElement, Path][];
        if (chipEntry) {
          highlightsPlugin?.removeHighlight(ref);
          unHighlightChip(chipEntry);
        }
      });
      return;
    }

    if (!editor.selection || Range.isCollapsed(editor.selection)) return;

    const selectedText = Editor.string(editor, editor.selection);
    const selectedTextMarks = Editor.marks(editor);
    const reference = uuid();
    highlightsPlugin?.addHighlight(reference, selectedText);
    highlightText(reference, selectedText, selectedTextMarks || undefined);
  };

  return (
    <TileToolbarButton
      name={name}
      title="Highlight"
      disabled={disabled}
      selected={isHighlightedText}
      onClick={handleClick}
      dataTestId="text-highlight-button"
    >
      <HighlightToolIcon/>
    </TileToolbarButton>
  );
};
