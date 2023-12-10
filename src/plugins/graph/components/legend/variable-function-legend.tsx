import React from "react";
import { observer } from "mobx-react";
import { IPlottedFunctionAdornmentModel } from "../../adornments/plotted-function/plotted-function-adornment-model";

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
        {
          sharedVars.variables.map(variable => {
            return (
              <div key={variable.id}>
                { variable.name }
              </div>
            );
          })
        }
      </>
    );
  } else {
    return null;
  }

});
