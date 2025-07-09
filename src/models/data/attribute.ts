import {Instance, SnapshotIn, types} from "mobx-state-tree";
import { Formula } from "@concord-consortium/codap-formulas-react17/models/formula/formula";
import { typedId } from "../../utilities/js-utils";
import { IValueType, ValueType, isDate, isImageUrl, isNumeric, toNumeric } from "./data-types";

export const kDefaultFormatStr = ".3~f";

export function importValueToString(value: IValueType) {
  return value == null || Number.isNaN(value) ? "" : typeof value === "string" ? value : JSON.stringify(value);
}

export const attributeTypes = [
  "categorical", "numeric", "date", "qualitative", "boundary", "checkbox", "color", "image"
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
.postProcessSnapshot(snap => {
  // Strip the id off of the formula. We don't need them.
  // We can't easily change the Formula model itself since it is coming from a library.
  const formulaCopy = { ...snap.formula };
  delete (formulaCopy as any).id;
  return { ...snap, formula: formulaCopy };
})
.views(self => ({
  importValue(value: IValueType) {
    // may eventually want to do something more sophisticated here, like convert
    // numeric values using an attribute-specific number of decimal places
    return importValueToString(value);
  },
  toNumeric(value: string) {
    toNumeric(value);
  },
  // CODAP3 has an optimization so that strValues and numValues are kept up to date
  // rather than (potentially) recomputing them from scratch on every change.
  get strValues() {
    return self.values.map(value => importValueToString(value));
  },
  get numValues() {
    // use toNumeric here
    return self.values.map(value => toNumeric(value));
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
  /**
   * A map of types to the number of values of that type.
   * If there are no values of that type there will be no entry in the map.
   * The entries in the map will be ordered by count so the first entry
   * will have the most values of that type.
   * Some values might match multiple types.
   * Every value can be considered "categorical" so that type is skipped.
   *
   * The handling of strings is going to be a bit weird. Since everything can be
   * considered categorical. The UI using these types could say if the counts
   * of other types are low enough then treat it as a string. If this logic
   * is used in more than one place, then we probably want to move it into
   * here as a view.
   *
   * It might also make sense to make this be an observable map so users
   * can observe keys. However since we can't re-order the keys after they
   * are inserted it would mean we couldn't re-order them. And it also seems
   * odd that a view would get updated like this. I think in MST these kinds
   * of observable maps would be reserved for serialized properties.
   */
  get typeCounts() {
    const counts = new Map<AttributeType, number>();
    function increment(type: AttributeType) {
      if(!counts.has(type)) {
        counts.set(type, 1);
      } else {
        counts.set(type, counts.get(type)!+1);
      }
    }
    self.values.forEach(value => {
      if(isNumeric(value)){
        increment("numeric");
      }
      if(isDate(value)){
        increment("date");
      }
      if(isImageUrl(value)){
        increment("image");
      }
    });
    // need to order them by count
    const entries = [...counts.entries()];
    const ordered = entries.sort((a,b) => b[1] - a[1]);
    const map = new Map<AttributeType,number>(ordered);
    return map;
  },
  get includesAnyImages() {
    return self.values.some(isImageUrl);
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
.views(self => ({
  // TODO: we really need to keep track of empty values, or we need to count
  // categorical (everything not empty) but empty could be categorical
  get mostCommonType(): undefined | AttributeType {
    const {typeCounts} = self;
    if (typeCounts.size === 0) {
      if (self.values.length > 0) {
        // typeCounts does not include categorical
        return "categorical";
      } else {
        return undefined;
      }
    }
    // Extract the first element from the map which will be the type
    // with the highest count
    // If the counts of multiple types are equal then the which one
    // is returned is currently undefined
    const [[firstType,count]] = typeCounts;

    // if the identified type has more than half of the full values
    // return that, otherwise just return categorical
    const fullCount = self.values.length - self.emptyCount;
    if (count >= (fullCount / 2)) {
      return firstType;
    } else {
      return "categorical";
    }
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
    // In CODAP the attribute formula is set to undefined when the formula is cleared
    // In CLUE the formula has been left around with undefined properties. With the use of
    // CODAP formula library it is easiest to just set the display expression to an empty string.
    self.formula.setDisplayExpression("");
  },
  setFormula(display: string) {
    self.formula.setDisplayExpression(display);
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
  },
  // order the values of the attribute according to the provided indices
  orderValues(indices: number[]) {
    const _values = self.values.slice();
    // const _numValues = self.numValues.slice()
    for (let i = 0; i < _values.length; ++i) {
      self.values[i] = _values[indices[i]];
    }
  }
}));
export interface IAttribute extends Instance<typeof Attribute> {}
export interface IAttributeSnapshot extends SnapshotIn<typeof Attribute> {}
