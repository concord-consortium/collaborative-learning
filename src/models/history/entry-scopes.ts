import { HistoryEntrySnapshot } from "./history";

export type EntryScope =
  | { kind: "tile"; id: string }
  | { kind: "shared"; id: string }
  | { kind: "doc" };

export type EntryScopeKey = string;

const TILE_MAP_RE = /^\/content\/tileMap\/([^/]+)(\/|$)/;
const SHARED_MAP_RE = /^\/content\/sharedModelMap\/([^/]+)(\/|$)/;

export function scopeKeyForPatchPath(path: string): EntryScopeKey {
  const tileMatch = TILE_MAP_RE.exec(path);
  if (tileMatch) return `tile:${tileMatch[1]}`;
  const sharedMatch = SHARED_MAP_RE.exec(path);
  if (sharedMatch) return `shared:${sharedMatch[1]}`;
  return "doc";
}

export function getEntryScopeKeys(entry: HistoryEntrySnapshot): Set<EntryScopeKey> {
  const scopes = new Set<EntryScopeKey>();
  const records = entry.records ?? [];
  for (const record of records) {
    const patches = record.patches ?? [];
    for (const patch of patches) {
      scopes.add(scopeKeyForPatchPath(patch.path));
    }
    const inversePatches = record.inversePatches ?? [];
    for (const patch of inversePatches) {
      scopes.add(scopeKeyForPatchPath(patch.path));
    }
  }
  return scopes;
}

export function scopeSetsConflict(
  a: Set<EntryScopeKey>,
  b: Set<EntryScopeKey>
): boolean {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const key of smaller) {
    if (larger.has(key)) return true;
  }
  return false;
}

export function partitionLocalEntriesForMerge(
  localEntries: HistoryEntrySnapshot[],
  remoteEntries: HistoryEntrySnapshot[]
): { keepCount: number; rollbackCount: number } {
  const remoteScopes = new Set<EntryScopeKey>();
  for (const entry of remoteEntries) {
    for (const key of getEntryScopeKeys(entry)) {
      remoteScopes.add(key);
    }
  }

  for (let i = 0; i < localEntries.length; i++) {
    const localScopes = getEntryScopeKeys(localEntries[i]);
    if (scopeSetsConflict(localScopes, remoteScopes)) {
      return { keepCount: i, rollbackCount: localEntries.length - i };
    }
  }
  return { keepCount: localEntries.length, rollbackCount: 0 };
}
