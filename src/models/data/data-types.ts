import { types } from "mobx-state-tree";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);
// TODO: This is really locale specific, we need a better way to handle
// locale date identification. It isn't clear if dayjs supports this.
// In particular some locales put the day first instead of the month.
// We can just let dayjs check all of its known formats but then it
// will match any string with a date anywhere in it. There is
// a locale format plugin which is close but is probably still too
// strict.
// See data-types.test.ts to see examples
const dayjsFormats = [
  "M/D/YY",
  "M/D/YYYY",
  "M/DD/YY",
  "M/DD/YYYY",
  "MM/D/YY",
  "MM/D/YYYY",
  "MM/DD/YY",
  "MM/DD/YYYY",
  "M-D",
  "M-D-YY",
  "M-D-YYYY",
  "M-DD",
  "M-DD-YY",
  "M-DD-YYYY",
  "MM-D",
  "MM-D-YY",
  "MM-D-YYYY",
  "MM-DD",
  "MM-DD-YY",
  "MM-DD-YYYY",
  "MMMD",
  "MMMD,YY",
  "MMMD,YYYY",
  "MMMDD",
  "MMMDD,YY",
  "MMMDD,YYYY",
  "MMMMD",
  "MMMMD,YY",
  "MMMMD,YYYY",
  "MMMMDD",
  "MMMMDD,YY",
  "MMMMDD,YYYY"
];

export const ValueType = types.union(types.number, types.string, types.undefined);
export type IValueType = number | string | undefined;

export function isNumeric(val: IValueType) {
  return !isNaN(toNumeric(val));
}

function handleFractions(value: IValueType) {
  if (typeof value !== "string") {
    return value;
  }
  const result = value.match(/^ *(-?) *(\d+) *\/ *(\d+) *$/);
  if (result) {
    const numericValue =  Number(result[2]) / Number(result[3]);
    return result[1] === "-" ? -numericValue : numericValue;
  }
  return value;
}

export function toNumeric(value: IValueType) {
  if (value == null || value === "") return NaN;
  // Strip commas
  // HACK: This approach is not safe for internationalization.
  // Some locales use `,` for a decimal place.
  // One place to start down that rabbit hole is:
  // https://stackoverflow.com/questions/11665884/how-can-i-parse-a-string-with-a-comma-thousand-separator-to-a-number
  // The approach is also not safe because it would convert `1,2` to the number 12
  const commasStripped = typeof value === "string" ? value.replace(/,/g, "") : value;

  // Handle fractions like 1/4.
  const fractionHandled = handleFractions(commasStripped);

  return Number(fractionHandled);
}

export function isDate(val: IValueType) {
  // Technically a plain number can be timestamp but for this purpose we only
  // care about non numeric string dates
  if (typeof val !== "string" || isNumeric(val)) {
    return false;
  }

  // We need to use strict matching so extra characters in the string aren't
  // completely ignored. However this also means that spaces are not allowed
  // For now we just strip the spaces. This might cause problems with some
  // formats.

  const stripped = val.replace(/ /g, "");

  return dayjs(stripped, dayjsFormats, true).isValid();
}

export function dateFrom(val: string) {
  return dayjs(val, dayjsFormats, true);
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
