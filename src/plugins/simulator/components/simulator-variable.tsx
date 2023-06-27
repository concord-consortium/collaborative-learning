import classNames from "classnames";
import React from "react";
import { VariableType } from "@concord-consortium/diagram-view";

import { inputVariableNamePart, outputVariableNamePart } from "../../shared-variables/simulations/simulation-utilities";

// TODO: This should be defined in the simulation.
import { kEMGKey, kGripperKey, kPressureKey } from "../simulations/brainwaves-gripper";
import EMGIcon from "../../dataflow/assets/icons/control/signal.svg";
import GripperIcon from "../../dataflow/assets/icons/output/grabber.svg";
import PressureIcon from "../../dataflow/assets/icons/sensor/pressure.svg";

import "./simulator-variable.scss";

function variableIcon(variable: VariableType) {
  const name = variable.name ?? "";
  if ([kEMGKey, kGripperKey, kPressureKey].includes(name)) {
    return (
      <div className="variable-icon">
        {
          name === kEMGKey
            ? <EMGIcon />
            : name === kGripperKey
            ? <GripperIcon />
            : name === kPressureKey
            ? <PressureIcon />
            : null
        }
      </div>
    );
  } else {
    return <div className="leading-box" />;
  }
}

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
      { variable && variableIcon(variable) }
      <div>{variableDisplay}</div>
    </div>
  );
}
