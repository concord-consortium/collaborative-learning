import React from "react";
import { observer } from "mobx-react";

import { IPlottedFunctionAdornmentModel } from "../../adornments/plotted-function/plotted-function-adornment-model";
import { VariableSelection } from "./variable-selection";

import XAxisIcon from "../../assets/x-axis-icon.svg";
import YAxisIcon from "../../assets/y-axis-icon.svg";

interface IVariableFunctionLegendProps {
  plottedFunctionAdornment?: IPlottedFunctionAdornmentModel;
}

/**
 * XY Plot legend component that will control variables-based adornment.
 */
export const VariableFunctionLegend = observer(function(
  { plottedFunctionAdornment }: IVariableFunctionLegendProps
) {
  if (!plottedFunctionAdornment) return null;

  const sharedVars = plottedFunctionAdornment.sharedVariables;

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
            onSelect={variableId => plottedFunctionAdornment?.setXVariableId(variableId)}
            selectedVariable={plottedFunctionAdornment?.xVariable}
            variables={sharedVars.variables.filter(variable => variable.inputs.length <= 0)}
          />
          <VariableSelection
            alternateButtonLabel="Select a variable for Y"
            icon={<YAxisIcon />}
            onSelect={(variableId) => plottedFunctionAdornment?.setYVariableId(variableId)}
            selectedVariable={plottedFunctionAdornment?.yVariable}
            variables={sharedVars.variables}
          />
        </div>
      </>
    );
  } else {
    return null;
  }

});
