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
  if (!plottedVariablesAdornment || plottedVariablesAdornment.plottedVariables.size <= 0) return null;

  const sharedVars = plottedVariablesAdornment.sharedVariables;
  if (sharedVars) {
    return (
      <>
        <div className="legend-title-row">
          <div className="legend-title">
            Variables from: <strong>{sharedVars.label}</strong>
          </div>
        </div>
        {
          Array.from(plottedVariablesAdornment.plottedVariables.keys()).map(instanceKey => {
            const plottedVariablesInstance = plottedVariablesAdornment.plottedVariables.get(instanceKey);
            if (plottedVariablesInstance) {
              return (
                <div className="variable-row" key={instanceKey}>
                  <VariableSelection
                    alternateButtonLabel="Select a variable for X"
                    icon={<XAxisIcon />}
                    onSelect={variableId => plottedVariablesInstance.setXVariableId(variableId)}
                    selectedVariable={plottedVariablesInstance.xVariable}
                    variables={sharedVars.variables.filter(variable => variable.inputs.length <= 0)}
                  />
                  <VariableSelection
                    alternateButtonLabel="Select a variable for Y"
                    icon={<YAxisIcon />}
                    onSelect={(variableId) => plottedVariablesInstance.setYVariableId(variableId)}
                    selectedVariable={plottedVariablesInstance.yVariable}
                    variables={sharedVars.variables}
                  />
                </div>
              );
            }
          })
        }
      </>
    );
  } else {
    return null;
  }

});
