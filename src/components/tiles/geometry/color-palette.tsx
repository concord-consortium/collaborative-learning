import React from "react";
import { ColorSwatch } from "./color-swatch";
import { ClueColor, clueBasicDataColorInfo } from "../../../utilities/color-utils";

import "./color-palette.scss";

interface IProps {
  selectedColor?: number;
  onSelectColor: (color: number) => void;
}

export const ColorPalette: React.FC<IProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <div className="toolbar-palette color-palette">
      <div className="palette-buttons">
        {clueBasicDataColorInfo.map((colorInfo: ClueColor, index) =>
          <ColorSwatch
            key={colorInfo.name}
            name={colorInfo.name}
            color={colorInfo.color}
            index={index}
            isSelected={index === selectedColor}
            onSelectColor={onSelectColor}
          />
        )}
      </div>
    </div>
  );
};
