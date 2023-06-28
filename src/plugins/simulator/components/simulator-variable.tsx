import classNames from "classnames";
import React from "react";
import { VariableType } from "@concord-consortium/diagram-view";

import { isInputVariable } from "../../shared-variables/simulations/simulation-utilities";

// TODO: This should be defined in the simulation.
import { kEMGKey, kGripperKey, kPressureKey } from "../simulations/brainwaves-gripper";
import EMGIcon from "../../shared-assets/icons/dataflow/control/signal.svg";
import GripperIcon from "../../shared-assets/icons/dataflow/output/grabber.svg";
import PressureIcon from "../../shared-assets/icons/dataflow/sensor/pressure.svg";

import "./simulator-variable.scss";

function variableIcon(variable: VariableType) {
  const id = variable.id ?? "";
  const useIcon = [kEMGKey, kGripperKey, kPressureKey].includes(id);
  const children = id === kEMGKey
    ? <EMGIcon />
    : id === kGripperKey
    ? <GripperIcon />
    : id === kPressureKey
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
  key?: string;
  variable?: VariableType;
}
export function SimulatorVariable({ variable }: ISimulatorVariableProps) {
  if (!variable) return null;

  const inputVariable = isInputVariable(variable);
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
