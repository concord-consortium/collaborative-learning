import React, { useContext } from "react";
import { observer } from "mobx-react";

import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { isSharedVariables, SharedVariables } from "../../../shared-variables/shared-variables";
import {
  IPlottedVariablesAdornmentModel
} from "../../adornments/plotted-function/plotted-variables/plotted-variables-adornment-model";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
import { VariableSelection } from "./variable-selection";

import AddSeriesIcon from "../../imports/assets/add-series-icon.svg";
import RemoveDataIcon from "../../assets/remove-data-icon.svg";
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
  const graphModel = useGraphModelContext();
  const readOnly = useContext(ReadOnlyContext);
  if (!plottedVariablesAdornment || plottedVariablesAdornment.plottedVariables.size <= 0) return null;

  function handleRemoveIconClick() {
    const sharedVariablesId = plottedVariablesAdornment?.sharedVariables?.id;
    const smm = getSharedModelManager(graphModel);
    if (smm && smm.isReady) {
      const linkedSharedVariables = smm.getTileSharedModelsByType(graphModel, SharedVariables);
      const sharedVariables = linkedSharedVariables.find(sv => isSharedVariables(sv) && sv.id === sharedVariablesId);
      if (sharedVariables) {
        smm.removeTileSharedModel(graphModel, sharedVariables);
      }
    }
  }

  const sharedVars = plottedVariablesAdornment.sharedVariables;
  if (sharedVars) {
    return (
      <div className="plotted-variables-legend">
        <div className="legend-row legend-title-row">
            { !readOnly &&
              <div className="legend-icon">
                <button onClick={handleRemoveIconClick} className="remove-button" title="Unlink variables provider">
                    <RemoveDataIcon />
                </button>
              </div>
            }
          <div className="legend-title">
            Variables from: <strong>{sharedVars.label}</strong>
          </div>
        </div>
        {
          Array.from(plottedVariablesAdornment.plottedVariables.keys()).map(instanceKey => {
            const plottedVariablesInstance = plottedVariablesAdornment.plottedVariables.get(instanceKey);
            if (plottedVariablesInstance) {
              const colorLineStyle = { backgroundColor: graphModel.getColorForId(instanceKey) };
              return (
                <div className="legend-row" key={instanceKey}>
                  <div className="graph-legend-label color-label">
                    <div className="color-line" style={colorLineStyle} />
                  </div>
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
                    onSelect={variableId => plottedVariablesInstance.setYVariableId(variableId)}
                    selectedVariable={plottedVariablesInstance.yVariable}
                    variables={sharedVars.variables}
                  />
                  {plottedVariablesAdornment.plottedVariables.size > 1 &&
                    <div className="legend-icon">
                      <button
                        className="remove-button"
                        onClick={() => plottedVariablesAdornment.removePlottedVariables(instanceKey)}
                        title="Remove variable plot"
                      >
                        <RemoveDataIcon />
                      </button>
                    </div>
                  }
                </div>
              );
            }
          })
        }
        { !readOnly &&
          <div className="legend-row">
            <button
              className="add-series-button"
              onClick={() => plottedVariablesAdornment.addPlottedVariables()}
            >
              <div className="legend-icon">
                <AddSeriesIcon/>
              </div>
              <div className="add-series-label">
                Add variables
              </div>
            </button>
          </div>
        }
      </div>
    );
  } else {
    return null;
  }

});
