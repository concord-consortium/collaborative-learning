import { VariableType } from "@concord-consortium/diagram-view";
import Slider from "rc-slider";
import React from "react";

import 'rc-slider/assets/index.css';

interface IVariableSliderProps {
  className?: string;
  max: number;
  min: number;
  step: number;
  variable?: VariableType;
}
export function VariableSlider({ className, max, min, step, variable}: IVariableSliderProps) {
  return (
    <Slider
      className={className}
      max={max}
      min={min}
      onChange={(value: number | number[]) => variable?.setValue(Array.isArray(value) ? value[0] : value)}
      step={step}
      value={variable?.value ?? min}
    />
  );
}
