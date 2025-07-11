import { addAttributeToDataSet, IDataSet, addCasesToDataSet, IDataSetSnapshot, ICaseCreation } from "./data-set";

export function mergeTwoDataSets(source: IDataSetSnapshot, target: IDataSet) {
    const sourceAttrNames = source.attributes.map((attrObj) => attrObj.name);
    sourceAttrNames.forEach((name) => {
      if (!target.attrNameMap[name]) {
        addAttributeToDataSet(target, { name });
      }
    });
    const sourceCases: ICaseCreation[] = [];
    source.cases.forEach((aCase, idx) => {
      const newCase: ICaseCreation = {};
      source.attributes.forEach((attr) => {
        const attrName = attr.name;
        newCase[attrName] = attr.values[idx];
      });
      sourceCases.push(newCase);
    });
    addCasesToDataSet(target, sourceCases);
}

interface ICompareProps {
  a: number
  b: number
  order: "asc" | "desc"
}

export const numericSortComparator = function ({a, b, order}: ICompareProps): number {
  const aIsNaN = isNaN(a);
  const bIsNaN = isNaN(b);

  if (aIsNaN && bIsNaN) return 0;
  if (bIsNaN) return order === "asc" ? 1 : -1;
  if (aIsNaN) return order === "asc" ? -1 : 1;
  return order === "asc" ? a - b : b - a;
};

export const
  kTypeNumber = 1,
  kTypeString = 2,
  kTypeBoolean = 3,
  kTypeError = 4,
  kTypeNaN = 5,
  kTypeNull = 6,
  // kTypeDate = 7,
  // kTypeSimpleMap = 8, // e.g. boundaries
  kTypeUnknown = 9;

export function typeCode(value: any) {
  if (value == null || value === "") return kTypeNull;
  if (value instanceof Error) return kTypeError;
  // if (isDate(value) || isDateString(value)) return kTypeDate
  // if (value instanceof DG.SimpleMap) return kTypeSimpleMap;
  switch (typeof value) {
    case 'number': return isNaN(value) ? kTypeNaN : kTypeNumber;
    case 'boolean': return kTypeBoolean;
    case 'string': return kTypeString;
    /* istanbul ignore next */
    default: return kTypeUnknown;
  }
}

export function sortableValue(value: any) {
  const type = typeCode(value);
  let num = type === kTypeNumber ? value : NaN;
  // strings convertible to numbers are treated numerically
  if (type === kTypeString && value.length) {
    num = Number(value);
    if (!isNaN(num)) return { type: kTypeNumber, value: num };
  }
  // booleans are treated as strings
  else if (type === kTypeBoolean) {
    return { type: kTypeString, value };
  }

  // TODO: May be useful later when we want to sort dates. Code from CODAP data-utils.
  // dates are treated numerically
  // else if (type === kTypeDate) {
  //   const date = isDate(value) ? value : parseDate(value);
  //   if (!date) return { type: kTypeNull, value: null };
  //   return { type: kTypeNumber, value: date.getTime() / 1000 };
  // }
  // other values are treated according to their type
  return { type, value };
}

// Ascending comparator; negate the result for descending
export function compareValues(value1: any, value2: any, strCompare: (a: string, b: string) => number) {
  const v1 = sortableValue(value1);
  const v2 = sortableValue(value2);

  // if types differ, then sort by type
  if (v1.type !== v2.type) return v1.type - v2.type;

  // if types are the same, then sort by value
  switch (v1.type) {
    case kTypeNumber: return v1.value - v2.value;
    case kTypeString:
    case kTypeError: return strCompare(String(v1.value), String(v2.value));
    default: return 0; // other types are not ordered within type
  }
}

export function removeAllAttributes(dataSet: IDataSet) {
  [...dataSet.attributes].forEach(attr => {
    dataSet.removeAttribute(attr.id);
  });
}
