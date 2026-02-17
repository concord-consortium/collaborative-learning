import classNames from "classnames";
import React from "react";
import { IButtonProps } from "./toolbar-button";
import { useCautionAlert } from "./utilities/use-caution-alert";

interface IProps extends IButtonProps {
  onSetShowDeleteTilesConfirmationAlert: (showAlert: () => void) => void;
  onDeleteSelectedTiles: () => void;
}

export const DeleteButton: React.FC<IProps> =
  ({ toolButton, isActive, isDisabled, onSetToolActive, onClick,
      onSetShowDeleteTilesConfirmationAlert, onDeleteSelectedTiles }) => {

  const { id, title, Icon } = toolButton;

  const handleMouseDown = () => {
    !isDisabled && onSetToolActive(toolButton, true);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    !isDisabled && onClick(e, toolButton);
  };

  const AlertContent = () => {
    return <p>Remove the selected tile(s) from the document? This action is not undoable.</p>;
  };
  const [showAlert] = useCautionAlert({
    title: "Delete Tiles",
    content: AlertContent,
    confirmLabel: "Delete Tiles",
    onConfirm: () => onDeleteSelectedTiles()
  });
  onSetShowDeleteTilesConfirmationAlert(showAlert);

  const classes = classNames("tool", "delete-button", id,
                            { active: isActive }, isDisabled ? "disabled" : "enabled");
  return (
    <button
      aria-disabled={isDisabled || undefined}
      aria-label={title}
      className={classes}
      data-testid="delete-button"
      title={title}
      type="button"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {Icon && <Icon />}
    </button>
  );
};
