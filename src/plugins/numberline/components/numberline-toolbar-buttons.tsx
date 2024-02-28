import React from "react";
import classNames from "classnames";
import { Tooltip, TooltipProps } from "react-tippy";

import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import SelectIcon from "../assets/numberline-toolbar-select-tool.svg";
import PointIcon from "../assets/numberline-toolbar-point-icon.svg";
import PointOpenIcon from "../assets/numberline-toolbar-point-open-icon.svg";
import ResetIcon from "../assets/numberline-toolbar-reset-icon.svg";
import DeletePointsIcon from "../assets/numberline-toolbar-delete-icon.svg";

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

// export const

//Select
//Point
//Point-Open
//Reset
//Delete

export const SelectButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="select-numberline-toolbar"
    icon={<SelectIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Select Point"}}
  />
);

export const PointButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="point-numberline-toolbar"
    icon={<PointIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Place Point"}}
  />
);

export const PointOpenButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="point-open-numberline-toolbar"
    icon={<PointOpenIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Place Open Point"}}
  />
);

export const ResetButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="reset-numberline-toolbar"
    icon={<ResetIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Reset"}}
  />
);


export const DeleteButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="delete-numberline-toolbar"
    icon={<DeletePointsIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Delete Point(s)"}}
  />
);
