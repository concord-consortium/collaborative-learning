import React from "react";
import { Tooltip } from "react-tippy";
// icon assets are the ones developed for the table tile
import AddIcon from "../../../assets/icons/add/add.nosvgo.svg";
import RemoveIcon from "../../../assets/icons/remove/remove.nosvgo.svg";
import DeleteSelectionIcon from "../assets/delete-selection-icon.svg";
import DuplicateCardIcon from "../assets/duplicate-card-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";

import "./add-remove-icons.scss";

interface IconButtonProps {
  className?: string;
  onClick: (evt: React.MouseEvent) => void;
}

export const AddIconButton = (props: IconButtonProps) => {
  // console.log("add-remove-icons.tsx > props:", props);
  return (
    <IconButtonBack {...props}>
      <AddIcon />
    </IconButtonBack>
  );
};

export const RemoveIconButton = (props: IconButtonProps) => {
  return (
    <IconButtonBack {...props}>
      <RemoveIcon />
    </IconButtonBack>
  );
};

export const DuplicateCardIconButton = (props: IconButtonProps) => {
  const tooltipOptions = useTooltipOptions({
    distance: 5,
    offset: 5
  });

  return (
    <Tooltip title="Duplicate card" {...tooltipOptions}>
      <IconButtonBack className="duplicate-card-button" {...props}>
        <DuplicateCardIcon />
      </IconButtonBack>
    </Tooltip>
  );
};

export const DeleteAttrIconButton = (props: IconButtonProps) => {
  const tooltipOptions = useTooltipOptions({
    distance: 5,
    offset: 5
  });

  return (
    <Tooltip title="Delete value" {...tooltipOptions}>
      <IconButtonBack className="delete-value-button" {...props}>
        <DeleteSelectionIcon />
      </IconButtonBack>
    </Tooltip>
  );
};

const IconButtonBack: React.FC<IconButtonProps> = ({ children, className, ...others }) => {
  return (
    <div className={`icon-button-back ${className}`} {...others}>{children}</div>
  );
};
