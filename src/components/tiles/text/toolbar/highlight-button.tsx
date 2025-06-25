import React, { useContext } from "react";
import { v4 as uuid } from "uuid";
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


  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!editor.selection || Range.isCollapsed(editor.selection)) return;

    const selectedText = Editor.string(editor, editor.selection);
    const reference = uuid();
    highlightsPlugin?.addHighlight(reference, selectedText);

    highlightText(reference, selectedText);
  };

  return (
    <TileToolbarButton
      name={name}
      title="Highlight"
      disabled={disabled}
      selected={toggleHighlight}
      onClick={handleClick}
    >
      <HighlightToolIcon/>
    </TileToolbarButton>
  );
};
