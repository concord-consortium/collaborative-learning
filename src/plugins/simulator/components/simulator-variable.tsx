import classNames from "classnames";
import React from "react";
import { VariableType } from "@concord-consortium/diagram-view";

// TODO: This should be defined in the simulation.
import { kEMGKey, kGripperKey, kPressureKey } from "../simulations/brainwaves-gripper";
import EMGIcon from "../../dataflow/assets/icons/control/signal.svg";
import GripperIcon from "../../dataflow/assets/icons/output/grabber.svg";
import PressureIcon from "../../dataflow/assets/icons/sensor/pressure.svg";

import "./simulator-variable.scss";

function variableIcon(variable: VariableType) {
  const name = variable.name ?? "";
  const useIcon = [kEMGKey, kGripperKey, kPressureKey].includes(name);
  const children = name === kEMGKey
    ? <EMGIcon />
    : name === kGripperKey
    ? <GripperIcon />
    : name === kPressureKey
    ? <PressureIcon />
    : null;
  const className = classNames("leading-box", { "variable-icon": useIcon });
  return (
    <div className={className}>
      { children }
    </div>
  );
}

interface ISimulatorVariableProps {
  inputVariable?: boolean; // Assume output variable if inputVariable isn't true
  key?: string;
  variable?: VariableType;
}
export function SimulatorVariable({ inputVariable, variable }: ISimulatorVariableProps) {
  const suffix = inputVariable ? "Sensor" : "Output";
  const displayName = variable?.displayName ? `${variable.displayName} ${suffix}` : "";

  // Limit the value to two decimal places
  const value = variable?.value;
  const scaleFactor = 100;
  const displayValue = value !== undefined ? Math.round(value * scaleFactor) / scaleFactor : "";

  const variableDisplay = `${displayName}: ${displayValue}`;

  const className = inputVariable ? "input" : "output";
  const classes = classNames("simulator-variable", className);
  return (
    <div className={classes}>
      { variable && variableIcon(variable) }
      <div>{variableDisplay}</div>
    </div>
  );
}
