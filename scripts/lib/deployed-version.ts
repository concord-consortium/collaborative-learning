/**
 * Parsing and consistency checks for working out which CLUE version a deployed page serves.
 *
 * A release copies `version/<tag>/index-top.html` over the top-level pages (see
 * .github/workflows/release.yml), so a page names its version three ways:
 * - the `version/<tag>/` folder its scripts and styles load from,
 * - the `appVersion` compiled into the bundle from package.json (shown in the UI as "CLUE v…"),
 * - the git info compiled into the bundle from version.json (scripts/write-version.js).
 * They should all agree. When they don't, something was deployed by hand or built oddly.
 */

export interface IGitInfo {
  gitSha?: string | null;
  branch?: string | null;
  tag?: string | null;
  date?: string | null;
}

export interface IBuildInfo {
  appVersion?: string;
  gitInfo?: IGitInfo;
}

/** The `version/<name>` folders a page loads resources from, e.g. ["v7.5.0"]. */
export function extractVersionFolders(html: string): string[] {
  const folders = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)="(?:\.\.\/)*version\/([^/"]+)\//g)) {
    folders.add(match[1]);
  }
  return [...folders];
}

/** The script paths a page loads from its version folder, relative to the page. */
export function extractVersionScripts(html: string): string[] {
  return [...html.matchAll(/src="((?:\.\.\/)*version\/[^"]+\.js)"/g)].map(match => match[1]);
}

/**
 * The version information compiled into a bundle, if this bundle holds it.
 *
 * Minification renames variables but keeps object keys, so `appVersion:"7.5.0"` survives as is.
 * version.json is inlined either as a `JSON.parse('{"gitSha":…}')` string or as an object
 * literal, so its fields are read by key rather than by the surrounding shape.
 */
export function extractBuildInfo(js: string): IBuildInfo {
  const info: IBuildInfo = {};
  const appVersion = js.match(/appVersion:"([^"]+)"/);
  if (appVersion) info.appVersion = appVersion[1];

  const gitShaIndex = js.search(/["']?gitSha["']?\s*:/);
  if (gitShaIndex >= 0) {
    const region = js.slice(gitShaIndex, gitShaIndex + 400);
    const gitInfo: IGitInfo = {};
    for (const key of ["gitSha", "branch", "tag", "date"] as const) {
      const field = region.match(new RegExp(`["']?${key}["']?\\s*:\\s*(null|"([^"]*)")`));
      if (field) gitInfo[key] = field[1] === "null" ? null : field[2];
    }
    info.gitInfo = gitInfo;
  }
  return info;
}

export interface IPageVersion {
  page: string;
  folders: string[];
  appVersion?: string;
  gitInfo?: IGitInfo;
  error?: string;
}

/**
 * Problems with one page's version information, as human-readable strings.
 * `expectedSha` is what the page's tag resolves to in the local git repo, when known.
 */
export function checkPage(page: IPageVersion, expectedSha?: string): string[] {
  if (page.error) return [page.error];
  const problems: string[] = [];
  if (page.folders.length === 0) problems.push("no version/<tag>/ folder referenced");
  if (page.folders.length > 1) problems.push(`references several version folders: ${page.folders.join(", ")}`);
  const folder = page.folders[0];

  const tag = page.gitInfo?.tag;
  if (page.gitInfo && folder && tag !== folder) {
    problems.push(`compiled git tag ${tag ?? "null"} does not match folder ${folder}`);
  }
  if (page.appVersion && folder && `v${page.appVersion}` !== folder) {
    problems.push(`compiled appVersion ${page.appVersion} does not match folder ${folder}`);
  }
  if (expectedSha && page.gitInfo?.gitSha && page.gitInfo.gitSha !== expectedSha) {
    problems.push(`compiled gitSha ${page.gitInfo.gitSha} is not what ${folder} points to (${expectedSha})`);
  }
  return problems;
}

/** Problems across the pages of one environment: they should all serve the same folder. */
export function checkEnvironment(pages: IPageVersion[]): string[] {
  const folders = new Set(pages.filter(page => !page.error).flatMap(page => page.folders));
  return folders.size > 1 ? [`pages serve different versions: ${[...folders].join(", ")}`] : [];
}
