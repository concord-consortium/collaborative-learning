import classNames from "classnames";
import React, { ReactNode } from "react";
import { observer } from "mobx-react";
import { VectorType } from "./vector-palette";
import LineToolIcon from "../assets/line-icon.svg";
import SingleArrowIcon from "../assets/line-single-arrow-icon.svg"
import DoubleArrowIcon from "../assets/line-double-arrow-icon.svg"
import { ToolbarSettings } from "../model/drawing-basic-types";

interface IProps {
  vectorType: VectorType;
  isSelected: boolean;
  onSelectVectorType: (vectorType: VectorType) => void;
  settings: ToolbarSettings;
}
export const VectorTypeButton = observer(function VectorTypeButton({ vectorType, isSelected, onSelectVectorType, settings }: IProps) {
  let icon: ReactNode;
  switch(vectorType) {
    case VectorType.line:
      icon = <LineToolIcon {...settings} />;
      break;
    case VectorType.singleArrow:
      icon = <SingleArrowIcon {...settings} />;
      break;
    case VectorType.doubleArrow:
      icon = <DoubleArrowIcon {...settings} />;
      break;
  };
  return (
    <div className={classNames("vector-type-button", { select: isSelected })} onClick={() => onSelectVectorType(vectorType)}>
      {icon}
      <svg className={`highlight ${isSelected ? "select" : ""}`}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 34" width="36" height="34">
        <rect x="1" y="1" width="34" height="32" strokeWidth="2" fill="none"/>
      </svg>
    </div>
  );
});
