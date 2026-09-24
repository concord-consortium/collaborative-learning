#!/usr/bin/node

/**
 * Report which CLUE version production and staging are serving, and check that every way a
 * deployed page names its version agrees.
 *
 * A release copies `version/<tag>/index-top.html` (and the same file for `editor/`,
 * `authoring/` and `authoring-iframe/`) to `index.html` for production and `staging.html` for
 * staging — see .github/workflows/release.yml. For each of those pages this script reads:
 * - the `version/<tag>/` folder the page loads its resources from,
 * - the `appVersion` compiled into the bundle (the "CLUE v…" shown in the UI),
 * - the git sha and tag compiled into the bundle (version.json, scripts/write-version.js),
 * and checks them against each other and against what the tag points to in the local git repo.
 *
 * Usage (from the scripts directory):
 *
 *   npx tsx deployed-version.ts           # text report
 *   npx tsx deployed-version.ts --json    # machine-readable report
 *
 * Exits non-zero when any page is inconsistent or could not be read.
 */

import { execFileSync } from "child_process";
import {
  checkEnvironment, checkPage, extractBuildInfo, extractVersionFolders, extractVersionScripts, IPageVersion
} from "./lib/deployed-version.js";

const kDefaultClueBase = "https://collaborative-learning.concord.org";
/** The directories release.yml deploys a page into. */
const kPageDirs = ["", "editor/", "authoring/", "authoring-iframe/"];
const kEnvironments = [
  { name: "production", file: "index.html" },
  { name: "staging", file: "staging.html" }
];

function usage(message?: string): never {
  if (message) console.error(`\nError: ${message}\n`);
  console.error(`
Usage: npx tsx deployed-version.ts [--json] [--clue-base <url>]

  --json              Print a JSON report instead of text.
  --clue-base <url>   Site to check (default ${kDefaultClueBase}).
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]) {
  const options = { json: false, clueBase: kDefaultClueBase };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help") {
      usage();
    } else if (arg === "--clue-base") {
      const value = argv[++i];
      if (!value) usage("--clue-base needs a url");
      options.clueBase = value.replace(/\/$/, "");
    } else {
      usage(`unknown argument ${arg}`);
    }
  }
  return options;
}

async function fetchText(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

/** What a git tag points to locally, or undefined when the tag isn't known here. */
function localTagSha(tag: string) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "--quiet", `${tag}^{commit}`], { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

function latestLocalReleaseTag() {
  try {
    const tags = execFileSync("git", ["tag", "--list", "v*", "--sort=-v:refname"], { encoding: "utf8" });
    return tags.split("\n").find(tag => /^v\d+\.\d+\.\d+$/.test(tag));
  } catch {
    return undefined;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // Bundles are shared between pages and environments, so fetch each one once.
  const bundles = new Map<string, Promise<string>>();
  const fetchBundle = (url: string) => {
    if (!bundles.has(url)) bundles.set(url, fetchText(url));
    return bundles.get(url)!;
  };

  const readPage = async (page: string): Promise<IPageVersion> => {
    const pageUrl = `${options.clueBase}/${page}`;
    try {
      const html = await fetchText(pageUrl);
      const result: IPageVersion = { page, folders: extractVersionFolders(html) };
      for (const script of extractVersionScripts(html)) {
        const info = extractBuildInfo(await fetchBundle(new URL(script, pageUrl).href));
        result.appVersion ??= info.appVersion;
        result.gitInfo ??= info.gitInfo;
      }
      return result;
    } catch (error: any) {
      return { page, folders: [], error: error.message };
    }
  };

  const environments = await Promise.all(kEnvironments.map(async ({ name, file }) => {
    const pages = await Promise.all(kPageDirs.map(dir => readPage(`${dir}${file}`)));
    const folders = [...new Set(pages.flatMap(page => page.folders))];
    const version = folders.length === 1 ? folders[0] : undefined;
    const tagSha = version ? localTagSha(version) : undefined;
    const checkedPages = pages.map(page => ({ ...page, problems: checkPage(page, tagSha) }));
    const problems = [
      ...checkEnvironment(pages),
      ...(version && !tagSha ? [`tag ${version} not found locally — run \`git fetch --tags\``] : [])
    ];
    return { name, version, tagSha, problems, pages: checkedPages };
  }));

  const latestTag = latestLocalReleaseTag();
  const ok = environments.every(env =>
    env.problems.length === 0 && env.pages.every(page => page.problems.length === 0));

  if (options.json) {
    const report = { clueBase: options.clueBase, latestLocalReleaseTag: latestTag, ok, environments };
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const env of environments) {
      const tagSha = env.tagSha ? ` (tag → ${env.tagSha.slice(0, 9)})` : "";
      console.log(`${env.name}: ${env.version ?? "UNKNOWN"}${tagSha}`);
      for (const page of env.pages) {
        const git = `${page.gitInfo?.tag ?? "-"} ${page.gitInfo?.gitSha?.slice(0, 9) ?? "-"}`;
        const compiled = page.appVersion || page.gitInfo
          ? `appVersion ${page.appVersion ?? "-"}, git ${git}`
          : "no version info in bundle";
        const status = page.problems.length ? `❌ ${page.problems.join("; ")}` : "✅";
        console.log(`  ${page.page.padEnd(30)} ${page.folders.join(",").padEnd(8)} ${compiled}  ${status}`);
      }
      env.problems.forEach(problem => console.log(`  ❌ ${problem}`));
    }
    if (latestTag) console.log(`\nLatest release tag in this repo: ${latestTag}`);
  }
  process.exit(ok ? 0 : 1);
}

main();
