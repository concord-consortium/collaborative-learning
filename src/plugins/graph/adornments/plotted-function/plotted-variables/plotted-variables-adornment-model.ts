import { destroy, getSnapshot, IAnyStateTreeNode, Instance, types } from "mobx-state-tree";
import { Variable, VariableType } from "@concord-consortium/diagram-view";

import { getTileModel } from "../../../../../models/document/shared-model-document-manager";
import { getSharedModelManager } from "../../../../../models/tiles/tile-environment";
import { uniqueId } from "../../../../../utilities/js-utils";
import { SharedVariables, SharedVariablesType } from "../../../../shared-variables/shared-variables";
import { IAdornmentModel } from "../../adornment-models";
import { kPlottedVariablesType } from "./plotted-variables-adornment-types";
import { PlottedFunctionAdornmentModel } from "../plotted-function-adornment-model";

function getSharedVariables(node: IAnyStateTreeNode) {
  const sharedModelManager = getSharedModelManager(node);
  if (sharedModelManager?.isReady) {
    const tile = getTileModel(node);
    if (tile) {
      const sharedVariables = sharedModelManager.findFirstSharedModelByType(SharedVariables, tile.id);
      if (sharedVariables) return sharedVariables as SharedVariablesType;
    }
  }
}

export const PlottedVariables = types.model("PlottedVariables", {})
  .props({
    xVariableId: types.maybe(types.string),
    yVariableId: types.maybe(types.string)
  })
  .volatile(self => ({
    variablesCopy: undefined as VariableType[] | undefined,
    xVariableCopy: undefined as VariableType | undefined,
    yVariableCopy: undefined as VariableType | undefined
  }))
  .views(self => ({
    get sharedVariables() {
      return getSharedVariables(self);
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
    /**
     * Return the current values of the X and Y variables.
     * Returns an object with { x, y }, or undefined if either one is not set.
     */
    get variableValues() {
      const x = self.xVariable?.computedValue,
        y = self.yVariable?.computedValue;
    if (x !== undefined && y !== undefined) {
      return { x, y };
    }
    }
  }))
  .actions(self => ({
    computeY(x: number) {
      if (self.variablesCopy && self.xVariableCopy && self.yVariableCopy) {
        self.xVariableCopy.setValue(x);
        const dependentValue = self.yVariableCopy.computedValue;
        return dependentValue ?? NaN;
      }
      return NaN;
    },
    disposeCompute() {
      self.xVariableCopy = undefined;
      self.yVariableCopy = undefined;
      if (self.variablesCopy) destroy(self.variablesCopy);
      self.variablesCopy = undefined;
    },
    setXVariableId(variableId?: string) {
      self.xVariableId = variableId;
    },
    setYVariableId(variableId?: string) {
      self.yVariableId = variableId;
    }
  }))
  .actions(self => ({
    setupCompute() {
      self.variablesCopy = types.array(Variable).create(
        self.sharedVariables ? getSnapshot(self.sharedVariables.variables) : []
      );
      self.xVariableCopy = self.variablesCopy?.find(variable => variable.id === self.xVariableId);
      self.yVariableCopy = self.variablesCopy?.find(variable => variable.id === self.yVariableId);
      return { computeY: self.computeY, dispose: self.disposeCompute };
    }
  }));

export const PlottedVariablesAdornmentModel = PlottedFunctionAdornmentModel
  .named("PlottedVariablesAdornmentModel")
  .props({
    plottedVariables: types.map(PlottedVariables),
    type: types.optional(types.literal(kPlottedVariablesType), kPlottedVariablesType)
  })
  .views(self => ({
    get sharedVariables() {
      return getSharedVariables(self);
    },
    /**
     * Returns an object with all X and Y values of plotted variables.
     * Format is { x: [list of x values], y: [list of y values] }
     */
    get variableValues() {
      const lists = {
        x: [] as number[],
        y: [] as number[]
      };
      for (const pvi of self.plottedVariables.values()) {
        const vals = pvi.variableValues;
        if (vals) {
          lists.x.push(vals.x);
          lists.y.push(vals.y);
        }
      }
      return lists;
    }
  }))
  .actions(self => ({
    addPlottedVariables(key?: string, xVariableId?: string, yVariableId?: string) {
      const newPlottedVariables = PlottedVariables.create({ xVariableId, yVariableId });
      const newKey = key ?? uniqueId();
      self.plottedVariables.set(newKey, newPlottedVariables);
      return newKey;
    },
    removePlottedVariables(key: string) {
      self.plottedVariables.delete(key);
    },
    setupCompute(instanceKey: string) {
      return self.plottedVariables.get(instanceKey)?.setupCompute();
    }
  }));

export interface IPlottedVariablesAdornmentModel extends Instance<typeof PlottedVariablesAdornmentModel> {}
export function isPlottedVariablesAdornment(adornment: IAdornmentModel): adornment is IPlottedVariablesAdornmentModel {
  return adornment.type === kPlottedVariablesType;
}