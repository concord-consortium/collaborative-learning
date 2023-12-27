import { observer } from "mobx-react-lite";
import React, { ReactElement } from "react";
import { VariableType } from "@concord-consortium/diagram-view";

import { LegendDropdown } from "./legend-dropdown";

import "./variable-selection.scss";

function variableDisplay(variable: VariableType) {
  const namePart = variable.name || "<no name>";
  const unitPart = variable.computedUnit ? ` (${variable.computedUnit})` : "";
  return `${namePart}${unitPart}`;
}

interface IVariableSelectionProps {
  alternateButtonLabel: string;
  icon: ReactElement;
  onSelect: (id: string) => void;
  selectedVariable?: VariableType;
  variables: VariableType[];
}
export const VariableSelection = observer(function VariableSelection({
  alternateButtonLabel, icon, onSelect, selectedVariable, variables
}: IVariableSelectionProps) {
  const buttonLabel = selectedVariable ? variableDisplay(selectedVariable) : alternateButtonLabel;
  const menuItems = variables.map(variable => ({
    key: variable.id,
    label: variableDisplay(variable),
    onClick: () => onSelect(variable.id)
  }));

  return (
    <LegendDropdown
      buttonLabel={buttonLabel}
      icon={icon}
      menuItems={menuItems}
      showCaret={true}
    />
  );
});
