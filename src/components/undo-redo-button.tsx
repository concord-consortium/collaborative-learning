import classNames from "classnames";
import React from "react";
import { IButtonProps } from "./tool-button";



export const UndoButton: React.FC<IButtonProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick }) => {

  const { id, title, Icon } = toolButton;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if(!isDisabled) {
      onSetToolActive(toolButton, true);
      onClick(e, toolButton);
    }
  };

  const classes = classNames("tool", "undo-button", id,
                            { active: isActive }, isDisabled ? "disabled" : "enabled");
  return (
    <div className={classes} data-testid="undo-button" key={id} title={title}
          onMouseDown={handleMouseDown}>
      {Icon && <Icon />}
    </div>
  );
};

export const RedoButton: React.FC<IButtonProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick }) => {

  const { id, title, Icon } = toolButton;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if(!isDisabled) {
      onSetToolActive(toolButton, true);
      onClick(e, toolButton);
    }
  };

  const classes = classNames("tool", "redo-button", id,
                            { active: isActive }, isDisabled ? "disabled" : "enabled");
  return (
    <div className={classes} data-testid="redo-button" key={id} title={title}
          onMouseDown={handleMouseDown}>
      {Icon && <Icon />}
    </div>
  );
};
