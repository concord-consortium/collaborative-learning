import React from "react";
import { observer } from "mobx-react";
import { ClassicPreset } from "rete";

import "./value-with-units-control.sass";

export class ValueWithUnitsControl extends ClassicPreset.Control
{
  constructor(
    public nodeName: string,
    public getDisplayValue: () => string,
    public getUnits: () => string,
  ){
    super();
  }
}

export const ValueWithUnitsControlComponent: React.FC<{ data: ValueWithUnitsControl; }> =
  observer(function ValueWithUnitsControlComponent(props)
{
  const control = props.data;
  const displayValue = control.getDisplayValue();
  const units = control.getUnits();

  return (
    <div className="value-with-units" title={"Node Value"}>
      <div className="value-container">
        {displayValue}
      </div>
      <div className={`units-container ${units.length > 4 ? "small" : ""}`}>
        {units}
      </div>
    </div>
  );
});
