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
