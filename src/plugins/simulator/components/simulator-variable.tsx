import classNames from "classnames";
import React from "react";
import { VariableType } from "@concord-consortium/diagram-view";
import { getIcon } from "../../shared-assets/icons/icon-utilities";
import { getVariableDecimalPlaces, isInputVariable } from "../../shared-variables/simulations/simulation-utilities";
import { getVariableSuffix } from "../simulations/simulation-utilities";

import "./simulator-variable.scss";

interface IVariableIconProps {
  variable?: VariableType;
}
function VariableIcon({ variable }: IVariableIconProps) {
  if (!variable) return null;

  const icon = getIcon(variable.icon);
  const className = classNames("leading-box", { "variable-icon": !!icon });
  return (
    <div className={className}>
      { icon }
    </div>
  );
}

interface ISimulatorVariableProps {
  key?: string;
  variable?: VariableType;
}
export function SimulatorVariable({ variable }: ISimulatorVariableProps) {
  if (!variable) return null;

  const suffix = getVariableSuffix(variable);
  const displayName = variable?.displayName ? `${variable.displayName} ${suffix}` : "";

  // Limit the value to two decimal places
  const value = variable?.currentValue;
  const displayValue = () => {
    if (value === undefined) {
      return "";
    }
    const decimalPlaces = getVariableDecimalPlaces(variable);
    return value?.toFixed(decimalPlaces);
  };
  const displayValueText = `${displayValue()}${variable?.unit ? " " + variable.unit : ""}`;

  const className = isInputVariable(variable) ? "input" : "output";
  const variableClassNames = variable.getAllOfType("className");
  const classes = classNames("simulator-variable", className, variableClassNames);
  return (
    <div className={classes}>
      <div className="display-name">{displayName}</div>
      <div className="value-row">
        <VariableIcon variable={variable} />
        <div className="display-value">{displayValueText}</div>
      </div>
    </div>
  );
}
