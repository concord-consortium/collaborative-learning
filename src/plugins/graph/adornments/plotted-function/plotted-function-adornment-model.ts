import { Instance, types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel } from "../adornment-models";
import { kPlottedFunctionType, kPlottedFunctionValueTitleKey, FormulaFn } from "./plotted-function-adornment-types";

export const PlottedFunctionInstance = types.model("PlottedFunctionInstance", {})
  .volatile(self => ({
    formulaFunction: (x: number) => NaN,
  }))
  .actions(self => ({
    setValue(formulaFunction: FormulaFn) {
      self.formulaFunction = formulaFunction;
    }
  }));

export const PlottedFunctionAdornmentModel = AdornmentModel
  .named("PlottedFunctionAdornmentModel")
  .props({
    type: types.optional(types.literal(kPlottedFunctionType), kPlottedFunctionType),
    // formula: types.optional(Formula, () => Formula.create()),
    labelTitle: types.optional(types.literal(kPlottedFunctionValueTitleKey), kPlottedFunctionValueTitleKey),
    plottedFunctions: types.map(PlottedFunctionInstance),
    error: ""
  })
  // .views(self => ({
  //   get expression() {
  //     return self.formula.display;
  //   }
  // }))
  .actions(self => ({
    // setExpression(expression: string) {
    //   self.formula.setDisplayExpression(expression);
    // },
    setError(error: string) {
      self.error = error;
    },
    addPlottedFunction(formulaFunction: FormulaFn, key="{}") {
      const newPlottedFunction = PlottedFunctionInstance.create();
      newPlottedFunction.setValue(formulaFunction);
      self.plottedFunctions.set(key, newPlottedFunction);
    },
    updatePlottedFunctionValue(formulaFunction: FormulaFn, key="{}") {
      const plottedFunction = self.plottedFunctions.get(key);
      if (plottedFunction) {
        plottedFunction.setValue(formulaFunction);
      }
    },
    removePlottedFunction(key: string) {
      self.plottedFunctions.delete(key);
    }
  }));

export interface IPlottedFunctionAdornmentModel extends Instance<typeof PlottedFunctionAdornmentModel> {}
export function isPlottedFunctionAdornment(adornment: IAdornmentModel): adornment is IPlottedFunctionAdornmentModel {
  return adornment.type === kPlottedFunctionType;
}
