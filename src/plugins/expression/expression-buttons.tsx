import React from "react";
import { Tooltip } from "react-tippy";
import classNames from "classnames";
import DeleteSelectionIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import MixedFractionIcon from "./assets/mixed-fraction-icon.svg";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";

import "./expression-toolbar.scss";
import { expressionButtonsList, getCommand } from "./expression-tile-utils";
import { MathfieldElement } from "mathlive";

interface IconButtonProps {
  className?: string;
  onClick?: (evt: React.MouseEvent | string) => void;
  buttonName?: string;
}

interface AddMathTextButtonProps {
  buttonName?: string;
  enabled?: boolean;
  mf: React.RefObject<MathfieldElement> | undefined;
}

const ExpressionButton: React.FC<IconButtonProps> = ({ children, className, ...others }) => {
  return (
    <button className={`expression-button ${className}`} {...others}>{children}</button>
  );
};

export const AddMathTextButton = (props: AddMathTextButtonProps) => {
  const { mf, buttonName, enabled } = props;
  const button = expressionButtonsList.find((btn) => btn.name === buttonName);
  const tooltipOptions = useTooltipOptions({distance: 5,offset: 5});
  const tooltipText = "Add " + button?.name + " to expression";

  const buttonClasses = classNames(
    "add-math-text",
    button?.className,
    props.enabled ? "enabled" : "disabled"
  );

  const addMathToExpression = () => {
    if (!(mf && mf.current && buttonName)) return;
    const c = getCommand(mf.current, buttonName)
    mf.current.executeCommand(c as any);
    mf.current?.focus();
  };

  return (
    <Tooltip title={tooltipText} {...tooltipOptions}>
      <button onClick={addMathToExpression} className={buttonClasses}>
        {button?.icon}
      </button>
    </Tooltip>
  );
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