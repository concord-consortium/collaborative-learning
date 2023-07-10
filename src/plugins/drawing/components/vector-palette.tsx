import React from "react";
import { VectorTypeButton } from "./vector-type-button";
import { ToolbarSettings } from "../model/drawing-basic-types";

export enum VectorType {
  line = "line",
  singleArrow = "arrow",
  doubleArrow ="doublearrow"
}

const kVectorTypes: VectorType[] = [
   VectorType.line,
   VectorType.singleArrow,
   VectorType.doubleArrow
];

interface IProps {
  selectedVectorType?: string;
  onSelectVectorType: (vectorType: VectorType) => void;
  settings: ToolbarSettings;
}
export function VectorTypePalette ({ selectedVectorType, onSelectVectorType, settings }: IProps) {
  return (
    <div className="toolbar-palette vectors one-row">
      <div className="palette-buttons">
        {kVectorTypes.map(type => 
          <div className="color-swatch">
            <VectorTypeButton key={type} vectorType={type} isSelected={type === selectedVectorType} onSelectVectorType={onSelectVectorType} settings={settings} />
          </div>
        )}
      </div>
    </div>
  );
};
