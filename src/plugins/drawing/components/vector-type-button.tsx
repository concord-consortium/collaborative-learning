import React from "react";
import { observer } from "mobx-react";
import { ToolbarSettings, VectorType, getVectorTypeIcon, getVectorTypeTooltip } from "../model/drawing-basic-types";
import { SvgToolbarButton } from "./drawing-toolbar-buttons";

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

    return <SvgToolbarButton SvgIcon={icon} buttonClass="vector-type"
      title={tooltip} selected={isSelected} settings={settings}   
      onClick={() => onSelectVectorType(vectorType)} />;
});


