import classNames from "classnames";
import React from "react";
import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";

interface IProps {
  isEnabled?: boolean;
  getLinkIndex: () => number;
  onClick?: () => void;
}
export const LinkGeometryButton: React.FC<IProps> = ({ isEnabled, getLinkIndex, onClick }) => {
  const linkIndex = getLinkIndex();
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
