#!/usr/bin/node

/**
 * For the PRs in a release, report when the functions, rules and indexes they change can be
 * deployed relative to the client release, from each PR's Deploy timing callout (see
 * "Deploy timing" in docs/deploy.md). Each part can deploy no earlier than its strictest PR allows;
 * PRs that touch a part without a callout entry are listed by author, so they can be asked.
 *
 * The PR list normally comes from dev-templates' unlinked-prs script, which already works out
 * which PRs are in a release (squash merges, stacked branches, sub-PRs):
 *
 *   npm --prefix ~/Development/dev-templates/scripts run -s unlinked-prs -- \
 *     CLUE 7.6.0 collaborative-learning v7.5.0 master --json > unlinked-prs.json
 *   npx tsx scripts/release-deploy-report.ts --unlinked-prs unlinked-prs.json
 *
 * or pass PR numbers directly with --prs 2977,2980. Open PRs linked to the release's Jira issues
 * are included too, since they are expected to merge before the release. Add --json for a
 * machine-readable report. Run from the repository root; it needs the GitHub CLI (`gh`).
 *
 * Which shared/ files count as functions code is decided from the current checkout, so run it on
 * the commit being released.
 */

import { execFile, execFileSync } from "child_process";
import fs from "fs";
import { promisify } from "util";
import {
  deployablesTouched, IPullRequestTiming, parseDeployTiming, rollupDeployTiming
} from "./lib/deploy-timing.js";
import { listFunctionsSources } from "./lib/functions-sources.js";

const execFileAsync = promisify(execFile);
const kRepo = "concord-consortium/collaborative-learning";
const kConcurrency = 6;

function usage(message?: string): never {
  if (message) console.error(`\nError: ${message}\n`);
  console.error(`
Usage: npx tsx scripts/release-deploy-report.ts (--unlinked-prs <file> | --prs <n,n,...>) [--json]
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]) {
  const options = { unlinkedPrs: "", prs: "", json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--unlinked-prs") {
      options.unlinkedPrs = argv[++i] ?? "";
    } else if (argv[i] === "--prs") {
      options.prs = argv[++i] ?? "";
    } else if (argv[i] === "--json") {
      options.json = true;
    } else if (argv[i] === "--help") {
      usage();
    } else {
      usage(`unknown argument ${argv[i]}`);
    }
  }
  if (!options.unlinkedPrs && !options.prs) usage("give --unlinked-prs or --prs");
  return options;
}

/** Merged PRs in the release, plus open PRs of this repo linked to the release's issues. */
function prsFromUnlinkedPrs(file: string) {
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const numbers = new Set<number>((report.mergedPRs ?? []).map((pr: any) => pr.number));
  for (const issue of report.issues ?? []) {
    for (const pr of issue.prs ?? []) {
      if (pr.repo === kRepo && pr.state === "not merged") numbers.add(pr.number);
    }
  }
  return [...numbers];
}

async function gh(...args: string[]) {
  const { stdout } = await execFileAsync("gh", args, { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

async function readPullRequest(number: number, functionsSources: Set<string>): Promise<IPullRequestTiming> {
  const [view, files] = await Promise.all([
    gh("pr", "view", String(number), "-R", kRepo, "--json", "number,title,author,body"),
    // `gh pr view --json files` stops at 100 files; the API paginates.
    gh("api", "--paginate", `repos/${kRepo}/pulls/${number}/files`, "--jq", ".[].filename")
  ]);
  const pr = JSON.parse(view);
  return {
    number,
    title: pr.title,
    author: pr.author?.login ?? "unknown",
    touched: deployablesTouched(files.split("\n").filter(Boolean), functionsSources),
    timing: parseDeployTiming(pr.body ?? "")
  };
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const numbers = options.unlinkedPrs
    ? prsFromUnlinkedPrs(options.unlinkedPrs)
    : options.prs.split(",").map(n => parseInt(n.trim(), 10)).filter(Boolean);

  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const functionsSources = listFunctionsSources(repoRoot);
  const prs = await mapLimited(numbers.sort((a, b) => a - b), kConcurrency,
    number => readPullRequest(number, functionsSources));
  const rollup = rollupDeployTiming(prs);

  // Who to ask, grouped by author.
  const toAsk = new Map<string, { number: number, title: string, parts: string[] }[]>();
  for (const part of rollup) {
    for (const { number, author, title } of part.missing) {
      const list = toAsk.get(author) ?? [];
      const existing = list.find(pr => pr.number === number);
      if (existing) existing.parts.push(part.deployable);
      else list.push({ number, title, parts: [part.deployable] });
      toAsk.set(author, list);
    }
  }

  if (options.json) {
    const ask = Object.fromEntries(toAsk);
    const touching = prs.filter(pr => pr.touched.length).map(({ number, title, author, touched }) =>
      ({ number, title, author, touched }));
    console.log(JSON.stringify({ prsChecked: prs.length, prsTouching: touching, rollup, toAsk: ask }, null, 2));
    return;
  }

  const touchingCount = prs.filter(pr => pr.touched.length).length;
  console.log(`Checked ${prs.length} PRs; ${touchingCount} change functions, rules or indexes.\n`);
  if (!rollup.length) console.log("Nothing to deploy besides the client.");
  for (const part of rollup) {
    const decided = part.missing.length ? " (undecided: some PRs have no entry)" : "";
    console.log(`${part.deployable}: ${part.timing ?? "unknown"}${decided}`);
    for (const entry of part.entries) {
      console.log(`  #${entry.number} ${entry.timing} (${entry.author}) — ${entry.rationale}`);
    }
    for (const pr of part.missing) {
      console.log(`  #${pr.number} no entry (${pr.author}) — ${pr.title}`);
    }
  }
  if (toAsk.size) {
    console.log("\nTo ask:");
    for (const [author, list] of toAsk) {
      console.log(`  ${author}: ${list.map(pr => `#${pr.number} (${pr.parts.join(", ")})`).join(", ")}`);
    }
  }
}

main();
