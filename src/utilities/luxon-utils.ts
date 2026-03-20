import { DateTime } from "luxon";

export function isValidDateTime(dateTime?: DateTime): dateTime is DateTime {
  return !!dateTime?.isValid;
}
