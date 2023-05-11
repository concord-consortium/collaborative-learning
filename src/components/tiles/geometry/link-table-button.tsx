import classNames from "classnames";
import React from "react";
import LinkTableIcon from "../../../clue/assets/icons/geometry/link-table-icon.svg";

import "./link-table-button.scss";

//TODO: dataflow-program-link-table-button.tsx is very similar
//consider refactoring -> https://www.pivotaltracker.com/n/projects/2441242/stories/184992684

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
    <div key="table-link-button" className={classes} data-testid="table-link-button" onClick={handleClick}>
      <LinkTableIcon />
    </div>
  );
};
