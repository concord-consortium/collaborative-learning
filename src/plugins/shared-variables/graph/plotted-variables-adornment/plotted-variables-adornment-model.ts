import { destroy, getParentOfType, getSnapshot, IAnyStateTreeNode, Instance, types } from "mobx-state-tree";
import { VariableType } from "@concord-consortium/diagram-view";

import { getTileModel } from "../../../../models/document/shared-model-document-manager";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { uniqueId } from "../../../../utilities/js-utils";
import { IAdornmentModel } from "../../../graph/adornments/adornment-models";
import {
  PlottedFunctionAdornmentModel
} from "../../../graph/adornments/plotted-function/plotted-function-adornment-model";
import { SharedVariables, SharedVariablesType } from "../../shared-variables";
import { kPlottedVariablesType } from "./plotted-variables-adornment-types";
import { GraphAttrRole, Point, PrimaryAttrRole } from "../../../graph/graph-types";
import { IClueTileObject } from "../../../../models/annotations/clue-object";
import { GraphModel } from "../../../graph/models/graph-model";
import { isNumericAxisModel } from "../../../graph/imports/components/axis/models/axis-model";

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

function getVariableAnnotationId(xVariableId: string, yVariableId: string) {
  return `var:{${xVariableId}}:{${yVariableId}}`;
}

const annoIdRegEx = /^var:{(.+)}:{(.+)}$/;
function decipherAnnotationId(id: string) {
  const match = id.match(annoIdRegEx);
  if (match && match.length === 3) {
    const xVariableId = match[1];
    const yVariableId = match[2];
    return { xVariableId, yVariableId };
  }
  return {};
}

/**
 * A single X,Y pair of variables to be plotted on the graph.
 */
export const PlottedVariables = types.model("PlottedVariables", {})
  .props({
    xVariableId: types.maybe(types.string),
    yVariableId: types.maybe(types.string)
  })
  .volatile(self => ({
    sharedVariablesCopy: undefined as SharedVariablesType | undefined,
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
      if (self.sharedVariablesCopy && self.xVariableCopy && self.yVariableCopy) {
        self.xVariableCopy.setValue(x);
        const dependentValue = self.yVariableCopy.computedValue;
        return dependentValue ?? NaN;
      }
      return NaN;
    },
    disposeCompute() {
      self.xVariableCopy = undefined;
      self.yVariableCopy = undefined;
      if (self.sharedVariablesCopy) destroy(self.sharedVariablesCopy);
      self.sharedVariablesCopy = undefined;
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
      self.sharedVariablesCopy = SharedVariables.create(
        self.sharedVariables ? getSnapshot(self.sharedVariables) : {}
      );
      self.xVariableCopy = self.sharedVariablesCopy?.getVariableById(self.xVariableId || "");
      self.yVariableCopy = self.sharedVariablesCopy?.getVariableById(self.yVariableId || "");
      return { computeY: self.computeY, dispose: self.disposeCompute };
    }
  }));

/**
 * An Adornment that holds one or more PlottedVariables to be shown on the graph.
 */
export const PlottedVariablesAdornmentModel = PlottedFunctionAdornmentModel
  .named("PlottedVariablesAdornmentModel")
  .props({
    plottedVariables: types.map(PlottedVariables),
    type: types.optional(types.literal(kPlottedVariablesType), kPlottedVariablesType)
  })
  .views(self => ({
    get instanceKeys() {
      return Array.from(self.plottedVariables.keys());
    },
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
    },
    get annotatableObjects(): IClueTileObject[] {
      const result = [];
      for (const pvi of self.plottedVariables.values()) {
        const vals = pvi.variableValues;
        if (pvi.xVariableId && pvi.yVariableId && vals) {
          const objectId = getVariableAnnotationId(pvi.xVariableId, pvi.yVariableId);
          result.push({ objectId, objectType: "variable" });
        }
      }
      return result;
    },
    // Find a PlottedVariables matching the ID pair and return its values (if any)
    getAnnotatableObjectPosition(type: string, objectId: string): Point|undefined {
      if (type !== "variable") return;
      const { xVariableId, yVariableId } = decipherAnnotationId(objectId);
      for (const pvi of self.plottedVariables.values()) {
        if (pvi.xVariableId === xVariableId && pvi.yVariableId === yVariableId) {
          return pvi.variableValues;
        }
      }
    }
  }))
  .views(self => ({
    numericValuesForAttrRole(_role: GraphAttrRole) {
      // We only have any values for X and Y
      if (!['x', 'y'].includes(_role)) return [];

      const role = _role as PrimaryAttrRole;
      const result = [] as number[];
      for (const pvi of self.plottedVariables.values()) {
        if (pvi.xVariableId && pvi.yVariableId) {
          const vals = pvi.variableValues;
          if (vals && role in vals) {
            // We return 2 times each value because of how autoscale is defined for
            // variables. Not just the current-value point has to fit in the graph,
            // but a range of values around it so the function line can be seen clearly.
            result.push(2 * vals[role]);
          } else {
            // If the variable exists but does not have a value, we pretend that
            // the 'X' value is in the middle of the graph's X axis, and return
            // a 'Y' range that will bring that part of the variable trace into view.
            if (role === 'y') {
              const graph = getParentOfType(self, GraphModel);
              const bottomAxis = graph.getAxis("bottom");
              const fakeX = isNumericAxisModel(bottomAxis) ? (bottomAxis.min + bottomAxis.max) / 2 : undefined;
              if (fakeX) {
                const { computeY, dispose } = pvi.setupCompute();
                const fakeY = computeY(fakeX);
                result.push(2 * fakeY);
                dispose();
              }
            }
          }
        }
      }
      // The region we want to be visible is from 0 to twice the value(s)
      if (result.length > 0) {
        result.push(0);
      }
      return result;
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
    clearPlottedVariables() {
      self.plottedVariables.clear();
    },
    setupCompute(instanceKey: string) {
      return self.plottedVariables.get(instanceKey)?.setupCompute();
    }
  }));

export interface IPlottedVariablesAdornmentModel extends Instance<typeof PlottedVariablesAdornmentModel> {}
export function isPlottedVariablesAdornment(adornment: IAdornmentModel): adornment is IPlottedVariablesAdornmentModel {
  return adornment.type === kPlottedVariablesType;
}
