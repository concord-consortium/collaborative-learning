import classNames from "classnames";
import React from "react";
import { IToolbarButtonModel } from "../models/tiles/toolbar-button";

export interface IButtonProps {
  toolButton: IToolbarButtonModel;
  isActive: boolean;
  isDisabled: boolean;
  onSetToolActive: (tool: IToolbarButtonModel, isActive: boolean) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>, tool: IToolbarButtonModel) => void;
}

export interface IToolbarButtonProps extends IButtonProps {
  onDragStart: (e: React.DragEvent<HTMLDivElement>, tool: IToolbarButtonModel) => void;
  onShowDropHighlight: () => void;
  onHideDropHighlight: () => void;
}

export const ToolbarButtonComponent: React.FC<IToolbarButtonProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick, onDragStart,
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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTileTool && isDisabled) return;
    onClick(e, toolButton);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(e, toolButton);
  };

  const tileEltClass = id.toLowerCase();
  return (
    <div className={classNames("tool", tileEltClass, { active: isActive }, isDisabled ? "disabled" : "enabled")}
        data-testid={`tool-${tileEltClass}`}
        key={id}
        title={title}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDragStart={isTileTool && !isDisabled ? handleDrag : undefined}
        draggable={(isTileTool && !isDisabled) || false}
        onMouseEnter={isTileTool && !isDisabled ? onShowDropHighlight : undefined}
        onMouseLeave={isTileTool && !isDisabled ? onHideDropHighlight : undefined}>
      {Icon && <Icon />}
    </div>
  );
};
