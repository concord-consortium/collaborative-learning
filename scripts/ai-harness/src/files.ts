/**
 * Filesystem and process helpers shared across the harness.
 *
 * These live here rather than in `corpus.ts` so that modules which need them do not have to import
 * the corpus module: `corpus.ts` imports `represent-image.ts` (to delete rendered PNGs when a
 * document is pruned), and `represent-image.ts` needs these helpers, which would otherwise be a
 * cycle that happens to work only because both uses are deferred to call time.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The scripts/ai-harness directory. */
export const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readJsonFile(file: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`${file}: cannot be read`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${file}: is not valid JSON (${(error as Error).message})`);
  }
}

/**
 * Write-then-rename, so a crash mid-write leaves either the previous file or none — never a partial
 * one. Everything the harness writes that another command later reads goes through here.
 */
export function writeFileAtomically(file: string, contents: Buffer | string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, contents);
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

export function writeJsonFile(file: string, value: unknown): void {
  writeFileAtomically(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Resolves a path through any symlinks, as far as it exists.
 *
 * `path.resolve` and `path.relative` are purely lexical: they answer "does this string sit under
 * that string", which is not the same question as "does this file sit under that directory". If
 * `data/` — or anything beneath it — is a symlink pointing out of the repository, a plausible way to
 * put a scratch tree on another disk, every lexical check passes and content derived from student
 * documents lands outside the `.gitignore` entry that is supposed to protect it.
 *
 * The target of a write usually does not exist yet, so this walks up to the nearest parent that
 * does, resolves that, and re-appends the rest.
 */
export function realPathAsFarAsExists(candidate: string): string {
  let existing = path.resolve(candidate);
  const trailing: string[] = [];
  for (;;) {
    if (fs.existsSync(existing)) return path.join(fs.realpathSync(existing), ...trailing.reverse());
    const parent = path.dirname(existing);
    // Reached the filesystem root without finding anything that exists.
    if (parent === existing) return path.resolve(candidate);
    trailing.push(path.basename(existing));
    existing = parent;
  }
}

/**
 * True when `candidate` really sits inside `root`, with both resolved through symlinks first.
 * `root` itself does not count as being inside it.
 */
export function isContainedBy(candidate: string, root: string): boolean {
  const relative = path.relative(realPathAsFarAsExists(root), realPathAsFarAsExists(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Runs git in the harness directory, returning its trimmed output or null if it failed. */
export function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: harnessRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trim();
  } catch {
    return null;
  }
}
