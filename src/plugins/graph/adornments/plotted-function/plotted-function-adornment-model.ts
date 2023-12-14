import { Instance, types } from "mobx-state-tree";
import { getTileModel } from "../../../../models/document/shared-model-document-manager";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { SharedVariables, SharedVariablesType } from "../../../shared-variables/shared-variables";
import { Point } from "../../graph-types";
import { ScaleNumericBaseType } from "../../imports/components/axis/axis-types";
import { AdornmentModel, IAdornmentModel } from "../adornment-models";
import { kPlottedFunctionType, FormulaFn } from "./plotted-function-adornment-types";

const kDefaultFunctionKey = "{}";

export const PlottedFunctionInstance = types.model("PlottedFunctionInstance", {})
  .volatile(self => ({
    formulaFunction: (x: number) => NaN,
  }))
  .actions(self => ({
    setValue(formulaFunction: FormulaFn) {
      self.formulaFunction = formulaFunction;
    }
  }));

interface IComputePointsOptions {
  formulaFunction: (x: number) => number,
  min: number,
  max: number,
  xCellCount: number,
  yCellCount: number,
  gap: number,
  xScale: ScaleNumericBaseType,
  yScale: ScaleNumericBaseType
}

export const PlottedFunctionAdornmentModel = AdornmentModel
  .named("PlottedFunctionAdornmentModel")
  .props({
    type: types.optional(types.literal(kPlottedFunctionType), kPlottedFunctionType),
    plottedFunctions: types.map(PlottedFunctionInstance),
    error: "",
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
    setError(error: string) {
      self.error = error;
    },
    addPlottedFunction(formulaFunction?: FormulaFn, key=kDefaultFunctionKey) {
      const newPlottedFunction = PlottedFunctionInstance.create();
      if (formulaFunction) newPlottedFunction.setValue(formulaFunction);
      self.plottedFunctions.set(key, newPlottedFunction);
    },
    updatePlottedFunctionValue(formulaFunction: FormulaFn, key=kDefaultFunctionKey) {
      const plottedFunction = self.plottedFunctions.get(key);
      if (plottedFunction) {
        plottedFunction.setValue(formulaFunction);
      }
    },
    removePlottedFunction(key: string) {
      self.plottedFunctions.delete(key);
    },
    setXVariableId(xVariableId?: string) {
      self.xVariableId = xVariableId;
    },
    setYVariableId(yVariableId?: string) {
      self.yVariableId = yVariableId;
    }
  }));

export interface IPlottedFunctionAdornmentModel extends Instance<typeof PlottedFunctionAdornmentModel> {}
export function isPlottedFunctionAdornment(adornment: IAdornmentModel): adornment is IPlottedFunctionAdornmentModel {
  return adornment.type === kPlottedFunctionType;
}
