import classNames from "classnames";
import React from "react";
import { VariableType } from "@concord-consortium/diagram-view";

import { inputVariableNamePart, outputVariableNamePart } from "../../shared-variables/simulations/simulation-utilities";

import "./simulator-variable.scss";

interface ISimulatorVariableProps {
  inputVariable?: boolean; // Assume output variable if inputVariable isn't true
  key?: string;
  variable?: VariableType;
}
export function SimulatorVariable({ inputVariable, variable }: ISimulatorVariableProps) {
  const nameFunction = inputVariable ? inputVariableNamePart : outputVariableNamePart;
  const suffix = inputVariable ? "Sensor" : "Output";
  const displayName = variable?.name ? `${nameFunction(variable)?.replace("_", " ")} ${suffix}` : "";

  // Limit the value to two decimal places
  const value = variable?.value;
  const scaleFactor = 100;
  const displayValue = value !== undefined ? Math.round(value * scaleFactor) / scaleFactor : "";

  const variableDisplay = variable?.name ? `${displayName}: ${displayValue}` : "";

  const className = inputVariable ? "input" : "output";
  const classes = classNames("simulator-variable", className);
  return (
    <div className={classes}>
      <div className="leading-box" />
      <div>{variableDisplay}</div>
    </div>
  );
}
