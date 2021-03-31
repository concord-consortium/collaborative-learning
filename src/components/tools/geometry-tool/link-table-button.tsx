import classNames from "classnames";
import React from "react";
import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";

import "./link-table-button.scss";

interface IProps {
  isEnabled?: boolean;
  onClick?: () => void;
}
export const LinkTableButton: React.FC<IProps> = ({ isEnabled, onClick }) => {
  const classes = classNames("link-table-button", { disabled: !isEnabled });
  const handleClick = (e: React.MouseEvent) => {
    isEnabled && onClick?.();
    e.stopPropagation();
  };
  return (
    <div key="table-link-button" className={classes} onClick={handleClick}>
      <LinkTableIcon />
    </div>
  );
};
