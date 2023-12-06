import React from "react";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { ITileModel } from "../../../../models/tiles/tile-model";
import { SharedVariables } from "../../../shared-variables/shared-variables";
import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";
import { observer } from "mobx-react";

// TODO: The presence of the Adornment should actually be used to control showing this legend.
function hasLinkedSharedVariables(tileModel: ITileModel) {
  const smm = getSharedModelManager(tileModel);
  if (smm?.isReady) {
    const sharedVars = smm.findFirstSharedModelByType(SharedVariables, tileModel?.id);
    if (sharedVars) return true;
  }
  return false;
}

/**
 * XY Plot legend component that will control variables-based adornment.
 * Just a stub for now.
 */
export const VariableFunctionLegend = observer(function() {

  const { tile } = useTileModelContext();
  const hasSharedVariables = tile && hasLinkedSharedVariables(tile);

  if (hasSharedVariables) {
    return (<p>Shared variables are attached</p>);
  } else {
    return null;
  }

});
