import React, { useContext, useState } from "react";
import { v4 as uuid } from "uuid";
import { Editor, Range, Transforms, useSlate } from "@concord-consortium/slate-editor";
import { HighlightsPlugin, kHighlightTextPluginName, kHighlightFormat } from "../../../../plugins/text/highlights-plugin";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";
import { TextPluginsContext } from "../text-plugins-context";

import HighlightToolIcon from "../../../../assets/icons/text/highlight-text-icon.svg";

export const HighlightButton = ({name}: IToolbarButtonComponentProps) => {
  const editor = useSlate();
  const plugins = useContext(TextPluginsContext);
  const highlightsPlugin = plugins[kHighlightTextPluginName] as HighlightsPlugin | undefined;
  const { selection } = editor;
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const isSelected = !!selection && !isCollapsed;
  const disabled = isCollapsed && !isSelected;
  const [toggleHighlight, setToggleHighlight] = useState(false);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!editor.selection || Range.isCollapsed(editor.selection)) return;

    const selectedText = Editor.string(editor, editor.selection);
    const reference = uuid();
    highlightsPlugin?.addHighlight(reference, selectedText);

    const highlightNode = {
      type: "highlight",
      reference,
      children: []
    };
    Transforms.wrapNodes(editor, highlightNode, { split: true });
    Transforms.collapse(editor, { edge: "end" });

    setToggleHighlight(!toggleHighlight);
  };
  return (
    <TileToolbarButton name={name} title="Highlight" disabled={disabled} selected={toggleHighlight}
                        onClick={handleClick}>
      <HighlightToolIcon/>
    </TileToolbarButton>
  );
};
