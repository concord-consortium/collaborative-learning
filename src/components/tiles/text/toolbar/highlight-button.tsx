import React, { useState } from "react";
import { Range, useSlate } from "@concord-consortium/slate-editor";
import { TileToolbarButton } from "../../../toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../toolbar/toolbar-button-manager";

import HighlightToolIcon from "../../../../assets/icons/text/highlight-text-icon.svg";

export const HighlightButton = ({name}: IToolbarButtonComponentProps) => {
  const editor = useSlate();
  const { selection } = editor;
  const isCollapsed = selection ? Range.isCollapsed(selection) : true;
  const isSelected = !!selection && !isCollapsed;
  const disabled = isCollapsed && !isSelected;
  const [toggleHighlight, setToggleHighlight] = useState(false);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setToggleHighlight(!toggleHighlight);
  };
  return (
    <TileToolbarButton
      name={name}
      title="Highlight"
      disabled={disabled}
      selected={toggleHighlight}
      onClick={handleClick}
      dataTestId="text-highlight-button"
    >
      <HighlightToolIcon/>
    </TileToolbarButton>
  );
};
