import classNames from "classnames";
import React from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";

interface IProps {
  isEnabled?: boolean;
  onClick?: () => void;
}
export const LinkGeometryButton: React.FC<IProps> = ({ isEnabled, onClick }) => {
  const classes = classNames("link-geometry-button", { disabled: !isEnabled });
  const handleClick = (e: React.MouseEvent) => {
    isEnabled && onClick?.();
    e.stopPropagation();
  };
  return (
    <div className={classes}>
      <LinkGraphIcon onClick={handleClick}/>
    </div>
  );
};
