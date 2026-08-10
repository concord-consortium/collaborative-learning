import Slider from "rc-slider";
import React from "react";
import { VariableType } from "@concord-consortium/diagram-view";
import { logSimulatorVariableChange } from "../../simulator-logging";
import "rc-slider/assets/index.css";

interface ISimulatorSliderProps {
  className?: string;
  max: number;
  min: number;
  step: number;
  variable?: VariableType;
  // All of the tile's variables, snapshotted into the logged event on release.
  variables: VariableType[];
  tileId?: string;
}

// CLUE-owned replacement for diagram-view's VariableSlider. Reproduces its
// behavior (setTemporaryValue while dragging, commitTemporaryValue on release)
// and adds SIMULATOR_TOOL_CHANGE logging on release. VariableSlider exposes no
// callback props and commits internally, so it can't be logged directly.
// Logging on release (not per-drag) yields one event per interaction and keeps
// the drag stream out of the log.
export function SimulatorSlider({
  className, max, min, step, variable, variables, tileId
}: ISimulatorSliderProps) {
  const handleChange = (value: number | number[]) => {
    variable?.setTemporaryValue(Array.isArray(value) ? value[0] : value);
  };
  const handleChangeComplete = () => {
    variable?.commitTemporaryValue();
    if (tileId && variable) {
      logSimulatorVariableChange(tileId, variable, variable.currentValue, variables);
    }
  };
  return (
    <Slider
      className={className}
      max={max}
      min={min}
      step={step}
      value={variable?.currentValue ?? min}
      onChange={handleChange}
      onChangeComplete={handleChangeComplete}
    />
  );
}
