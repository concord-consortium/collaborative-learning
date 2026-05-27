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

/**
 * A single color choice in the geometry tile's color palette. Rendered as
 * `<div role="button">` because the palette is a child of the Color toolbar
 * <button> and nesting buttons is invalid HTML; aria-label/aria-pressed +
 * the Enter/Space handler replicate the semantics a real button would have.
 */
export const ColorSwatch: React.FC<IProps> = ({ color, isSelected, onSelectColor, index, name }) => {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onSelectColor(index);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={classNames("color-swatch", name, { selected: isSelected })}
      aria-label={name}
      aria-pressed={isSelected}
      onClick={() => onSelectColor(index)}
      onKeyDown={handleKeyDown}
    >
      <div className={classNames("color-icon", name)} />
      <SwatchCheckIcon/>
    </div>
  );
};
