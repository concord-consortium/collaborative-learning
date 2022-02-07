import classNames from "classnames";
import React from "react";
import { ToolButtonModelType } from "../models/tools/tool-button";

export interface IButtonProps {
  toolButton: ToolButtonModelType;
  isActive: boolean;
  isDisabled: boolean;
  onSetToolActive: (tool: ToolButtonModelType, isActive: boolean) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>, tool: ToolButtonModelType) => void;
}

export interface IToolButtonProps extends IButtonProps {
  onDragStart: (e: React.DragEvent<HTMLDivElement>, tool: ToolButtonModelType) => void;
  onShowDropHighlight: () => void;
  onHideDropHighlight: () => void;
}

export const ToolButtonComponent: React.FC<IToolButtonProps> =
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
    onClick(e, toolButton);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(e, toolButton);
  };

  const toolTileClass = id.toLowerCase();
  return (
    <div className={classNames("tool", toolTileClass, { active: isActive }, isDisabled ? "disabled" : "enabled")}
        data-testid={`tool-${toolTileClass}`}
        key={id}
        title={title}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDragStart={isTileTool ? handleDrag : undefined}
        draggable={isTileTool || false}
        onMouseEnter={isTileTool ? onShowDropHighlight : undefined}
        onMouseLeave={isTileTool ? onHideDropHighlight : undefined}>
      {Icon && <Icon />}
    </div>
  );
};
