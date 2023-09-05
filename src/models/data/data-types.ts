import { types } from "mobx-state-tree";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);
const dayjsFormats = [
  "MM/DD/YYYY",
  "MM/DD/YY",
  "MM/DD",
  "M/D"
];

export const ValueType = types.union(types.number, types.string, types.undefined);
export type IValueType = number | string | undefined;

export function isNumeric(val: IValueType) {
  return !isNaN(toNumeric(val));
}

export function toNumeric(value: IValueType) {
  if (value == null || value === "") return NaN;
  // Strip commas
  // HACK: This approach is not safe for internationalization.
  // Some locales use `,` for a decimal place.
  // One place to start down that rabbit hole is:
  // https://stackoverflow.com/questions/11665884/how-can-i-parse-a-string-with-a-comma-thousand-separator-to-a-number
  // The approach is also not safe because it would convert `1,2` to the number 12
  const noCommasValue = typeof value === "string" ? value.replace(/,/g, "") : value;
  return Number(noCommasValue);
}

export function isDate(val: IValueType) {
  // Technically a plain number can be timestamp but for this purpose we only
  // care about non numeric string dates
  if (typeof val !== "string" || isNumeric(val)) {
    return false;
  }

  return dayjs(val, dayjsFormats).isValid();
}

export function isImageUrl(val: IValueType) {
  if (typeof val !== "string") {
    return false;
  }

  // We might need to support more advanced image detection in the future
  // For now we just look for strings matching the URL for an user uploaded
  // image. Like:
  // ccimg://fbrtdb.concord.org/devclass/-NcP-LmubeWUdANUM_vO
  // The ImageMap has a isImageUrl function but it will pickup pretty
  // much any http URL. And I'd guess we don't want to add a dependency
  // on the imageMap to this shared code.
  return val.startsWith("ccimg://fbrtdb.concord.org");
}
