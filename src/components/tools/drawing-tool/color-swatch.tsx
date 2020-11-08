import classNames from "classnames";
import React from "react";
import SwatchCheckIcon from "../../../clue/assets/icons/drawing/check-icon.svg";
import NoColorIcon from "../../../clue/assets/icons/drawing/no-color-icon.svg";
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
  purple = "#d100d1"
}

interface IProps {
  color: SwatchColor;
  isSelected: boolean;
  onSelectColor: (color: SwatchColor) => void;
}
export const ColorSwatch: React.FC<IProps> = ({ color, isSelected, onSelectColor }) => {
  const isNoneColor = color === SwatchColor.none;
  const isLightColor = !isNoneColor && isLightColorRequiringContrastOffset(color);
  return (
    <div className={classNames("color-swatch", { light: isLightColor })} onClick={() => onSelectColor(color)}>
      {isNoneColor
        ? <NoColorIcon />
        : <svg className="swatch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30">
            <circle cx="15" cy="15" r="11" fill={color}/>
          </svg>}
      {!isNoneColor && isSelected && <SwatchCheckIcon />}
      {isLightColor &&
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
