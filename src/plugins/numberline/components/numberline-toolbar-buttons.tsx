import React from "react";
import classNames from "classnames";
import { Tooltip, TooltipProps } from "react-tippy";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import SelectIcon from "../assets/numberline-toolbar-select-tool.svg";
import PointIcon from "../assets/numberline-toolbar-point-icon.svg";
import PointOpenIcon from "../assets/numberline-toolbar-point-open-icon.svg";
import ResetIcon from "../assets/numberline-toolbar-reset-icon.svg";
import DeleteIcon from "../assets/numberline-toolbar-delete-icon.svg";
//TODO: Eventually we want to swap the DeleteIcon (X) with the DeleteSelectionIcon
//      keep DeleteIcon until we are already ready to change the main Toolbar Delete Tile Icon
//      import DeleteSelectionIcon from "../assets/numberline-toolbar-delete-selection-icon.svg";

import "./numberline-toolbar.scss";

interface INumberlineButtonProps{
  className?: string;
  icon?: JSX.Element;
  onClick?: (e:React.MouseEvent) => void;
  tooltipOptions?: TooltipProps
  selected?: boolean;

}

const NumberlineButton = ({ className, icon, onClick, tooltipOptions, selected}: INumberlineButtonProps) => {
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
  selected?: boolean;
}

export const SelectButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="select-button"
    icon={<SelectIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Select Point"}}

  />
);

export const PointButton = ({ onClick }: ISetNumberlineHandler) => {
  return (
    <NumberlineButton
      className="point-button"
      icon={<PointIcon/>}
      onClick={onClick}
      tooltipOptions={{ title: "Place Point"}}
    />
  );
};



export const PointOpenButton = ({ onClick, selected }: ISetNumberlineHandler) => {
  console.log("point open button with selected:", selected);
  return (
    <NumberlineButton
      className={classNames('point-open-button', {selected})}
      icon={<PointOpenIcon/>}
      onClick={onClick}
      tooltipOptions={{ title: "Place Open Point"}}
    />
  );
};

export const ResetButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="reset-button"
    icon={<ResetIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Reset"}}
  />
);


export const DeleteButton = ({ onClick }: ISetNumberlineHandler) => (
  <NumberlineButton
    className="delete-button"
    icon={<DeleteIcon/>}
    onClick={onClick}
    tooltipOptions={{ title: "Delete Point(s)"}}
  />
);
