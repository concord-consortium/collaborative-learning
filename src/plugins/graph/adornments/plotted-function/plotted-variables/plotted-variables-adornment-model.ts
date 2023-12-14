import { Instance, types } from "mobx-state-tree";

import { getTileModel } from "../../../../../models/document/shared-model-document-manager";
import { getSharedModelManager } from "../../../../../models/tiles/tile-environment";
import { SharedVariables, SharedVariablesType } from "../../../../shared-variables/shared-variables";
import { Point } from "../../../graph-types";
import { IAdornmentModel } from "../../adornment-models";
import { kPlottedVariablesType } from "./plotted-variables-adornment-types";
import { PlottedFunctionAdornmentModel, IComputePointsOptions } from "../plotted-function-adornment-model";

export const PlottedVariablesAdornmentModel = PlottedFunctionAdornmentModel
  .named("PlottedVariablesAdornmentModel")
  .props({
    type: types.optional(types.literal(kPlottedVariablesType), kPlottedVariablesType),
    xVariableId: types.maybe(types.string),
    yVariableId: types.maybe(types.string)
  })
  .views(self => ({
    get sharedVariables() {
      const sharedModelManager = getSharedModelManager(self);
      if (sharedModelManager?.isReady) {
        const tile = getTileModel(self);
        if (tile) {
          const sharedVariables = sharedModelManager.findFirstSharedModelByType(SharedVariables, tile.id);
          if (sharedVariables) return sharedVariables as SharedVariablesType;
        }
      }
    }
  }))
  .views(self => ({
    get xVariable() {
      return self.sharedVariables?.variables.find(variable => variable.id === self.xVariableId);
    },
    get yVariable() {
      return self.sharedVariables?.variables.find(variable => variable.id === self.yVariableId);
    }
  }))
  .views(self => ({
    computePoints(options: IComputePointsOptions) {
      const { min, max, xCellCount, yCellCount, gap, xScale, yScale, formulaFunction } = options;
      const tPoints: Point[] = [];
      if (xScale.invert) {
        let computeY = formulaFunction;
        let dispose = () => {};

        // Use variable expression if we're connected to a shared variables model
        if (self.sharedVariables) {
          const compute = self.sharedVariables.setupCompute(self.xVariableId, self.yVariableId);
          computeY = compute.computeY;
          dispose = compute.dispose;
        }

        for (let pixelX = min; pixelX <= max; pixelX += gap) {
          const tX = xScale.invert(pixelX * xCellCount);
          const tY = computeY(tX);
          if (Number.isFinite(tY)) {
            const pixelY = yScale(tY) / yCellCount;
            tPoints.push({ x: pixelX, y: pixelY });
          }
        }
        dispose();
      }
      return tPoints;
    }
  }))
  .actions(self => ({
    setXVariableId(xVariableId?: string) {
      self.xVariableId = xVariableId;
    },
    setYVariableId(yVariableId?: string) {
      self.yVariableId = yVariableId;
    }
  }));

export interface IPlottedVariablesAdornmentModel extends Instance<typeof PlottedVariablesAdornmentModel> {}
export function isPlottedVariablesAdornment(adornment: IAdornmentModel): adornment is IPlottedVariablesAdornmentModel {
  return adornment.type === kPlottedVariablesType;
}
