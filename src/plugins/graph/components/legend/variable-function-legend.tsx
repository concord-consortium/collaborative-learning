import React from "react";
import { observer } from "mobx-react";
import { IPlottedFunctionAdornmentModel } from "../../adornments/plotted-function/plotted-function-adornment-model";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { SharedVariables } from "../../../shared-variables/shared-variables";
import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";

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
  console.log('running');
  const { tile } = useTileModelContext();
  const smm = getSharedModelManager(tile);
  const sharedVars = (smm?.isReady) ? smm.findFirstSharedModelByType(SharedVariables, tile?.id): undefined;

  if (sharedVars) {
    return (
      <div className="legend-title-row">
        <p>Variables from: <strong>{smm?.getSharedModelLabel(sharedVars)}</strong></p>
      </div>
    );
  } else {
    return null;
  }

});
