import React from "react";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { ITileModel } from "../../../../models/tiles/tile-model";
import { SharedVariables } from "../../../shared-variables/shared-variables";
import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";

// FIXME: this function gets run a bazillion times - eg on every scroll -
// but not when we need it to be run - after link/unlink operation.
// Not spending time to optimize now since it's only temporary; presumably
// the presence of the Adornment will actually be used to control showing this legend.
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
export function VariableFunctionLegend() {

  const { tile } = useTileModelContext();
  const hasSharedVariables = tile && hasLinkedSharedVariables(tile);

  if (hasSharedVariables) {
    return (<p>Shared variables are attached</p>);
  } else {
    return null;
  }

}
