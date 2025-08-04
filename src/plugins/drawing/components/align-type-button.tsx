import React from "react";
import { observer } from "mobx-react";
import { ToolbarSettings, AlignType } from "../model/drawing-basic-types";
import { getAlignTypeIcon, getAlignTypeTooltip } from "../model/drawing-icons";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { ToolbarButtonSvg } from "../toolbar-buttons/toolbar-button-svg";

interface IProps {
  alignType: AlignType;
  isSelected: boolean;
  onSelectAlignType: (alignType: AlignType) => void;
  settings: ToolbarSettings;
}

export const AlignTypeButton = observer(
  function AlignTypeButton({ alignType, isSelected, onSelectAlignType, settings }: IProps) {

  const icon = getAlignTypeIcon(alignType);
  const tooltip = getAlignTypeTooltip(alignType);

  return (
    <TileToolbarButton
      name={"align-" + alignType}
      title={tooltip}
      selected={isSelected}
      onClick={() => onSelectAlignType(alignType)}
    >
      <ToolbarButtonSvg SvgIcon={icon}/>
    </TileToolbarButton>
  );
});
