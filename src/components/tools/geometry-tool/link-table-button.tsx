// import classNames from "classnames";
import React from "react";
import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";

import "./link-table-button.scss";

interface IProps {
  isEnabled?: boolean;
  getLinkIndex?: () => number;
  onClick?: () => void;
}
export const LinkTableButton: React.FC<IProps> = ({ isEnabled, getLinkIndex, onClick }) => {
  // const linkIndex = getLinkIndex();
  // const classes = classNames("link-table-button", `link-color-${linkIndex}`, { disabled: !isEnabled });
  // const classes = classNames("link-table-button", `link-color-${linkIndex}`);

  const handleClick = (e: React.MouseEvent) => {
    isEnabled && onClick?.();
    e.stopPropagation();
  };
  return (
    <div className={"link-table-button"} onClick={handleClick}>
      <LinkTableIcon />
    </div>
  );
};