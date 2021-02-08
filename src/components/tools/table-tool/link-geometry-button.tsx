import classNames from "classnames";
import React from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";

interface IProps {
  linkIndex: number;
  isEnabled?: boolean;
  onClick?: () => void;
}
export const LinkGeometryButton: React.FC<IProps> = ({ isEnabled, linkIndex, onClick }) => {
  const classes = classNames("link-geometry-button", `link-color-${linkIndex}`, { disabled: !isEnabled });
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
