import React from "react";
import classNames from "classnames";
import { Tooltip, TooltipProps } from "react-tippy";

import PlacePointIcon from "../assets/numberline-toolbar-point-icon.svg";
import ClearPointsIcon from "../assets/numberline-toolbar-clear-icon.svg"; //undo icon for now
import DeletePointsIcon from "../assets/numberline-toolbar-delete-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";

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

interface ISetNumberlineHandler {
  onClick?: () => void;
}

export const PlacePointButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="place-point"
    icon={<PlacePointIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Place Point"}}
  />
);

export const ClearPointsButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="clear-points"
    icon={<ClearPointsIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Clear Points"}}
  />
);

export const DeletePointButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="delete-points"
    icon={<DeletePointsIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Delete Point(s)"}}
  />
);
