/**
 * How a CLUE release's version appears in portal records, and how to move a record from one
 * release to the next. Pure functions, so update-portal-release.ts's rewrites can be tested
 * without a portal — see release-portal.test.ts.
 */

const kTagPattern = /^v(\d+)\.(\d+)\.(\d+)$/;

/** "v7.6.0" -> "v7.6.x", the release branch a tag is cut from. */
export function releaseBranch(tag: string) {
  const match = tag.match(kTagPattern);
  if (!match) throw new Error(`"${tag}" is not a release tag like v7.6.0`);
  return `v${match[1]}.${match[2]}.x`;
}

/** The deployed paths a release adds: the tag's version folder and the release branch's folder. */
export function releasePaths(tag: string) {
  return [`version/${tag}/`, `branch/${releaseBranch(tag)}/`];
}

/**
 * Point a CLUE URL at another release: `version/v7.5.0/` becomes `version/v7.6.0/` and
 * `branch/v7.5.x/` becomes `branch/v7.6.x/`. Everything else, including a query such as
 * `?firebaseEnv=staging`, is kept. A URL naming neither is returned unchanged.
 */
export function retargetUrl(url: string, tag: string) {
  return url
    .replace(/\/version\/v\d+\.\d+\.\d+\//, `/version/${tag}/`)
    .replace(/\/branch\/v\d+\.\d+\.x\//, `/branch/${releaseBranch(tag)}/`);
}

/**
 * Point a record's name or launch text at another release, e.g.
 * "CLUE Teacher Tools (v7.5.0, staging FB)" -> "CLUE Teacher Tools (v7.6.0, staging FB)".
 * Only whole version and release-branch names are replaced.
 */
export function retargetText(text: string, tag: string) {
  return text
    .replace(/\bv\d+\.\d+\.\d+\b/g, tag)
    .replace(/\bv\d+\.\d+\.x\b/g, releaseBranch(tag));
}
