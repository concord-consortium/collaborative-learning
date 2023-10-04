import classNames from "classnames";
import React, { MouseEventHandler } from "react";

import "./selection-button.scss";

interface ISelectionButtonProps {
  children?: any;
  onClick: MouseEventHandler<HTMLButtonElement>;
  position?: "left" | "middle" | "right";
  selected?: boolean;
}
export function SelectionButton({ children, onClick, position, selected }: ISelectionButtonProps) {
  const positionClass = position ?? "middle";
  return (
    <button
      className={classNames("selection-button", positionClass, { selected })}
      onClick={onClick}
    >
      { children }
    </button>
  );
}
