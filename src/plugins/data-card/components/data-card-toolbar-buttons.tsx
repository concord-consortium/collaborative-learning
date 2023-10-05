import React from "react";
import { Tooltip, TooltipProps } from "react-tippy";
import classNames from "classnames";

import LinkGraphIcon from "../../../clue/assets/icons/table/link-graph-icon.svg";
import DuplicateCardIcon from "../assets/duplicate-card-icon.svg";
import DeleteSelectionIcon from "../assets/delete-selection-icon.svg";
import MergeInIcon from "../assets/merge-in-icon.svg";
import GraphIcon from "../../../assets/icons/view-data-as-graph-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";

interface IToolbarButtonProps {
  className?: string;
  icon: any;
  tooltipOptions: TooltipProps;
  onClick: (e: React.MouseEvent) => void;
}
const ToolbarButton = ({ className, icon, onClick, tooltipOptions}: IToolbarButtonProps) => {
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

interface IDuplicateDataCardButtonProps {
  onClick?: () => void;
}
export const DuplicateCardButton = ({ onClick }: IDuplicateDataCardButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    onClick?.();
    e.stopPropagation();
  };
  return (
    <ToolbarButton
      className="duplicate-data-card-button"
      icon={<DuplicateCardIcon />}
      onClick={handleClick}
      tooltipOptions={{ title: "Duplicate card" }}
    />
  );
};

interface IDeleteAttrButtonProps {
  onClick?: () => void;
}
export const DeleteAttrButton = ({ onClick }: IDeleteAttrButtonProps) => {
  const handleClick = (e: React.MouseEvent) => {
    onClick?.();
    e.stopPropagation();
  };
  return (
    <ToolbarButton
      className="delete-value-button"
      icon={<DeleteSelectionIcon />}
      onClick={handleClick}
      tooltipOptions={{ title: "Delete value" }}
    />
  );
};

interface ILinkDataCardButtonProps {
  isEnabled?: boolean;
  onClick?: () => void;
}
export const LinkTileButton = ({ isEnabled, onClick }: ILinkDataCardButtonProps) => {
  const classes = classNames("link-tile-button", { disabled: !isEnabled });
  const handleClick = (e: React.MouseEvent) => {
    isEnabled && onClick?.();
    e.stopPropagation();
  };
  return (
    <ToolbarButton
      className={classes}
      icon={<LinkGraphIcon />}
      onClick={handleClick}
      tooltipOptions={{ title: "Link data card" }}
    />
  );
};

interface IMergeDataButtonProps {
  isEnabled?: boolean;
  onClick?: () => void;
}
export const MergeInButton = ({ isEnabled, onClick }: IMergeDataButtonProps) => {
  const classes = classNames("merge-data-button", { disabled: !isEnabled });
  const handleClick = (e: React.MouseEvent) => {
    isEnabled && onClick?.();
    e.stopPropagation();
  };
  return (
    <ToolbarButton
      className={classes}
      icon={<MergeInIcon />}
      onClick={handleClick}
      tooltipOptions={{ title: "Add Data from..." }}
    />
  );
};

interface IViewInGraphButtonProps {
  isEnabled?: boolean;
  onClick?: () => void;
}
export const ViewInGraphButton = ({ isEnabled, onClick }: IViewInGraphButtonProps) => {
  const classes = classNames("view-in-graph-button", { disabled: !isEnabled });
  const handleClick = (e: React.MouseEvent) => {
    isEnabled && onClick?.();
    e.stopPropagation();
  };
  return (
    <ToolbarButton
      className={classes}
      icon={<GraphIcon />}
      onClick={handleClick}
      tooltipOptions={{ title: "View Data as Graph" }}
    />
  );
};
