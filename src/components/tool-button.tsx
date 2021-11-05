import classNames from "classnames";
import React from "react";
import { IconComponent } from "../app-config-context";
import { DocumentTool } from "../models/document/document";
import { ToolButtonSnapshot } from "../models/tools/tool-types";

export type IToolButtonConfig = ToolButtonSnapshot & {
  icon?: IconComponent;
};

export interface IButtonProps {
  config: IToolButtonConfig;
  ToolIcon?: IconComponent;
  isActive: boolean;
  isDisabled: boolean;
  onSetToolActive: (tool: DocumentTool, isActive: boolean) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>, tool: DocumentTool) => void;
}

export interface IToolButtonProps extends IButtonProps {
  onDragStart: (e: React.DragEvent<HTMLDivElement>, tool: DocumentTool) => void;
  onShowDropHighlight: () => void;
  onHideDropHighlight: () => void;
}

export const ToolButtonComponent: React.FC<IToolButtonProps> =
  ({ config, ToolIcon, isActive, isDisabled, onSetToolActive, onClick, onDragStart,
      onShowDropHighlight, onHideDropHighlight }) => {

  const { name, title, isTileTool } = config;
  const toolName = name as DocumentTool;

  const handleMouseDown = () => {
    if (isDisabled) return;

    onSetToolActive(toolName, true);

    const endActiveHandler = () => {
      onSetToolActive(toolName, false);
      document.removeEventListener("mouseup", endActiveHandler, true);
      document.removeEventListener("dragend", endActiveHandler, true);
    };

    document.addEventListener("mouseup", endActiveHandler, true);
    document.addEventListener("dragend", endActiveHandler, true);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick(e, toolName);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(e, toolName);
  };

  return (
    <div className={classNames("tool", toolName, { active: isActive }, isDisabled ? "disabled" : "enabled")}
        data-testid={`tool-${toolName}`}
        key={name}
        title={title}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDragStart={isTileTool ? handleDrag : undefined}
        draggable={isTileTool || false}
        onMouseEnter={isTileTool ? onShowDropHighlight : undefined}
        onMouseLeave={isTileTool ? onHideDropHighlight : undefined}>
      {ToolIcon && <ToolIcon />}
    </div>
  );
};
