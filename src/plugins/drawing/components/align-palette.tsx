import React from "react";
import { AlignTypeButton } from "./align-type-button";
import { ToolbarSettings, AlignType } from "../model/drawing-basic-types";

interface IProps {
  selectedAlignType?: AlignType;
  onSelectAlignType: (alignType: AlignType) => void;
  settings: ToolbarSettings;
}

export function AlignTypePalette({ selectedAlignType, onSelectAlignType, settings }: IProps) {
  return (
    <div className="toolbar-palette aligns">
      <div className="palette-buttons">
        {Object.values(AlignType).map(type =>
          <AlignTypeButton
            key={type}
            alignType={type}
            isSelected={type === selectedAlignType}
            onSelectAlignType={onSelectAlignType}
            settings={settings}
          />
        )}
      </div>
    </div>
  );
}
