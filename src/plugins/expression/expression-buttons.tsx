import React from "react";
import { Tooltip } from "react-tippy";
import DeleteSelectionIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import MixedFractionIcon from "./assets/mixed-fraction-icon.svg";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";

import "./expression-toolbar.scss";

interface IconButtonProps {
  className?: string;
  onClick: (evt: React.MouseEvent) => void;
}

export const DeleteExpressionButton = (props: IconButtonProps) => {
  const tooltipOptions = useTooltipOptions({
    distance: 5,
    offset: 5
  });

  return (
    <Tooltip title="Delete Expression" {...tooltipOptions}>
      <ExpressionButton {...props}>
        <DeleteSelectionIcon />
      </ExpressionButton>
    </Tooltip>
  );
};

export const MixedFractionButton = (props: IconButtonProps) => {
  const tooltipOptions = useTooltipOptions({
    distance: 5,
    offset: 5
  });

  return (
    <Tooltip title="Mixed fraction template" {...tooltipOptions}>
      <ExpressionButton {...props}>
        <MixedFractionIcon />
      </ExpressionButton>
    </Tooltip>
  );
};

const ExpressionButton: React.FC<IconButtonProps> = ({ children, className, ...others }) => {
  return (
    <button className={`expression-button ${className}`} {...others}>{children}</button>
  );
};
