import { types, Instance, SnapshotOut } from "mobx-state-tree";
import { uniqueId } from "../../utilities/js-utils";
import { Formula } from "./formula";

const ValueType = types.union(types.number, types.string, types.undefined);
export type IValueType = number | string | undefined;

export const Attribute = types.model("Attribute", {
  id: types.identifier,
  clientKey: "",
  sourceID: types.maybe(types.string),
  name: types.string,
  hidden: false,
  units: "",
  formula: types.optional(Formula, () => Formula.create()),
  values: types.array(ValueType),
  title: "", // TODO: Is this needed?
  description: types.maybe(types.string), // TODO: Is this needed?
  precision: types.maybe(types.number), // TODO: Is this needed?
}).preProcessSnapshot((snapshot) => {
  const { id, values: inValues, ...others } = snapshot;
  const values = (inValues || []).map(v => v == null ? undefined : v);
  return { id: id || uniqueId(), values, ...others };
}).volatile(self => ({
  strValues: [] as string[],
  numValues: [] as number[]
})).views(self => ({
  get emptyCount() {
    return self.strValues.reduce((prev, current) => current === "" ? ++prev : prev, 0);
  },
  get numericCount() {
    return self.numValues.reduce((prev, current) => isFinite(current) ? ++prev : prev, 0);
  }
})).views(self => ({
  get length() {
    return self.values.length;
  },
  get type() {
    if (self.numValues.length === 0) return;
    // only infer numeric if all non-empty values are numeric (CODAP2)
    return self.numericCount === self.numValues.length - self.emptyCount ? "numeric" : "categorical";
  },
  value(index: number) {
    return self.values[index];
  },
  numeric(index: number) {
    return self.numValues[index];
  },
  numericValue(index: number) {
    const v = self.values[index];
    if (v == null || v === "") return NaN;
    if (typeof v === "string") return parseFloat(v);
    return v;
  },
  derive(name?: string) {
    return { id: self.id, name: name || self.name, units: self.units, values: [] };
  },
})).actions(self => ({
  setName(newName: string) {
    self.name = newName;
  },
  setUnits(units: string) {
    self.units = units;
  },
  clearFormula() {
    self.formula.setDisplay();
    self.formula.setCanonical();
  },
  setDisplayFormula(display: string, xName: string) {
    self.formula.setDisplay(display);
    self.formula.canonicalize(xName);
  },
  setFormula(display: string, canonical: string) {
    self.formula.setDisplay(display);
    self.formula.setCanonical(canonical);
  },
  addValue(value: IValueType, beforeIndex?: number) {
    if ((beforeIndex != null) && (beforeIndex < self.values.length)) {
      self.values.splice(beforeIndex, 0, value);
    }
    else {
      self.values.push(value);
    }
  },
  addValues(values: IValueType[], beforeIndex?: number) {
    if ((beforeIndex != null) && (beforeIndex < self.values.length)) {
      self.values.splice(beforeIndex, 0, ...values);
    }
    else {
      self.values.push(...values);
    }
  },
  setValue(index: number, value: IValueType) {
    if ((index >= 0) && (index < self.values.length)) {
      self.values[index] = value;
    }
  },
  setValues(indices: number[], values: IValueType[]) {
    const length = indices.length <= values.length ? indices.length : values.length;
    for (let i = 0; i < length; ++i) {
      const index = indices[i];
      if ((index >= 0) && (index < self.values.length)) {
        self.values[index] = values[i];
      }
    }
  },
  removeValues(index: number, count = 1) {
    if ((index != null) && (index < self.values.length) && (count > 0)) {
      self.values.splice(index, count);
    }
  }
}));
export type IAttribute = Instance<typeof Attribute>;

// Need to redefine to make id optional
export interface IAttributeCreation {
  id?: string;
  clientKey?: string;
  sourceID?: string;
  name: string;
  hidden?: boolean;
  units?: string;
  formula?: string;
  values?: IValueType[];
}
export type IAttributeSnapshot = SnapshotOut<typeof Attribute>;

export const attributeTypes = ["categorical", "numeric", "date", "qualitative", "boundary", "checkbox"] as const;
export type AttributeType = typeof attributeTypes[number];
