import React from "react";
import { ColorSwatch, SwatchColor } from "./color-swatch";

const kColors: SwatchColor[] = [
  SwatchColor.black,
  SwatchColor.red,
  SwatchColor.green,
  SwatchColor.blue,
  SwatchColor.gray,
  SwatchColor.orange,
  SwatchColor.yellow,
  SwatchColor.purple
];

interface IProps {
  selectedColor?: string;
  onSelectColor: (color: SwatchColor) => void;
}
export const StrokeColorPalette: React.FC<IProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <div className="toolbar-palette stroke-color">
      <div className="palette-buttons">
        {kColors.map(color =>
          <ColorSwatch key={color} color={color}
            isSelected={color === selectedColor}
            onSelectColor={onSelectColor} />
        )}
      </div>
    </div>
  );
};
