import Slider from "rc-slider";
import React from "react";
import { VariableType } from "@concord-consortium/diagram-view";
import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";
import { useSimulatorContent } from "../../hooks/use-simulator-content";
import { logSimulatorVariableChange } from "../../simulator-logging";
import "rc-slider/assets/index.css";

interface ISimulatorSliderProps {
  className?: string;
  max: number;
  min: number;
  step: number;
  variable?: VariableType;
}

// CLUE-owned replacement for diagram-view's VariableSlider. Reproduces its
// behavior (setTemporaryValue while dragging, commitTemporaryValue on release)
// and adds SIMULATOR_TOOL_CHANGE logging on release. VariableSlider exposes no
// callback props and commits internally, so it can't be logged directly.
// Logging on release (not per-drag) yields one event per interaction and keeps
// the drag stream out of the log. The tile id and variable snapshot come from
// context rather than props.
//
// Stopgap: CLUE-627 will add an onChangeComplete prop to VariableSlider in
// diagram-view and delete this component in favor of it.
export function SimulatorSlider({ className, max, min, step, variable }: ISimulatorSliderProps) {
  const { tile } = useTileModelContext();
  const content = useSimulatorContent();
  const handleChange = (value: number | number[]) => {
    variable?.setTemporaryValue(Array.isArray(value) ? value[0] : value);
  };
  const handleChangeComplete = () => {
    variable?.commitTemporaryValue();
    if (tile?.id && variable) {
      logSimulatorVariableChange(tile.id, variable, content.variables ?? []);
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
