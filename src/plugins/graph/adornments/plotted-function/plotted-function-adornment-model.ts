import { Instance, types } from "mobx-state-tree";
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

export interface IComputePointsOptions {
  instanceKey: string,
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
    setupCompute(instanceKey: string) {
      const computeY = self.plottedFunctions.get(instanceKey)?.formulaFunction;
      const dispose = () => {};
      return { computeY, dispose };
    }
  }))
  .views(self => ({
    /**
     * Calculate the pixel position of a value given the axis scale and number of cells.
     */
    positionForValue(value: number, scale: ScaleNumericBaseType, cellCount: number) {
        return (scale(value) / cellCount);
    },
    /**
     * Calculate the value given a pixel position; inverse of `positionForValue`.
     * Returns undefined if the position is not in the range of the scale.
     */
    valueForPosition(position: number, scale: ScaleNumericBaseType, cellCount: number) {
      const [min, max] = scale.range().sort();
      if (position >= min && position <= max) {
        return scale.invert(position * cellCount);
      }
    }
  }))
  .actions(self => ({
    computePoints(options: IComputePointsOptions) {
      const { instanceKey, min, max, xCellCount, yCellCount, gap, xScale, yScale } = options;
      const tPoints: Point[] = [];
      const { computeY, dispose } = self.setupCompute(instanceKey);
      if (xScale.invert && computeY) {
        for (let pixelX = min; pixelX <= max; pixelX += gap) {
          const tX = xScale.invert(pixelX * xCellCount);
          const tY = computeY(tX);
          if (Number.isFinite(tY)) {
            const pixelY = self.positionForValue(tY, yScale, yCellCount);
            tPoints.push({ x: pixelX, y: pixelY });
          }
        }
      }
      dispose?.();
      return tPoints;
    },
  }));

export interface IPlottedFunctionAdornmentModel extends Instance<typeof PlottedFunctionAdornmentModel> {}
export function isPlottedFunctionAdornment(adornment: IAdornmentModel): adornment is IPlottedFunctionAdornmentModel {
  return adornment.type === kPlottedFunctionType;
}
