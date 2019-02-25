// import nanoid from "nanoid";
const nanoid = require("nanoid");

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
 * safeJsonParse()
 *
 * returns undefined on error rather than throwing an exception
 */
export function safeJsonParse(json?: string) {
  let parsed;
  try {
    parsed = json && JSON.parse(json);
  }
  catch (e) {
    // swallow errors
  }
  return parsed;
}

/*
 * uniqueId()
 *
 * returns a unique id string
 */
export function uniqueId(): string {
  // cf. https://zelark.github.io/nano-id-cc/
  const idLength = 16;
  return nanoid(idLength);
}
