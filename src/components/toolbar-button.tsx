import classNames from "classnames";
import React, { CSSProperties } from "react";
import { IToolbarButtonModel } from "../models/tiles/toolbar-button";

export interface IButtonProps {
  toolButton: IToolbarButtonModel;
  isActive: boolean;
  isDisabled: boolean;
  isPrimary?: boolean;
  height?: number;
  onSetToolActive: (tool: IToolbarButtonModel, isActive: boolean) => void;
  onClick: (e: React.MouseEvent<HTMLButtonElement>, tool: IToolbarButtonModel) => void;
}

export interface IToolbarButtonProps extends IButtonProps {
  onDragStart: (e: React.DragEvent<HTMLButtonElement>, tool: IToolbarButtonModel) => void;
  onShowDropHighlight: () => void;
  onHideDropHighlight: () => void;
}

export const ToolbarButtonComponent: React.FC<IToolbarButtonProps> =
  ({ toolButton, isActive, isDisabled, isPrimary, height, onSetToolActive, onClick, onDragStart,
      onShowDropHighlight, onHideDropHighlight }) => {

  const { id, title, isTileTool, Icon } = toolButton;

  const handleMouseDown = () => {
    if (isDisabled) return;

    onSetToolActive(toolButton, true);

    const endActiveHandler = () => {
      onSetToolActive(toolButton, false);
      document.removeEventListener("mouseup", endActiveHandler, true);
      document.removeEventListener("dragend", endActiveHandler, true);
    };

    document.addEventListener("mouseup", endActiveHandler, true);
    document.addEventListener("dragend", endActiveHandler, true);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    onClick(e, toolButton);
  };

  const handleDrag = (e: React.DragEvent<HTMLButtonElement>) => {
    onDragStart(e, toolButton);
  };

  const showDropHighlight = (isTileTool || id === "duplicate") && !isDisabled;
  const tileEltClass = id.toLowerCase();
  const className = classNames("tool", tileEltClass,
    { active: isActive, primary: isPrimary }, isDisabled ? "disabled" : "enabled");
  const style: CSSProperties =  height ? {height} : {};
  return (
    <button
      aria-disabled={isDisabled || undefined}
      aria-label={title}
      className={className}
      style={style}
      data-testid={`tool-${tileEltClass}`}
      title={title}
      type="button"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDragStart={isTileTool && !isDisabled ? handleDrag : undefined}
      draggable={isTileTool && !isDisabled}
      onMouseEnter={showDropHighlight ? onShowDropHighlight : undefined}
      onMouseLeave={showDropHighlight ? onHideDropHighlight : undefined}
      >
      {Icon && <Icon />}
    </button>
  );
};
