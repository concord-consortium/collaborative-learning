import React from "react";
import classNames from "classnames";
import SwatchCheckIcon from "../../../clue/assets/icons/geometry/check-icon.svg";

interface IProps {
  color: string;
  name: string;
  isSelected: boolean;
  index: number;
  onSelectColor: (index: number) => void;
}

export const ColorSwatch: React.FC<IProps> = ({ color, isSelected, onSelectColor, index, name }) => {

  return (
    <div
      className={classNames("color-swatch",
      { selected: isSelected })}
      onClick={() =>
      onSelectColor(index)}
    >
      <div className={classNames("color-icon", name)} />
      <SwatchCheckIcon/>
    </div>
  );
}