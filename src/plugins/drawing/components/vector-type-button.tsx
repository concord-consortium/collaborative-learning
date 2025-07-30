import React from "react";
import { observer } from "mobx-react";
import { ToolbarSettings, VectorType, getVectorTypeIcon, getVectorTypeTooltip } from "../model/drawing-basic-types";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { ToolbarButtonSvg } from "../toolbar-buttons/toolbar-button-svg";

interface IProps {
  vectorType: VectorType;
  isSelected: boolean;
  onSelectVectorType: (vectorType: VectorType) => void;
  settings: ToolbarSettings;
}
export const VectorTypeButton = observer(
  function VectorTypeButton({ vectorType, isSelected, onSelectVectorType, settings }: IProps) {

  const icon = getVectorTypeIcon(vectorType);
  const tooltip = getVectorTypeTooltip(vectorType);

  // Arrowhead shapes should be drawn entirely with the stroke color
  const modSettings: ToolbarSettings = {
    fill: settings.stroke,
    stroke: settings.stroke,
    strokeDashArray: settings.strokeDashArray,
    strokeWidth: settings.strokeWidth,
    vectorType: settings.vectorType,
    alignType: settings.alignType
  };

  return (
    <TileToolbarButton
      name={"vector-" + vectorType}
      title={tooltip}
      selected={isSelected}
      onClick={() => onSelectVectorType(vectorType)}
    >
      <ToolbarButtonSvg SvgIcon={icon} settings={modSettings}/>
    </TileToolbarButton>
  );
});
