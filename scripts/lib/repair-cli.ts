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

/**
 * The realtime-database URL for each Firebase project we run against.
 *
 * Looked up rather than derived: the projects share no host pattern, so a derived URL would be a
 * plausible guess pointing at nothing — or worse, at another environment, whose classes would then be
 * read as these documents' true homes. Keep in step with `src/lib/firebase-config.ts`.
 */
const kDatabaseUrls: Record<string, string> = {
  "collaborative-learning-ec215": "https://collaborative-learning-ec215.firebaseio.com",
  "collaborative-learning-staging": "https://collaborative-learning-staging-default-rtdb.firebaseio.com"
};

/** The database URL for a credential's project, or the override when one is supplied. */
export function resolveDatabaseUrl(projectId: string, override?: string): string {
  if (override) return override;
  const url = kDatabaseUrls[projectId];
  if (!url) {
    throw new Error(`No realtime database URL known for project "${projectId}". ` +
      `Add it to kDatabaseUrls in scripts/lib/repair-cli.ts, or set DATABASE_URL.`);
  }
  return url;
}

/** Every `<appMode>/<space>/documents` path Firestore holds, for the app modes we might run against. */
export async function listSpacePaths(firestore: any, appModes = ["authed", "demo"]): Promise<string[]> {
  const paths: string[] = [];
  for (const appMode of appModes) {
    for (const space of await firestore.collection(appMode).listDocuments()) {
      paths.push(`${appMode}/${space.id}/documents`);
    }
  }
  return paths;
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
  {
    fetch: fetchImpl = fetch as unknown as FetchLike,
    delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
  }: { fetch?: FetchLike; delay?: (ms: number) => Promise<void> } = {}
): IRtdbReader {
  let token: string | undefined;

  const refresh = async () => { token = (await getAccessToken()).access_token; };

  const encode = (path: string) =>
    path.split("/").map(segment => encodeURIComponent(segment)).join("/");

  const read = async (path: string, shallow: boolean): Promise<any> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= kMaxAttempts; attempt++) {
      if (!token) await refresh();
      const url = `${host}${encode(path)}.json?${shallow ? "shallow=true&" : ""}access_token=${token}`;
      try {
        const response = await fetchImpl(url);
        if (response.ok) return response.json();
        // The token has expired or been rotated; a fresh one usually fixes it.
        if (response.status === 401) { await refresh(); continue; }
        // Never return empty on failure: that reads as "this space has no documents", and the run
        // would report a clean sweep having looked at nothing.
        lastError = new Error(`realtime database returned ${response.status} for ${path}`);
      } catch (err) {
        // A rejected fetch is a transport failure — DNS, a dropped connection, a socket timeout.
        // A sweep makes tens of thousands of requests, so one of these is expected rather than
        // exceptional, and must not end the run.
        lastError = err;
      }
      // Backs off, so a retry does not land inside the same outage that caused the failure.
      if (attempt < kMaxAttempts) await delay(attempt * 1000);
    }
    throw lastError ?? new Error(`realtime database could not be read at ${path}`);
  };

  return {
    readChildKeys: async (path) => Object.keys((await read(path, true)) ?? {}),
    readNode: async (path) => (await read(path, false)) ?? null
  };
}
