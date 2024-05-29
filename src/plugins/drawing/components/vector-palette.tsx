import React from "react";
import { VectorTypeButton } from "./vector-type-button";
import { ToolbarSettings, VectorType } from "../model/drawing-basic-types";


interface IProps {
  selectedVectorType?: VectorType;
  onSelectVectorType: (vectorType: VectorType) => void;
  settings: ToolbarSettings;
}
export function VectorTypePalette ({ selectedVectorType, onSelectVectorType, settings }: IProps) {
  return (
    <div className="toolbar-palette vectors">
      <div className="palette-buttons">
        {Object.values(VectorType).map(type =>
          <VectorTypeButton
            key={type}
            vectorType={type}
            isSelected={type === selectedVectorType}
            onSelectVectorType={onSelectVectorType}
            settings={settings}
          />
        )}
      </div>
    </div>
  );
}
