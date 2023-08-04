import React from "react";
import classNames from "classnames";
import { Tooltip, TooltipProps } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import PlacePointButton from "./assets/numberline-toolbar-point-icon.svg";

import "./numberline-toolbar.scss";

interface INumberlineButtonProps{
  className?: string;
  icon?: any;
  onClick?: (e:React.MouseEvent) => void;
  tooltipOptions?: TooltipProps
}

const NumberlineButton = ({ className, icon, onClick, tooltipOptions}: INumberlineButtonProps) => {
  const to = useTooltipOptions(tooltipOptions);
  const classes = classNames("toolbar-button", className);
  return (
    <Tooltip {...to}>
      <button className={classes} onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  );
};



interface ISetPlacePoint {
  onClick: () => void;
}

export const SetPlacePoint = ({ onClick }: ISetPlacePoint) => (
  <NumberlineButton
    className="place-point"
    icon={<PlacePointButton/>}
    onClick={onClick}
    tooltipOptions={{ title: "Place Point"}}
  />
);

