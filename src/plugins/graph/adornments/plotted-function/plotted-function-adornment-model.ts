import { destroy, getSnapshot, Instance, types } from "mobx-state-tree";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { SharedVariables, SharedVariablesType } from "../../../shared-variables/shared-variables";
import { Point } from "../../graph-types";
import { ScaleNumericBaseType } from "../../imports/components/axis/axis-types";
import { AdornmentModel, IAdornmentModel } from "../adornment-models";
import { kPlottedFunctionType, FormulaFn } from "./plotted-function-adornment-types";

const kDefaultFunctionKey = "{}";

export const PlottedFunctionInstance = types.model("PlottedFunctionInstance", {})
  .volatile(self => ({
    // This is being hard coded to x**2 for now.
    // It should be reverted to NaN once we've set up correct functions.
    // formulaFunction: (x: number) => NaN,
    formulaFunction: (x: number) => x**2,
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
    error: ""
  })
  .volatile(self => ({
    sharedVariablesCopy: undefined as SharedVariablesType | undefined
  }))
  .views( self => ({
    computePoints(options: IComputePointsOptions) {
      const { min, max, xCellCount, yCellCount, gap, xScale, yScale, formulaFunction } = options;
      const tPoints: Point[] = [];
      if (xScale.invert) {
        for (let pixelX = min; pixelX <= max; pixelX += gap) {
          const tX = xScale.invert(pixelX * xCellCount);
          const tY = formulaFunction(tX);
          if (Number.isFinite(tY)) {
            const pixelY = yScale(tY) / yCellCount;
            tPoints.push({ x: pixelX, y: pixelY });
          }
        }
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
    computeY(x: number) {
      if (self.sharedVariablesCopy) {
        const independentVariable = self.sharedVariablesCopy.variables.find(variable => variable.name === "x");
        const dependentVariable = self.sharedVariablesCopy.variables.find(variable => variable.name === "y");
        if (independentVariable && dependentVariable) {
          if (x <= .9) {
            console.log(`OOO plotting`, x);
          } else if (x >= 2.298) {
            console.log(` OO plotting`, x);
          }
          independentVariable.setValue(x);
          const dependentValue = dependentVariable.computedValue;
          return dependentValue ?? x ** 2;
        }
      }
      console.log(`^^^ Failed to compute`);
      return x ** 2;
    },
    disposeSharedVariablesCopy() {
      if (self.sharedVariablesCopy) destroy(self.sharedVariablesCopy);
      self.sharedVariablesCopy = undefined;
    }
  }))
  .actions(self => ({
    setupCompute(xName: string, yName: string) {
      const smm = getSharedModelManager(self);
      if (smm && smm.isReady) {
        const sharedVariableModels = smm.getTileSharedModelsByType(self, SharedVariables);
        if (sharedVariableModels.length > 0) {
          const sharedVariables = sharedVariableModels[0] as SharedVariablesType;
          self.sharedVariablesCopy = SharedVariables.create(getSnapshot(sharedVariables));
        }
      }
      return { computeY: self.computeY, dispose: self.disposeSharedVariablesCopy };
    }
  }));

export interface IPlottedFunctionAdornmentModel extends Instance<typeof PlottedFunctionAdornmentModel> {}
export function isPlottedFunctionAdornment(adornment: IAdornmentModel): adornment is IPlottedFunctionAdornmentModel {
  return adornment.type === kPlottedFunctionType;
}
