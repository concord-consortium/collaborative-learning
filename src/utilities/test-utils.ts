import { each, isObject, isUndefined, unset } from "lodash";

// Recursively removes properties whose values are undefined.
// The specified object is modified in place and returned.
// cf. https://stackoverflow.com/a/37250225
export function omitUndefined(obj: {}) {
  each(obj, (v, k) => {
    if (isUndefined(v)) {
      unset(obj, k);
    }
    else if (isObject(v)) {
      omitUndefined(v);
    }
  });
  return obj;
}
