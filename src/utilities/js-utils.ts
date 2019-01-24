// import nanoid from "nanoid";
const nanoid = require("nanoid");

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
export function uniqueId() {
  // cf. https://zelark.github.io/nano-id-cc/
  const idLength = 16;
  return nanoid(idLength);
}
