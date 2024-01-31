import React from "react";
// icon assets are the ones developed for the table tile
import AddIcon from "../../../assets/icons/add/add.nosvgo.svg";
import RemoveIcon from "../../../assets/icons/remove/remove.nosvgo.svg";

import "./add-remove-icons.scss";

interface IconButtonProps {
  className?: string;
  onClick: React.MouseEventHandler<HTMLDivElement>;
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

const IconButtonBack: React.FC<IconButtonProps> = ({ children, className, ...others }) => {
  return (
    <div className={`icon-button-back ${className}`} {...others}>{children}</div>
  );
};
