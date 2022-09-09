import React from "react";
// icon assets are the ones developed for the table tile
import AddIcon from "../../../assets/icons/add/add.nosvgo.svg";
import RemoveIcon from "../../../assets/icons/remove/remove.nosvgo.svg";
import DeleteSelectionIcon from "../../../assets/icons/delete/delete-selection-icon.svg"

import "./add-remove-icons.scss";

interface IconButtonProps {
  className?: string;
  onClick: (evt: React.MouseEvent) => void;
}

export const AddIconButton = (props: IconButtonProps) => {
  return (
    <IconButtonBack {...props}>
      <AddIcon />
    </IconButtonBack>
  );
};

export const RemoveIconButton = (props: IconButtonProps) => {
  return (
    <IconButtonBack {...props}>
      <RemoveIcon />
    </IconButtonBack>
  );
};

export const DeleteAttrIconButton = (props: IconButtonProps) => {
  return (
    <IconButtonBack className="delete-value-button" {...props}>
      <DeleteSelectionIcon />
    </IconButtonBack>
  );
}

const IconButtonBack: React.FC<IconButtonProps> = ({ children, className, ...others }) => {
  return (
    <div className={`icon-button-back ${className}`} {...others}>{children}</div>
  );
};
