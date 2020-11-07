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
    <div className="stroke-color-palette">
      <div className="color-swatches">
        {kColors.map(color =>
          <ColorSwatch key={color} color={color}
            isSelected={color === selectedColor}
            onSelectColor={onSelectColor} />
        )}
      </div>
    </div>
  );
};
