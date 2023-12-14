import React from "react";
import { observer } from "mobx-react";

import {
  IPlottedVariablesAdornmentModel
} from "../../adornments/plotted-function/plotted-variables/plotted-variables-adornment-model";
import { VariableSelection } from "./variable-selection";

import XAxisIcon from "../../assets/x-axis-icon.svg";
import YAxisIcon from "../../assets/y-axis-icon.svg";

interface IVariableFunctionLegendProps {
  plottedVariablesAdornment?: IPlottedVariablesAdornmentModel;
}

/**
 * XY Plot legend component that will control variables-based adornment.
 */
export const VariableFunctionLegend = observer(function(
  { plottedVariablesAdornment }: IVariableFunctionLegendProps
) {
  if (!plottedVariablesAdornment) return null;

  const sharedVars = plottedVariablesAdornment.sharedVariables;

  if (sharedVars) {
    return (
      <>
        <div className="legend-title-row">
          <div className="legend-title">
            Variables from: <strong>{sharedVars.label}</strong>
          </div>
        </div>
        <div className="variable-row">
          <VariableSelection
            alternateButtonLabel="Select a variable for X"
            icon={<XAxisIcon />}
            onSelect={variableId => plottedVariablesAdornment?.setXVariableId(variableId)}
            selectedVariable={plottedVariablesAdornment?.xVariable}
            variables={sharedVars.variables.filter(variable => variable.inputs.length <= 0)}
          />
          <VariableSelection
            alternateButtonLabel="Select a variable for Y"
            icon={<YAxisIcon />}
            onSelect={(variableId) => plottedVariablesAdornment?.setYVariableId(variableId)}
            selectedVariable={plottedVariablesAdornment?.yVariable}
            variables={sharedVars.variables}
          />
        </div>
      </>
    );
  } else {
    return null;
  }

});
