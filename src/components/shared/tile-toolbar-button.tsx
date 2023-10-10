
import React, { ReactNode } from "react";
import { Tooltip } from "react-tippy";
import classNames from "classnames";

import { useTooltipOptions } from "../../hooks/use-tooltip-options";

// This is currently just using the styles provided by the tile
// toolbars that are using this button. If this becomes the base
// toolbar button of all tile toolbars then those styles will
// need to be unified.

interface IProps {
  className?: string;
  children: ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  isDisabled?: boolean;
}
export const TileToolbarButton = ({ className, children, onClick, title, isDisabled }: IProps) => {
  const to = useTooltipOptions({title});
  const classes = classNames("toolbar-button", { disabled: isDisabled }, className);
  const handleClick = (e: React.MouseEvent) => {
    !isDisabled && onClick(e);
    e.stopPropagation();
  };

  return (
    <Tooltip {...to}>
      <button className={classes} onClick={handleClick}>
        {children}
      </button>
    </Tooltip>
  );
};
