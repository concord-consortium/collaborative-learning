import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { ToolbarSettings, VectorType } from "../model/drawing-basic-types";
import { VectorTypeIcon } from "../objects/vector";

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


