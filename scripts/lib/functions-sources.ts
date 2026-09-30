import { execFileSync } from "child_process";
import path from "path";
import { kFunctionsCodebases } from "./deploy-timing.js";

/**
 * Pinned so the listing doesn't depend on which codebase's node_modules happen to be installed,
 * and to an exact version so the check doesn't change under a PR. It matches functions-v2's lockfile.
 */
const kTypeScript = "typescript@5.9.2";

/**
 * Every repository file the functions deploy builds compile, as repo-relative paths. This is how a
 * change to a `shared/` file is attributed to the functions only when some function imports it.
 */
export function listFunctionsSources(repoRoot: string) {
  const sources = new Set<string>();
  for (const { dir, tsconfig } of kFunctionsCodebases) {
    let output: string;
    try {
      output = execFileSync("npx", ["-y", "-p", kTypeScript, "tsc", "-p", tsconfig, "--listFilesOnly"],
        { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch (error: any) {
      // Type errors (e.g. missing @types when nothing is installed) make tsc exit non-zero but
      // don't stop it listing files, which is all this needs.
      output = error.stdout ?? "";
    }
    let ownFiles = 0;
    for (const line of output.split("\n")) {
      // tsc also prints diagnostics on stdout; file paths are the absolute lines.
      if (!line.startsWith(repoRoot + path.sep) || line.includes("/node_modules/")) continue;
      const file = path.relative(repoRoot, line);
      sources.add(file);
      if (file.startsWith(`${dir}/`)) ownFiles++;
    }
    // With no listing at all (npx or tsc couldn't run), every shared/ file would look like client
    // code, and a change to one the functions import would pass as needing no deploy timing.
    if (!ownFiles) {
      throw new Error(`tsc listed no files from ${dir}/ for ${tsconfig}, so the functions' sources are unknown`);
    }
  }
  return sources;
}
