import { Instance, types } from "mobx-state-tree";
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
    error: "",
    xVariableName: types.maybe(types.string),
    yVariableName: types.maybe(types.string)
  })
  .views(self => ({
    get sharedVariables() {
      const sharedModelManager = getSharedModelManager(self);
      if (sharedModelManager?.isReady) {
        const sharedVariableModels = sharedModelManager.getTileSharedModelsByType(self, SharedVariables);
        if (sharedVariableModels.length > 0) {
          return sharedVariableModels[0] as SharedVariablesType;
        }
      }
    }
  }))
  .views(self => ({
    computePoints(options: IComputePointsOptions) {
      console.log(`--- computePoints`);
      const startTime = Date.now();
      const { min, max, xCellCount, yCellCount, gap, xScale, yScale, formulaFunction } = options;
      const tPoints: Point[] = [];
      if (xScale.invert) {
        let computeY = formulaFunction;
        let dispose = () => {};

        // Use variable expression if we're connected to a shared variables model
        if (self.sharedVariables) {
          const compute = self.sharedVariables.setupCompute("x", "y");
          computeY = compute.computeY;
          dispose = compute.dispose;
        }

        const setupTime = Date.now();
        for (let pixelX = min; pixelX <= max; pixelX += gap) {
          const tX = xScale.invert(pixelX * xCellCount);
          const tY = computeY(tX);
          if (Number.isFinite(tY)) {
            const pixelY = yScale(tY) / yCellCount;
            tPoints.push({ x: pixelX, y: pixelY });
          }
        }
        const loopTime = Date.now();
        console.log(` -- setup time`, setupTime - startTime);
        console.log(` -- loop time`, loopTime - setupTime);
        dispose();
      }
      const finishTime = Date.now();
      console.log(`  - total time`, finishTime - startTime);
      console.log(`  - final points`, tPoints);
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
    setXVariableName(xVariableName?: string) {
      self.xVariableName = xVariableName;
    },
    setYVariableName(yVariableName?: string) {
      self.yVariableName = yVariableName;
    }
  }));

export interface IPlottedFunctionAdornmentModel extends Instance<typeof PlottedFunctionAdornmentModel> {}
export function isPlottedFunctionAdornment(adornment: IAdornmentModel): adornment is IPlottedFunctionAdornmentModel {
  return adornment.type === kPlottedFunctionType;
}