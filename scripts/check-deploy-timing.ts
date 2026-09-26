#!/usr/bin/node

/**
 * Check that a change touching separately deployed parts of CLUE (functions, Firestore/RTDB rules,
 * Firestore indexes) has a Deploy timing callout in its PR description, saying for each part whether
 * it can be deployed before, with, or after the client release, and why. Run by
 * .github/workflows/deploy-timing.yml; see "Deploy timing" in docs/deploy.md.
 *
 * Usage (from the repository root):
 *
 *   npx tsx scripts/check-deploy-timing.ts --base origin/master --body-file pr-body.md
 *
 * The description is read from PR_BODY when --body-file is omitted. Add --json for a
 * machine-readable result. Exits non-zero when the callout is missing or incomplete.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import {
  cannotTouchFunctions, checkDeployTiming, deployablesTouched, deployTimingPasses, parseDeployTiming
} from "./lib/deploy-timing.js";
import { listFunctionsSources } from "./lib/functions-sources.js";

const kDocsUrl =
  "https://github.com/concord-consortium/collaborative-learning/blob/master/docs/deploy.md#deploy-timing";

function parseArgs(argv: string[]) {
  const options = { base: "", bodyFile: "", json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") {
      options.base = argv[++i] ?? "";
    } else if (argv[i] === "--body-file") {
      options.bodyFile = argv[++i] ?? "";
    } else if (argv[i] === "--json") {
      options.json = true;
    } else {
      throw new Error(`unknown argument ${argv[i]}`);
    }
  }
  if (!options.base) throw new Error("--base <ref> is required");
  return options;
}

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const body = options.bodyFile ? fs.readFileSync(options.bodyFile, "utf8") : (process.env.PR_BODY ?? "");
  const repoRoot = git("rev-parse", "--show-toplevel").trim();
  const changedFiles = git("diff", "--name-only", `${options.base}...HEAD`).split("\n").filter(Boolean);

  const functionsSources = cannotTouchFunctions(changedFiles) ? new Set<string>() : listFunctionsSources(repoRoot);
  const touched = deployablesTouched(changedFiles, functionsSources);
  const timing = parseDeployTiming(body);
  const check = checkDeployTiming(touched, timing);
  const pass = deployTimingPasses(check);

  if (options.json) {
    console.log(JSON.stringify({ pass, ...check, entries: timing.entries }, null, 2));
    process.exit(pass ? 0 : 1);
  }

  if (touched.length === 0) {
    console.log("This change doesn't touch functions, rules or indexes; no Deploy timing callout needed.");
    process.exit(0);
  }
  console.log(`This change touches: ${touched.join(", ")}.`);
  if (!check.found) {
    console.log("❌ The PR description has no Deploy timing callout.");
  } else {
    check.missing.forEach(deployable => console.log(`❌ The Deploy timing callout has no entry for ${deployable}.`));
  }
  check.noRationale.forEach(deployable => console.log(`❌ The ${deployable} entry needs a reason after the timing.`));
  check.duplicated.forEach(deployable => console.log(`❌ ${deployable} has more than one entry. Keep one.`));
  check.invalid.forEach(line => console.log(`❌ Can't read this entry: ${line}`));
  check.unneeded.forEach(deployable =>
    console.log(`⚠️  There's an entry for ${deployable}, but this change doesn't touch it; remove it if it's stale.`));

  if (pass) {
    timing.entries.filter(entry => touched.includes(entry.deployable))
      .forEach(entry => console.log(`✅ ${entry.deployable}: ${entry.timing} — ${entry.rationale}`));
  } else {
    console.log(`
Add this to the PR description, with one entry per part and a reason for each:

> [!IMPORTANT]
> **Deploy timing**
${touched.map(deployable => `> - **${deployable}: <before|with|after>** — <why>`).join("\n")}

  before  safe to deploy as soon as it merges; the released client keeps working with it
  with    deploy just before or just after the client release
  after   needs the new client released first
Think about both directions: the new client against the currently deployed part, and the
currently released client against the new part. See ${kDocsUrl}`);
  }
  process.exit(pass ? 0 : 1);
}

main();
