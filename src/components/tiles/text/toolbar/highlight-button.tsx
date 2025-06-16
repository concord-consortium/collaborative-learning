import React, { useContext, useState } from "react";
import { Editor, Range, useSlate }
  from "@concord-consortium/slate-editor";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";
import { TextContentModelContext } from "../text-content-context";

import HighlightToolIcon from "../../../../assets/icons/text/highlight-text-icon.svg";

export const HighlightButton = ({name}: IToolbarButtonComponentProps) => {
  const editor = useSlate();
  const { selection } = editor;
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const isSelected = !!selection && !isCollapsed;
  const disabled = isCollapsed && !isSelected;
  const textContent = useContext(TextContentModelContext);
  const text = isSelected && selection
    ? Editor.string(editor, selection)
    : "";
  const [toggleHighlight, setToggleHighlight] = useState(false);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setToggleHighlight(!toggleHighlight);
  };
  return (
    <TileToolbarButton name={name} title="Highlight" disabled={disabled} selected={toggleHighlight} onClick={handleClick}>
      <HighlightToolIcon/>
    </TileToolbarButton>
  );
};
