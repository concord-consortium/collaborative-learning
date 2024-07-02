import React from "react";
import { observer } from "mobx-react";

import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { clueDataColorInfo } from "../../../../utilities/color-utils";
import { LegendDropdown } from "../../../graph/components/legend/legend-dropdown";
import {
  LegendIdListFunction, ILegendHeightFunctionProps, ILegendPartProps
} from "../../../graph/components/legend/legend-types";
import { useGraphModelContext } from "../../../graph/hooks/use-graph-model-context";
import { IGraphModel } from "../../../graph/models/graph-model";
import { isSharedVariables, SharedVariables } from "../../shared-variables";
import {
  IPlottedVariablesAdornmentModel, isPlottedVariablesAdornment
} from "../plotted-variables-adornment/plotted-variables-adornment-model";
import { VariableSelection } from "./variable-selection";

import AddSeriesIcon from "../../../graph/imports/assets/add-series-icon.svg";
import RemoveDataIcon from "../../../graph/assets/remove-data-icon.svg";
import XAxisIcon from "../../../graph/assets/x-axis-icon.svg";
import YAxisIcon from "../../../graph/assets/y-axis-icon.svg";

export const variableFunctionLegendType = "variable-function-legend";

const kPlottedVariableHeaderHeight = 48;
const kPlottedVariableRowHeight = 52;
const kPlottedVariableAddButtonHeight = 50;

interface IColorKeyProps {
  color: string;
}
function ColorKey({ color }: IColorKeyProps) {
  const colorLineStyle = { backgroundColor: color };
  return (
    <div className="color-label">
      <div className="color-line" style={colorLineStyle} />
    </div>
  );
}

interface IVariableFunctionLegendProps {
  plottedVariablesAdornment?: IPlottedVariablesAdornmentModel;
}

/**
 * XY Plot legend component that will control a single variables-based adornment.
 */
export const SingleVariableFunctionLegend = observer(function SingleVariableFunctionLegend({
  plottedVariablesAdornment
}: IVariableFunctionLegendProps) {
  const graphModel = useGraphModelContext();
  const readOnly = useReadOnlyContext();

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
              return (
                <div className="legend-row" key={instanceKey}>
                  <LegendDropdown
                    buttonAriaLabel={`Color: ${graphModel.getColorNameForId(instanceKey)}`}
                    buttonLabel={<ColorKey color={graphModel.getColorForId(instanceKey)} />}
                    menuItems={
                      clueDataColorInfo.map((color, index) => ({
                        ariaLabel: color.name,
                        key: color.color,
                        label: <ColorKey color={color.color} />,
                        onClick: () => graphModel.setColorForId(instanceKey, index)
                      }))
                    }
                  />
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

export const VariableFunctionLegend = observer(function VariableFunctionsLegend(props: ILegendPartProps) {
  const graphModel = useGraphModelContext();

  return (
    <>
      {
        graphModel.adornments.map(adornment => {
          if (isPlottedVariablesAdornment(adornment)) {
            return (
              <SingleVariableFunctionLegend
                key={adornment.id}
                plottedVariablesAdornment={adornment}
              />
            );
          }
          return null;
        })
      }
    </>
  );
});

function getPlottedVariableAdornments(graphModel: Partial<IGraphModel>) {
  if (graphModel.adornments) {
    return graphModel.adornments
      .filter(adornment => isPlottedVariablesAdornment(adornment)) as IPlottedVariablesAdornmentModel[];
  }
  return [];
}

export function heightOfVariableFunctionLegend({ graphModel }: ILegendHeightFunctionProps) {
  const plottedVariableAdornments = getPlottedVariableAdornments(graphModel);
  const plottedVariableTraces = plottedVariableAdornments.reduce((prev, adornment) => {
    return prev + adornment.plottedVariables.size;
  }, 0);
  // Each adornment has a header and an add variable row, plus one row for each plot
  return plottedVariableAdornments.length * (kPlottedVariableHeaderHeight + kPlottedVariableAddButtonHeight)
    + plottedVariableTraces * kPlottedVariableRowHeight;
}

export const getVariableFunctionLegendIdList: LegendIdListFunction =
function getVariableFunctionLegendIdList(graphModel) {
  let ids: string[] = [];
  const plottedVariableAdornments = getPlottedVariableAdornments(graphModel);
  plottedVariableAdornments.forEach(adornment => ids = ids.concat(adornment.instanceKeys));
  return ids;
};
