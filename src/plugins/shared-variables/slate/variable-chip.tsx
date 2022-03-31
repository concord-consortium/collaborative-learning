import { VariableType } from "@concord-consortium/diagram-view";
import { observer } from "mobx-react";
import React from "react";

interface IProps {
  variable: VariableType;
}

export const VariableChip: React.FC<IProps> = observer(({variable}) => {
  const name = variable.name;
  const value = variable.computedValue;
  const valueString = variable.computedValueWithSignificantDigits;
  const unit = variable.computedUnit || "";
  const showValue = value !== undefined && !isNaN(value);
  const showEquals = showValue && name;
  const wrapUnit = !showValue;

  return (
    <>
      {name && <span className="ccrte-name">{name}</span>}
      {showEquals && <span className="ccrte-equals">=</span>}
      {showValue && <span className="ccrte-value">{valueString}</span>}
      {unit && 
        <>
          {wrapUnit && "("}
            <span className="ccrte=unit">{unit}</span>
          {wrapUnit && ")"}
        </>
      }
    </>
  );
});
VariableChip.displayName = "VariableChip";
