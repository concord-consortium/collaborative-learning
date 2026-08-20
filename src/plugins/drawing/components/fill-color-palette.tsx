import React from "react";
import { ColorSwatch, SwatchColor } from "./color-swatch";

// The fill palette is two rows (grid-aligned via drawing-toolbar.scss). Top: bold colors ending with
// yellow. Bottom: white then the 6 pastels synced with the Dataflow blocks and Diagram/variable chips;
// each bottom swatch always carries the 1px outline so it reads against the light palette background.
const kTopRow: SwatchColor[] = [
  SwatchColor.none, SwatchColor.black, SwatchColor.red, SwatchColor.green,
  SwatchColor.blue, SwatchColor.purple, SwatchColor.orange, SwatchColor.yellow
];
const kBottomRow: SwatchColor[] = [
  SwatchColor.white, SwatchColor.paleGray, SwatchColor.lightOrange, SwatchColor.lightGreen,
  SwatchColor.lightBlue, SwatchColor.lightPurple, SwatchColor.lightYellow
];
export const kColors: SwatchColor[] = [...kTopRow, ...kBottomRow];

interface IProps {
  selectedColor?: string;
  onSelectColor: (color: SwatchColor) => void;
}
export const FillColorPalette: React.FC<IProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <div className="toolbar-palette fill-color">
      <div className="palette-buttons">
        {kColors.map(color =>
          <ColorSwatch key={color} color={color}
            isSelected={color === selectedColor}
            outlined={kBottomRow.includes(color)}
            onSelectColor={onSelectColor} />
        )}
      </div>
    </div>
  );
};
