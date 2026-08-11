import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./helpers.js";

/**
 * Acceptance criterion 3. `shared/` has its own openai and zod so the harness can import
 * shared/ai-analysis-messages.ts directly, while the deployed function resolves both from
 * functions-v2/node_modules. Behaviour parity requires the versions to be identical, and nothing
 * else would notice if they drifted.
 */
const lockfiles = {
  shared: path.join(repoRoot, "shared", "package-lock.json"),
  "functions-v2": path.join(repoRoot, "functions-v2", "package-lock.json"),
  "scripts/ai-harness": path.join(repoRoot, "scripts", "ai-harness", "package-lock.json")
};

function resolvedVersion(lockfile: string, packageName: string): string {
  const lock = JSON.parse(fs.readFileSync(lockfile, "utf8"));
  const entry = lock.packages?.[`node_modules/${packageName}`];
  if (!entry?.version) {
    throw new Error(`${lockfile} does not resolve a top-level "${packageName}"`);
  }
  return entry.version;
}

describe("openai and zod versions stay in lockstep", () => {
  for (const packageName of ["openai", "zod"]) {
    it(`resolves the same ${packageName} in all three lockfiles`, () => {
      const versions = Object.fromEntries(
        Object.entries(lockfiles).map(([name, file]) => [name, resolvedVersion(file, packageName)]));
      const distinct = new Set(Object.values(versions));
      expect({ ...versions, distinct: distinct.size }).toEqual({ ...versions, distinct: 1 });
    });
  }

  it("pins exact versions in shared/package.json and scripts/ai-harness/package.json", () => {
    for (const dir of ["shared", path.join("scripts", "ai-harness")]) {
      const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, dir, "package.json"), "utf8"));
      // Merged rather than indexed off `dependencies` directly, so a package.json that moved or
      // dropped the block fails the assertion instead of throwing a TypeError.
      const declared = { ...manifest.devDependencies, ...manifest.dependencies };
      for (const packageName of ["openai", "zod"]) {
        expect(`${dir}: ${packageName}@${declared[packageName]}`)
          .toMatch(/@\d+\.\d+\.\d+$/);
      }
    }
  });
});
