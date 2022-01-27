import * as escapeStringRegexp from "escape-string-regexp";

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll#regexp.exec_and_matchall
export function matchAll(regex: RegExp, str: string) {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    matches.push(match);
  }
  return matches;
}

export function replaceAll(str: string, matchStr: string, replaceStr: string) {
  const legacyUrlRegex = new RegExp(escapeStringRegexp(matchStr), "g");
  return str.replace(legacyUrlRegex, replaceStr);
}
