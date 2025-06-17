import { nanoid } from "nanoid";
import { monotonicFactory } from "ulid";
const ulid = monotonicFactory();

/*
 * castArrayCopy()
 *
 * returns an array for simple items, and a copy of the array for arrays
 */
export function castArrayCopy(itemOrArray: any) {
  return Array.isArray(itemOrArray)
          ? itemOrArray.slice()
          : [itemOrArray];
}

/*
 * safeDecodeURI()
 *
 * returns the original string on error rather than throwing an exception
 */
export function safeDecodeURI(uriOrComponent: string) {
  let decoded: string | undefined;
  try {
    decoded = decodeURIComponent(uriOrComponent);
  }
  catch (e) {
    // swallow errors
  }
  return decoded || uriOrComponent;
}

/*
 * safeJsonParse()
 *
 * returns undefined on error rather than throwing an exception
 */
export function safeJsonParse<T = any>(json?: string) {
  let parsed;
  try {
    parsed = json ? JSON.parse(json) as T: undefined;
  }
  catch (e) {
    // swallow errors
  }
  return parsed;
}

/*
 * typedId()
 *
 * returns a unique id string prepended with a supplied prefix
 */
export function typedId(type: string, idLength = 12): string {
  // cf. https://zelark.github.io/nano-id-cc/
  return `${type}${nanoid(idLength)}`;
}

/*
 * uniqueId()
 *
 * returns a unique id string
 */
export function uniqueId(idLength = 16): string {
  // cf. https://zelark.github.io/nano-id-cc/
  return nanoid(idLength);
}

/*
 * uniqueSortableId()
 *
 * returns a unique id string ordered by creation
 */
export function uniqueSortableId(): string {
  return ulid();
}

/*
 * uniqueTitle()
 *
 * returns a unique title from a given base name, adding a unique numeric suffix
 */
export function uniqueTitle(base: string, isValid: (name: string) => boolean) {
  let name: string;
  for (let i = 1; !isValid(name = `${base} ${i}`); ++i) {
    // nothing to do
  }
  return name;
}

/*
 * uniqueName()
 *
 * returns a unique name from a given base name, adding a numeric suffix if necessary
 */
export function uniqueName(base: string, isValid: (name: string) => boolean) {
  if (isValid(base)) return base;
  let name: string;
  for (let i = 2; !isValid(name = `${base}${i}`); ++i) {
    // nothing to do
  }
  return name;
}

/*
 * uniqueSubscriptedName()
 *
 * returns a unique name from a given base name, adding subscripts if necessary
 */
export function uniqueSubscriptedName(base: string, isValid: (name: string) => boolean) {
  if (isValid(base)) return base;
  const numToSubscripts = (num: number) => {
    const subscripts = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
    const str = `${Math.trunc(num)}`;
    let result = "";
    for (let i = 0; i < str.length; ++i) {
      result += subscripts[str.charCodeAt(i) - "0".charCodeAt(0)];
    }
    return result;
  };
  let name: string;
  for (let i = 2; !isValid(name = `${base}${numToSubscripts(i)}`); ++i) {
    // nothing to do
  }
  return name;
}

/*
 * timeZoneOffsetString()
 *
 * returns a string like -0800 for the time zone offset
 * cf. https://stackoverflow.com/a/5114625/16328462
 */
export function timeZoneOffsetString() {
  return formatTimeZoneOffset(new Date().getTimezoneOffset());
}

/*
 * formatTimeZoneOffset()
 *
 * returns a string like -0800 for the time zone offset
 * cf. https://stackoverflow.com/a/5114625/16328462
 */
export function formatTimeZoneOffset(offset: number) {
  const posOffset = Math.abs(offset);

  function pad2(value: number) {
    const s = "" + value;
    return `${s.length < 2 ? "0" : ""}${s}`;
  }

  return (offset <= 0 ? '+' : '-') + // Note the reversed sign!
          pad2(Math.floor(posOffset / 60)) +
          pad2(posOffset % 60);
}

/**
 * Check whether the given value is not null or undefined.
 * This is useful for `filter` statements since it gives typescript the type certainty it needs.
 * See https://stackoverflow.com/questions/43118692/typescript-filter-out-nulls-from-an-array
 * Should be unnecessary after Typescript version 5.5
 * @param value
 * @returns
 */
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value != null;
}

/**
 * Compare the contents of two arrays, ignoring the order of the elements.
 * @param a array
 * @param b array
 * @returns true if a and b have elements that compare equal, ignoring order
 */
export function arraysEqualIgnoringOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * Simpleminded helper to get "2" from "2px".
 * @param style string imported from CSS
 * @returns number of pixels, if the style appears to be a pixel width.
 */
export function getPixelWidthFromCSSStyle(style: string): number | undefined {
  if (style.endsWith('px')) {
    return parseFloat(style);
  } else {
    console.warn('Expected pixel width, but got: ', style);
    return undefined;
  }
}
