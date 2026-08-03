import classNames from "classnames";
import React from "react";
import SwatchCheckIcon from "../assets/check-icon.svg";
import NoColorIcon from "../assets/no-color-icon.svg";
import { isLightColorRequiringContrastOffset } from "../../../utilities/color-utils";

export enum SwatchColor {
  none = "none",
  black = "#000000",
  white = "#ffffff",
  red = "#eb0000",
  green = "#008a00",
  blue = "#0000ff",
  gray = "#bfbfbf",
  orange = "#ff8415",
  yellow = "#ffff00",
  purple = "#d100d1",
  // Pastels synced with the Dataflow blocks and Diagram/variable chips (fill palette only). lightBlue/
  // lightPurple/lightYellow share their hex with dataflow-vars.scss $operator-blue/$input-purple/
  // $output-yellow and the chip theme; keep them in step (guarded by fill-color-palette.test.tsx).
  paleGray = "#d4d4d4",
  lightOrange = "#ffc7bf",
  lightGreen = "#b7e690",
  lightBlue = "#addef4",
  lightPurple = "#a5b2ff",
  lightYellow = "#f7e58f"
}

interface IProps {
  color: SwatchColor;
  isSelected: boolean;
  onSelectColor: (color: SwatchColor) => void;
  // Force the 1px outline regardless of luminance (the pastel fill row always needs it against the
  // light palette background). Luminance-light colors get the outline either way.
  outlined?: boolean;
}
export const ColorSwatch: React.FC<IProps> = ({ color, isSelected, onSelectColor, outlined }) => {
  const isNoneColor = color === SwatchColor.none;
  const isLightColor = !isNoneColor && isLightColorRequiringContrastOffset(color);
  const showBorder = isLightColor || !!outlined;
  return (
    <div className={classNames("color-swatch", { light: isLightColor, outlined })} onClick={() => onSelectColor(color)}>
      {isNoneColor
        ? <NoColorIcon />
        : <svg className="swatch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30">
            <circle cx="15" cy="15" r="11" fill={color}/>
          </svg>}
      {!isNoneColor && isSelected && <SwatchCheckIcon />}
      {showBorder &&
        <svg className="contrast-border" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30">
          <circle cx="15" cy="15" r="10.5" strokeWidth="1" fill="none"/>
        </svg>}
      <svg className={`highlight ${isSelected ? "select" : ""}`}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30">
        <circle cx="15" cy="15" r="13" strokeWidth="2" fill="none"/>
      </svg>
    </div>
  );
};
