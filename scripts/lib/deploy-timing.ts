/**
 * Which separately deployed parts of CLUE a change touches, and whether its PR description says
 * when each part can be deployed relative to the client release, and why. See "Deploy timing" in
 * docs/deploy.md for the format this reads.
 */

export const kDeployables = ["functions", "rules", "indexes"] as const;
export type Deployable = typeof kDeployables[number];

export const kTimings = ["before", "with", "after"] as const;
export type Timing = typeof kTimings[number];

/** The Firebase functions codebases (firebase.json) and the tsconfig their deploy build uses. */
export const kFunctionsCodebases = [
  { dir: "functions-v1", tsconfig: "functions-v1/tsconfig.prod.json" },
  { dir: "functions-v2", tsconfig: "functions-v2/tsconfig.json" },
  { dir: "authoring-api", tsconfig: "authoring-api/tsconfig.json" }
];

const kRulesFiles = ["firestore.rules", "database.rules.json"];
const kIndexesFiles = ["firestore.indexes.json"];
/** shared/ has its own dependencies, which the functions build installs. */
const kSharedDependencyFiles = ["shared/package.json", "shared/package-lock.json"];

/** Files that never ship in a deploy: tests and docs. */
export function isNotDeployed(file: string) {
  return /(^|\/)(test|__tests__|__snapshots__)\//.test(file) || /\.test\.[jt]sx?$/.test(file) || /\.md$/.test(file);
}

/**
 * The deployables a set of changed files touches.
 *
 * `functionsSources` is every source file the functions builds compile (from `tsc --listFilesOnly`),
 * which is how a change to a `shared/` file counts only when some function imports it.
 */
export function deployablesTouched(changedFiles: string[], functionsSources: Set<string>): Deployable[] {
  const touched = new Set<Deployable>();
  for (const file of changedFiles) {
    if (kRulesFiles.includes(file)) touched.add("rules");
    if (kIndexesFiles.includes(file)) touched.add("indexes");
    if (isNotDeployed(file)) continue;
    const inCodebase = kFunctionsCodebases.some(({ dir }) => file.startsWith(`${dir}/`));
    if (inCodebase || functionsSources.has(file) || kSharedDependencyFiles.includes(file)) {
      touched.add("functions");
    }
  }
  return kDeployables.filter(deployable => touched.has(deployable));
}

/** True when no changed file could affect the functions, so their sources needn't be listed. */
export function cannotTouchFunctions(changedFiles: string[]) {
  return changedFiles.every(file =>
    isNotDeployed(file) ||
    !(file.startsWith("shared/") || kFunctionsCodebases.some(({ dir }) => file.startsWith(`${dir}/`))));
}

export interface IDeployTimingEntry {
  deployable: Deployable;
  timing: Timing;
  rationale: string;
}

export interface IDeployTiming {
  /** Whether the description has a Deploy timing callout at all. */
  found: boolean;
  entries: IDeployTimingEntry[];
  /** Entry lines inside the callout that couldn't be read, e.g. an unknown part or timing. */
  invalid: string[];
}

const kAlertStart = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const kHeading = /^>\s*\*\*Deploy timing\*\*\s*$/i;
const kEntry = /^>\s*[-*]\s+\*\*([^:*]+):\s*([^*]+)\*\*\s*(?:[—–:-]\s*)?(.*)$/;

/**
 * Read the Deploy timing callout from a PR description:
 *
 *   > [!IMPORTANT]
 *   > **Deploy timing**
 *   > - **functions: with** — why
 *
 * Only a GitHub alert whose first line is the **Deploy timing** heading counts, so a line that
 * happens to look like an entry elsewhere in the description is never read as one. An entry's
 * rationale may continue on following quoted lines.
 */
export function parseDeployTiming(body: string): IDeployTiming {
  const result: IDeployTiming = { found: false, entries: [], invalid: [] };
  const lines = body.replace(/\r\n?/g, "\n").split("\n").map(line => line.trimEnd());
  for (let i = 0; i < lines.length - 1; i++) {
    if (!kAlertStart.test(lines[i].trim()) || !kHeading.test(lines[i + 1].trim())) continue;
    result.found = true;
    let current: IDeployTimingEntry | undefined;
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith(">"); j++) {
      const line = lines[j].trim();
      const entry = line.match(kEntry);
      if (entry) {
        const deployable = entry[1].trim().toLowerCase() as Deployable;
        const timing = entry[2].trim().toLowerCase() as Timing;
        if (kDeployables.includes(deployable) && kTimings.includes(timing)) {
          current = { deployable, timing, rationale: entry[3].trim() };
          result.entries.push(current);
        } else {
          current = undefined;
          result.invalid.push(line);
        }
      } else if (current) {
        const continuation = line.replace(/^>\s*/, "");
        if (continuation) current.rationale = `${current.rationale} ${continuation}`.trim();
      }
    }
    break;
  }
  return result;
}

export interface IDeployTimingCheck {
  touched: Deployable[];
  found: boolean;
  /** Touched parts with no entry. */
  missing: Deployable[];
  /** Touched parts with an entry but no rationale. */
  noRationale: Deployable[];
  /** Parts with more than one entry. */
  duplicated: Deployable[];
  invalid: string[];
  /** Entries for parts the change doesn't touch; harmless but probably stale. */
  unneeded: Deployable[];
}

export function checkDeployTiming(touched: Deployable[], timing: IDeployTiming): IDeployTimingCheck {
  const result: IDeployTimingCheck = {
    touched, found: timing.found, missing: [], noRationale: [], duplicated: [], invalid: timing.invalid, unneeded: []
  };
  for (const deployable of kDeployables) {
    const entries = timing.entries.filter(entry => entry.deployable === deployable);
    if (!touched.includes(deployable)) {
      if (entries.length) result.unneeded.push(deployable);
      continue;
    }
    if (entries.length === 0) result.missing.push(deployable);
    if (entries.length > 1) result.duplicated.push(deployable);
    if (entries.some(entry => !entry.rationale)) result.noRationale.push(deployable);
  }
  return result;
}

export function deployTimingPasses(check: IDeployTimingCheck) {
  if (check.touched.length === 0) return true;
  return check.found && !check.missing.length && !check.noRationale.length &&
    !check.duplicated.length && !check.invalid.length;
}
