import classNames from "classnames";
import React from "react";
import { IButtonProps } from "./toolbar-button";



export const UndoButton: React.FC<IButtonProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick }) => {

  const { id, title, Icon } = toolButton;

  // Prevent mouse clicks from stealing focus away from document content
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      onSetToolActive(toolButton, true);
      onClick(e, toolButton);
    }
  };

  const classes = classNames("tool", "undo-button", id,
                            { active: isActive }, isDisabled ? "disabled" : "enabled");
  return (
    <button
      aria-disabled={isDisabled || undefined}
      aria-label={title}
      className={classes}
      data-testid="undo-button"
      title={title}
      type="button"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {Icon && <Icon />}
    </button>
  );
};

export const RedoButton: React.FC<IButtonProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick }) => {

  const { id, title, Icon } = toolButton;

  // Prevent mouse clicks from stealing focus away from document content
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      onSetToolActive(toolButton, true);
      onClick(e, toolButton);
    }
  };

  const classes = classNames("tool", "redo-button", id,
                            { active: isActive }, isDisabled ? "disabled" : "enabled");
  return (
    <button
      aria-disabled={isDisabled || undefined}
      aria-label={title}
      className={classes}
      data-testid="redo-button"
      title={title}
      type="button"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {Icon && <Icon />}
    </button>
  );
};
