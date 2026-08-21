// Plumbing shared by the CLUE-643 repair scripts: reading the realtime database over REST, choosing
// which spaces to run against, and parsing the environment that controls a run.

import { resolveSpace } from "./rtdb-document-index";

/** `SPACES=demo/CLUE,authed/learn_concord_org` limits a run; unset means every space. */
export function parseSpacesFilter(raw: string | undefined): string[] | undefined {
  const names = (raw ?? "").split(",").map(name => name.trim()).filter(Boolean);
  return names.length ? names : undefined;
}

export interface ISelectedSpace {
  label: string;
  spacePath: string;
  rtdbRoot: string;
}

export interface ISpaceSelection {
  selected: ISelectedSpace[];
  /** Spaces deliberately not touched, with the reason, so a run says what it declined. */
  refused: Array<{ label: string; reason: string }>;
  /** Firestore paths whose shape does not map to a realtime-database root. */
  unrecognized: string[];
  /** How many runnable spaces the filter excluded. */
  filteredOut: number;
  /** Filter entries matching no space at all — almost always a typo. */
  filterMisses: string[];
}

/**
 * Decide which spaces a run covers.
 *
 * A filter narrows the runnable set but cannot widen it: naming a refused space still refuses it,
 * because the reasons are about the data rather than about caution.
 */
export function selectSpaces(spacePaths: string[], filter?: string[]): ISpaceSelection {
  const selected: ISelectedSpace[] = [];
  const refused: Array<{ label: string; reason: string }> = [];
  const unrecognized: string[] = [];
  const seenLabels = new Set<string>();
  let filteredOut = 0;

  for (const spacePath of spacePaths) {
    const resolution = resolveSpace(spacePath);
    if (resolution.status === "unrecognized") {
      unrecognized.push(spacePath);
      continue;
    }
    seenLabels.add(resolution.label);
    if (resolution.status === "refused") {
      if (!filter || filter.includes(resolution.label)) {
        refused.push({ label: resolution.label, reason: resolution.reason });
      }
      continue;
    }
    if (filter && !filter.includes(resolution.label)) {
      filteredOut++;
      continue;
    }
    selected.push({ label: resolution.label, spacePath, rtdbRoot: resolution.rtdbRoot });
  }

  return {
    selected, refused, unrecognized, filteredOut,
    filterMisses: (filter ?? []).filter(name => !seenLabels.has(name))
  };
}

/** Just enough of `fetch` for the reader, so tests need no network. */
type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/** Returns an OAuth access token for the service account. */
type GetAccessToken = () => Promise<{ access_token: string }>;

export interface IRtdbReader {
  /** The child keys of a node — a shallow read, which never pulls a subtree. */
  readChildKeys: (path: string) => Promise<string[]>;
  /** A node's whole value, or null when it is absent. */
  readNode: (path: string) => Promise<any>;
}

const kMaxAttempts = 3;

/**
 * Read the realtime database over its REST API.
 *
 * The admin SDK's `.once("value")` would pull an entire subtree, which for a class's documents is far
 * more data than an index needs; `?shallow=true` returns only child keys. A 401 refreshes the token
 * and retries, because a sweep over a large space outlives the token it started with.
 */
export function createRtdbReader(
  host: string,
  getAccessToken: GetAccessToken,
  { fetch: fetchImpl = fetch as unknown as FetchLike }: { fetch?: FetchLike } = {}
): IRtdbReader {
  let token: string | undefined;

  const refresh = async () => { token = (await getAccessToken()).access_token; };

  const encode = (path: string) =>
    path.split("/").map(segment => encodeURIComponent(segment)).join("/");

  const read = async (path: string, shallow: boolean): Promise<any> => {
    for (let attempt = 1; attempt <= kMaxAttempts; attempt++) {
      if (!token) await refresh();
      const url = `${host}${encode(path)}.json?${shallow ? "shallow=true&" : ""}access_token=${token}`;
      const response = await fetchImpl(url);
      if (response.ok) return response.json();
      // The token has expired or been rotated; a fresh one usually fixes it.
      if (response.status === 401) { await refresh(); continue; }
      if (attempt === kMaxAttempts) {
        // Never return empty on failure: that reads as "this space has no documents", and the run
        // would report a clean sweep having looked at nothing.
        throw new Error(`realtime database returned ${response.status} for ${path}`);
      }
    }
    throw new Error(`realtime database could not be read at ${path}`);
  };

  return {
    readChildKeys: async (path) => Object.keys((await read(path, true)) ?? {}),
    readNode: async (path) => (await read(path, false)) ?? null
  };
}
