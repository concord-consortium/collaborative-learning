import escapeStringRegexp from "escape-string-regexp";

/*
 * Matches all instances of a string (without using new String.matchAll)
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll#regexp.exec_and_matchall
 */
export function matchAll(regex: RegExp, str: string) {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    matches.push(match);
    // without "g" flag loop never terminates
    if (!regex.flags.includes("g")) break;
  }
  return matches;
}

/*
 * Replaces all instances of a string (without using new String.replaceAll)
 */
export function replaceAll(str: string, matchStr: string, replaceStr: string) {
  const legacyUrlRegex = new RegExp(escapeStringRegexp(matchStr), "g");
  return str.replace(legacyUrlRegex, replaceStr);
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
 * Builds a canonical a firebase image url from its constituent parts
 */
export function buildFirebaseImageUrl(classHash: string, imageKey: string) {
  return `ccimg://fbrtdb.concord.org/${classHash}/${imageKey}`;
}

/*
 * Parses a firebase image url into its constituent parts
 */
export function parseFirebaseImageUrl(url: string) {
  const match = /ccimg:\/\/fbrtdb\.concord\.org\/([^/]+)(\/([^/]+))?/.exec(url);
  const imageKey = match?.[3] || match?.[1];
  const imageClassHash = match?.[3] ? match[1] : undefined;
  const legacyUrl = imageClassHash ? url.replace(`/${imageClassHash}`, ""): url;
  return { imageClassHash, imageKey, legacyUrl };
}
