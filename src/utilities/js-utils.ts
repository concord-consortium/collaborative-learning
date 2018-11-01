
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
