import {Instance, SnapshotIn, types} from "mobx-state-tree";
import { Formula } from "./formula";
import { typedId } from "../../utilities/js-utils";

export const kDefaultFormatStr = ".3~f";

const ValueType = types.union(types.number, types.string, types.undefined);
export type IValueType = number | string | undefined;

export function importValueToString(value: IValueType) {
  return value == null || Number.isNaN(value) ? "" : typeof value === "string" ? value : JSON.stringify(value);
}

export const attributeTypes = [
  "categorical", "numeric", "date", "qualitative", "boundary", "checkbox", "color"
] as const;
export type AttributeType = typeof attributeTypes[number]

export const Attribute = types.model("Attribute", {
  id: types.optional(types.identifier, () => typedId("ATTR")),
  clientKey: "",
  sourceID: types.maybe(types.string),
  name: types.string,
  hidden: false,
  units: "",
  formula: types.optional(Formula, () => Formula.create()),
  values: types.array(ValueType),
  title: "",
  description: types.maybe(types.string),
  // userType: types.maybe(types.enumeration([...attributeTypes])),
  precision: types.maybe(types.number),
})
.preProcessSnapshot(snap => {
  // convert nulls to undefined
  const values = snap.values?.map(value => value != null ? value : undefined);
  return { ...snap, values };
})
.views(self => ({
  importValue(value: IValueType) {
    // may eventually want to do something more sophisticated here, like convert
    // numeric values using an attribute-specific number of decimal places
    return importValueToString(value);
  },
  toNumeric(value: string) {
    if (value == null || value === "") return NaN;
    return Number(value);
  },
  // CODAP3 has an optimization so that strValues and numValues are kept up to date
  // rather than (potentially) recomputing them from scratch on every change.
  get strValues() {
    return self.values.map(value => importValueToString(value));
  },
  get numValues() {
    return self.values.map(value => value == null || value === "" ? NaN : Number(value));
  }
}))
.views(self => ({
  get emptyCount() {
    return self.strValues.reduce((prev, current) => current === "" ? ++prev : prev, 0);
  },
  get numericCount() {
    return self.numValues.reduce((prev, current) => isFinite(current) ? ++prev : prev, 0);
  }
}))
.views(self => ({
  get length() {
    return self.strValues.length;
  },
  get type() {
    // if (self.userType) return self.userType;
    if (self.numValues.length === 0) return;
    // only infer numeric if all non-empty values are numeric (CODAP2)
    return self.numericCount === self.numValues.length - self.emptyCount ? "numeric" : "categorical";
  },
  get format() {
    return self.precision != null ? `.${self.precision}~f` : kDefaultFormatStr;
  },
  value(index: number) {
    return self.values[index];
  },
  strValue(index: number) {
    return self.strValues[index];
  },
  isNumeric(index: number) {
    return !isNaN(self.numValues[index]);
  },
  numValue(index: number) {
    return self.numValues[index];
  },
  boolean(index: number) {
    return ["true", "yes"].includes(self.strValues[index].toLowerCase()) ||
            (!isNaN(this.numValue(index)) ? this.numValue(index) !== 0 : false);
  },
  derive(name?: string) {
    return { id: self.id, name: name || self.name, values: [] };
  }
}))
.actions(self => ({
  setName(newName: string) {
    self.name = newName;
  },
  setUnits(units: string) {
    self.units = units;
  },
  setDescription(description: string) {
    self.description = description;
  },
  // setUserType(type: AttributeType | undefined) {
  //   self.userType = type;
  // },
  // setUserFormat(precision: string) {
  //   self.userFormat = `.${precision}~f`
  // },
  setPrecision(precision?: number) {
    self.precision = precision;
  },
  // setEditable(editable: boolean) {
  //   self.editable = editable;
  // },
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
export interface IAttribute extends Instance<typeof Attribute> {}
export interface IAttributeSnapshot extends SnapshotIn<typeof Attribute> {}
