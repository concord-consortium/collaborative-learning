import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { VectorType } from "./vector-palette";
import LineToolIcon from "../assets/line-icon.svg";
import SingleArrowIcon from "../assets/line-single-arrow-icon.svg";
import DoubleArrowIcon from "../assets/line-double-arrow-icon.svg";
import { ToolbarSettings } from "../model/drawing-basic-types";

interface IProps {
  vectorType: VectorType;
  isSelected: boolean;
  onSelectVectorType: (vectorType: VectorType) => void;
  settings: ToolbarSettings;
}
export const VectorTypeButton = observer(
    function VectorTypeButton({ vectorType, isSelected, onSelectVectorType, settings }: IProps) {
  
  return (
    <div className={classNames("vector-type-button", { select: isSelected })} 
         onClick={() => onSelectVectorType(vectorType)}>
      <VectorTypeIcon vectorType={vectorType} settings={settings} />
      <svg className={`highlight ${isSelected ? "select" : ""}`}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 34" width="36" height="34">
        <rect x="1" y="1" width="34" height="32" strokeWidth="2" fill="none"/>
      </svg>
    </div>
  );
});

interface IVectorTypeIconProps {
  vectorType: VectorType;
  settings: ToolbarSettings;
}

export function VectorTypeIcon ({ vectorType, settings }: IVectorTypeIconProps) {
  // SVG attributes to use when drawing the icon.
  // Note that the arrowheads are filled with the stroke color, we don't use settings.fill for this
  const attributes = {
    stroke: settings.stroke, 
    fill: settings.stroke, // uses stroke for fill
    strokeWidth: settings.strokeWidth,
    strokeDasharray: settings.strokeDashArray
  };
  switch(vectorType) {
    case VectorType.line:
      return <LineToolIcon {...attributes} />;
    case VectorType.singleArrow:
      return <SingleArrowIcon {...attributes} />;
    case VectorType.doubleArrow:
      return <DoubleArrowIcon {...attributes} />;
  }
}
