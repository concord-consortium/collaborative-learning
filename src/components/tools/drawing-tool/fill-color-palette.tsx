import React from "react";
import { ColorSwatch, SwatchColor } from "./color-swatch";

const kColors: SwatchColor[] = [
  SwatchColor.none,
  SwatchColor.black,
  SwatchColor.red,
  SwatchColor.green,
  SwatchColor.blue,
  SwatchColor.white,
  SwatchColor.gray,
  SwatchColor.orange,
  SwatchColor.yellow,
  SwatchColor.purple
];

interface IProps {
  selectedColor?: string;
  onSelectColor: (color: SwatchColor) => void;
}
export const FillColorPalette: React.FC<IProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <div className="toolbar-palette fill-color">
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
