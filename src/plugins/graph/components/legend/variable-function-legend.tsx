import React from "react";
import { observer } from "mobx-react";

import { IPlottedFunctionAdornmentModel } from "../../adornments/plotted-function/plotted-function-adornment-model";
import { VariableSelection } from "./variable-selection";

interface IVariableFunctionLegendProps {
  plottedFunctionAdornment: IPlottedFunctionAdornmentModel;
}

/**
 * XY Plot legend component that will control variables-based adornment.
 * Just a stub for now.
 *
 * TODO: The presence of the Adornment should actually be used to control showing the legend.
 */
export const VariableFunctionLegend = observer(function(
  { plottedFunctionAdornment }: IVariableFunctionLegendProps
) {
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
            buttonLabel={plottedFunctionAdornment?.yVariable?.name ?? "Y"}
            label="Y:"
            onSelect={(variableId) => plottedFunctionAdornment?.setYVariableId(variableId)}
            variables={sharedVars.variables}
          />
        </div>
      </>
    );
  } else {
    return null;
  }

});
