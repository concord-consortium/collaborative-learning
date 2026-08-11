/**
 * On-disk response cache, keyed by the request key (see messages.ts).
 *
 * Successes and refusals are cached — a refusal is a real API response that cost real money, and
 * re-running it would just spend the money again. Errors are never cached.
 */
import fs from "node:fs";
import path from "node:path";
import { ResponseOriginMeta, kSchemaVersion } from "./schemas.js";

export interface CacheEntry {
  schemaVersion: number;
  key: string;
  status: "success" | "refusal";
  /** Present on success. */
  parsed?: unknown;
  /** The full response body as returned by the API. */
  raw: unknown;
  /** Present on refusal. */
  refusal?: string;
  usage: { promptTokens: number; completionTokens: number };
  responseOriginMeta: ResponseOriginMeta;
}

export interface CacheOptions {
  /** `--no-cache` turns both off; `--refresh-cache` turns reads off but leaves writes on. */
  read: boolean;
  write: boolean;
}

export const kDefaultCacheOptions: CacheOptions = { read: true, write: true };

export function cacheOptionsFor(noCache: boolean, refreshCache: boolean): CacheOptions {
  if (noCache && refreshCache) {
    throw new Error("--no-cache and --refresh-cache cannot be combined");
  }
  if (noCache) return { read: false, write: false };
  if (refreshCache) return { read: false, write: true };
  return { ...kDefaultCacheOptions };
}

/**
 * Returns the entry only if it is actually usable. JSON.parse succeeding is not enough: a file
 * truncated at a record boundary can still parse, and the old cast let it through to
 * `rowFromResponse`, which then crashed on a missing `usage`. Anything short of complete is a miss,
 * which is what the module already promised.
 */
export function validateCacheEntry(value: unknown, key: string): CacheEntry | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entry = value as Record<string, any>;
  if (entry.schemaVersion !== kSchemaVersion || entry.key !== key) return undefined;
  if (entry.status !== "success" && entry.status !== "refusal") return undefined;
  // `!== undefined` rather than `in`: a key present but undefined is just as unusable, and this way
  // the check holds for an in-memory object as well as for a file JSON.parse produced.
  if (entry.raw === undefined) return undefined;

  const usage = entry.usage;
  if (usage === null || typeof usage !== "object") return undefined;
  if (!Number.isFinite(usage.promptTokens) || !Number.isFinite(usage.completionTokens)) return undefined;

  const meta = entry.responseOriginMeta;
  if (meta === null || typeof meta !== "object" || typeof meta.date !== "string") return undefined;

  if (entry.status === "refusal" && typeof entry.refusal !== "string") return undefined;
  if (entry.status === "success" && entry.parsed === undefined) return undefined;

  return entry as CacheEntry;
}

export class ResponseCache {
  constructor(private readonly directory: string, private readonly options: CacheOptions = kDefaultCacheOptions) {}

  pathFor(key: string): string {
    return path.join(this.directory, key.slice(0, 2), `${key}.json`);
  }

  get(key: string): CacheEntry | undefined {
    if (!this.options.read) return undefined;
    const file = this.pathFor(key);
    if (!fs.existsSync(file)) return undefined;
    try {
      return validateCacheEntry(JSON.parse(fs.readFileSync(file, "utf8")), key);
    } catch {
      // A truncated or corrupt cache file is a miss, not a crash.
      return undefined;
    }
  }

  put(entry: CacheEntry): void {
    if (!this.options.write) return;
    const file = this.pathFor(entry.key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Write-then-rename, so a crash mid-write leaves either the old entry or none — never a partial
    // file. A corrupt entry is already treated as a miss; this removes the state altogether.
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, file);
  }
}
