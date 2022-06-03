import classNames from "classnames";
import React from "react";
import { IButtonProps } from "./tool-button";

interface IProps extends IButtonProps {
  // onSetShowDeleteTilesConfirmationAlert: (showAlert: () => void) => void;
  // onDeleteSelectedTiles: () => void;
}

export const UndoButton: React.FC<IProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick }) => {

  const { id, title, Icon } = toolButton;

  const handleMouseDown = () => {
    !isDisabled && onSetToolActive(toolButton, true);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    !isDisabled && onClick(e, toolButton);
  };

  const classes = classNames("tool", "undo-button", id,
                            { active: isActive }, isDisabled ? "disabled" : "enabled");
  return (
    <div className={classes} data-testid="undo-button"
        key={id}
        title={title}
        onMouseDown={handleMouseDown}
        onClick={handleClick}>
      {Icon && <Icon />}
    </div>
  );
};

export const RedoButton: React.FC<IProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick }) => {

  const { id, title, Icon } = toolButton;

  const handleMouseDown = () => {
    !isDisabled && onSetToolActive(toolButton, true);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    !isDisabled && onClick(e, toolButton);
  };

  const classes = classNames("tool", "redo-button", id,
                            { active: isActive }, isDisabled ? "disabled" : "enabled");
  return (
    <div className={classes} data-testid="redo-button"
        key={id}
        title={title}
        onMouseDown={handleMouseDown}
        onClick={handleClick}>
      {Icon && <Icon />}
    </div>
  );
};
