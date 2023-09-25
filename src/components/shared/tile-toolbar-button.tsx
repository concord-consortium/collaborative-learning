
import React, { ReactNode } from "react";
import { Tooltip, TooltipProps } from "react-tippy";
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
  tooltipOptions: TooltipProps;
}
export const TileToolbarButton = ({ className, children, onClick, tooltipOptions }: IProps) => {
  const to = useTooltipOptions(tooltipOptions);
  const classes = classNames("toolbar-button", className);
  return (
    <Tooltip {...to}>
      <button className={classes} onClick={onClick}>
        {children}
      </button>
    </Tooltip>
  );
};
