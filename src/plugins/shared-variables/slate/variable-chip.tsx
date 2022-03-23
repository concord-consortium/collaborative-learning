import { VariableType } from "@concord-consortium/diagram-view";
import { observer } from "mobx-react";
import React from "react";

interface IProps {
  variable: VariableType;
}

export const VariableChip: React.FC<IProps> = observer(({variable}) => {
  const name = variable.name || "no name";
  const value = variable.computedValueWithSignificantDigits;
  const unit = variable.computedUnit || "";

  return (
    <>
      <span className="ccrte-name">{name}</span>
      <span className="ccrte-equals">=</span>
      <span className="ccrte-value">{value}</span>
      <span className="ccrte=unit">{unit}</span>
    </>
  );
});
VariableChip.displayName = "VariableChip";