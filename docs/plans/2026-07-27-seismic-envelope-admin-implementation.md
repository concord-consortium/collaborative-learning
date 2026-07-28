# Seismic Envelope Admin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add envelope coverage timelines to the seismic admin and make Update generate + upload missing envelope tiles to S3 (before event coverage), per [2026-07-27-seismic-envelope-admin-design.md](2026-07-27-seismic-envelope-admin-design.md).

**Architecture:** Coverage is read via anonymous S3 `ListObjectsV2` on each station's `L2/` prefix and classified into per-day states. Update streams OPFS raw day files through the existing envelope pipeline, then merge-uploads each flushed tile (GET + elementwise min/max merge + conditional PUT) using STS credentials from token-service, obtained with a portal JWT from an OAuth login in the admin header. All new services take injectable deps, mirroring `processUncoveredRanges`.

**Tech Stack:** TypeScript, MobX, Jest. New runtime deps: `@concord-consortium/token-service@2.2.0`, `aws4fetch@1.0.20`.

**Conventions for the implementing engineer:**
- Run jest with `npm test -- --no-watchman <path>` (watchman hangs on this machine).
- Run `npm run lint:build` and `npm run check:types` before each commit.
- Use `classNames` (not template literals) for any conditional JSX classes.
- Do NOT add or modify SCSS without asking the user first — reuse existing classes
  (`.data-section`, `.data-section-header`, `.data-kind`, `.data-stats`, `.station-actions`).
- `location` on `StationData` may be `undefined` or `""` — both mean blank; normalize with `?? ""`.

**Ops prerequisites (manual, not code tasks — needed only for the final manual verification):**
1. token-service Firestore docs (staging first): tool settings doc + resource doc id `v2` per the design doc.
2. IAM: token-service STS role permitted on `models-resources`.
3. Verify `models-resources` CORS allows `authorization`/`x-amz-*` headers on PUT.
4. Portal OAuth client registered for the admin URLs (incl. `http://localhost:8080/seismic-admin/`).

---

### Task 1: Add dependencies

**Files:** Modify: `package.json`, `package-lock.json`

**Step 1:** `npm install --save @concord-consortium/token-service@2.2.0 aws4fetch@1.0.20`

**Step 2:** Verify: `npm run check:types` passes; `git diff package.json` shows only the two deps.

**Step 3:** Commit: `git commit -am "Add token-service client and aws4fetch for envelope upload"`

---

### Task 2: Envelope coverage listing & classification (`shared/seismic/envelope-coverage.ts`)

**Files:**
- Create: `shared/seismic/envelope-coverage.ts`, `shared/seismic/envelope-coverage.test.ts`

**Step 1: Write failing tests** (`envelope-coverage.test.ts`). Key cases:

```ts
import { classifyEnvelopeDayCoverage, listEnvelopeTileIndices, missingEnvelopeDaySpans }
  from "./envelope-coverage";
import { getTileIndicesForViewport } from "./tile-addressing";
import { dayRange } from "./seismic-day";

// Helper: fake ListObjectsV2 XML response
function listXml(keys: string[], nextToken?: string) {
  const contents = keys.map(k => `<Contents><Key>${k}</Key></Contents>`).join("");
  const truncated = nextToken
    ? `<IsTruncated>true</IsTruncated><NextContinuationToken>${nextToken}</NextContinuationToken>`
    : `<IsTruncated>false</IsTruncated>`;
  return `<?xml version="1.0"?><ListBucketResult>${truncated}${contents}</ListBucketResult>`;
}
const okResponse = (text: string) => ({ ok: true, status: 200, text: async () => text });

describe("listEnvelopeTileIndices", () => {
  const station = { network: "AK", station: "K204", location: "00", channel: "HNZ" };

  it("extracts tile indices from listed keys", async () => {
    const fetchFn = jest.fn().mockResolvedValue(okResponse(listXml([
      "collaborative-learning/envelopes/v2/AK_K204/00/HNZ/L2/56123",
      "collaborative-learning/envelopes/v2/AK_K204/00/HNZ/L2/56124",
    ])));
    expect(await listEnvelopeTileIndices(station, fetchFn as any)).toEqual(new Set([56123, 56124]));
    // Request uses the station's L2 prefix
    expect(fetchFn.mock.calls[0][0]).toContain(encodeURIComponent("v2/AK_K204/00/HNZ/L2/"));
  });

  it("follows continuation tokens", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(okResponse(listXml([".../L2/1"], "tok/en+1")))
      .mockResolvedValueOnce(okResponse(listXml([".../L2/2"])));
    expect(await listEnvelopeTileIndices(station, fetchFn as any)).toEqual(new Set([1, 2]));
    expect(fetchFn.mock.calls[1][0]).toContain(`continuation-token=${encodeURIComponent("tok/en+1")}`);
  });

  it("throws on a non-OK response", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "" });
    await expect(listEnvelopeTileIndices(station, fetchFn as any)).rejects.toThrow("403");
  });
});

describe("classifyEnvelopeDayCoverage", () => {
  // Use real tile math: day N is covered iff all L2 tiles overlapping it are present.
  const day = 20500;                       // arbitrary day index
  const { start, end } = dayRange(day);
  const dayTiles = getTileIndicesForViewport(start, end, 2);   // 3-4 indices
  const range = { start, end };

  it("classifies covered / partial / uncovered", () => {
    expect(classifyEnvelopeDayCoverage(new Set(dayTiles), range).get(day)).toBe("covered");
    expect(classifyEnvelopeDayCoverage(new Set([dayTiles[0]]), range).get(day)).toBe("partial");
    expect(classifyEnvelopeDayCoverage(new Set(), range).get(day)).toBe("uncovered");
  });
});

describe("missingEnvelopeDaySpans", () => {
  it("returns contiguous runs of not-fully-covered days", () => {
    const day = 20500;
    const { start } = dayRange(day);
    const range = { start, end: start + 3 * 86400 };       // 3 days
    const middleDayTiles = getTileIndicesForViewport(...Object.values(dayRange(day + 1)) as [number, number], 2);
    // middle day fully covered -> two single-day spans
    expect(missingEnvelopeDaySpans(new Set(middleDayTiles), range))
      .toEqual([{ startDay: day, endDay: day }, { startDay: day + 2, endDay: day + 2 }]);
  });
});
```

**Step 2:** `npm test -- --no-watchman shared/seismic/envelope-coverage.test.ts` — expect FAIL (module missing).

**Step 3: Implement** `shared/seismic/envelope-coverage.ts`:

```ts
import { FINEST_LEVEL, S3_PREFIX, TILE_BASE_URL } from "./envelope-config";
import { dayIndex, dayRange } from "./seismic-day";
import { DayCoverageState, DaySpan, StationData, TimeRange } from "./seismic-types";
import { getS3Root, getStationChannelPrefix, getTileIndicesForViewport } from "./tile-addressing";

type ListFetchFn = (url: string) => Promise<Pick<Response, "ok" | "status" | "text">>;

/** All existing L2 tile indices for a station, via anonymous paginated S3 listing. */
export async function listEnvelopeTileIndices(
  stationData: StationData, fetchFn: ListFetchFn = fetch
): Promise<Set<number>> {
  const prefix = `${getS3Root(S3_PREFIX)}${getStationChannelPrefix(stationData)}/L${FINEST_LEVEL}/`;
  const indices = new Set<number>();
  let continuationToken: string | undefined;
  do {
    let url = `${TILE_BASE_URL}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
    if (continuationToken) url += `&continuation-token=${encodeURIComponent(continuationToken)}`;
    const response = await fetchFn(url);
    if (!response.ok) throw new Error(`Envelope tile listing failed: ${response.status}`);
    const doc = new DOMParser().parseFromString(await response.text(), "text/xml");
    for (const keyEl of Array.from(doc.getElementsByTagName("Key"))) {
      const key = keyEl.textContent ?? "";
      const index = Number(key.slice(key.lastIndexOf("/") + 1));
      if (Number.isInteger(index)) indices.add(index);
    }
    const truncated = doc.getElementsByTagName("IsTruncated")[0]?.textContent === "true";
    continuationToken = truncated
      ? doc.getElementsByTagName("NextContinuationToken")[0]?.textContent ?? undefined
      : undefined;
  } while (continuationToken);
  return indices;
}

/** Envelope coverage state for each UTC day in [range.start, range.end):
 *  covered when every overlapping L2 tile exists, partial when some do. */
export function classifyEnvelopeDayCoverage(
  tileIndices: Set<number>, range: TimeRange
): Map<number, DayCoverageState> {
  const states = new Map<number, DayCoverageState>();
  for (let day = dayIndex(range.start); day <= dayIndex(range.end - 1); day++) {
    const { start, end } = dayRange(day);
    const overlapping = getTileIndicesForViewport(start, end, FINEST_LEVEL);
    const present = overlapping.filter(i => tileIndices.has(i)).length;
    states.set(day, present === overlapping.length ? "covered" : present > 0 ? "partial" : "uncovered");
  }
  return states;
}

/** Contiguous runs of days in range that are not fully covered. */
export function missingEnvelopeDaySpans(tileIndices: Set<number>, range: TimeRange): DaySpan[] {
  const spans: DaySpan[] = [];
  for (const [day, state] of classifyEnvelopeDayCoverage(tileIndices, range)) {
    const last = spans[spans.length - 1];
    if (state === "covered") continue;
    if (last && last.endDay === day - 1) {
      last.endDay = day;
    } else {
      spans.push({ startDay: day, endDay: day });
    }
  }
  return spans;
}
```

**Step 4:** Tests pass. **Step 5:** Commit: `"Add envelope coverage listing and day classification"`

---

### Task 3: Tile merge (in `shared/seismic/envelope-codec.ts`)

The merge operates on the codec's quantized `EnvelopeTileData` representation (the upload flow
is decode → merge → encode), so it lives beside `encodeEnvelopeTile`/`decodeEnvelopeTile`.

**Files:** Modify: `shared/seismic/envelope-codec.ts`, `shared/seismic/envelope-codec.test.ts`

**Step 1: Failing tests.** Cases: both sentinel → sentinel; one side data → that side (both channels move together — a point is "present" only when *both* min and max are non-sentinel); both data → min-of-mins/max-of-maxes; length mismatch throws.

```ts
import { NO_DATA_SENTINEL } from "./envelope-config";
import { mergeEnvelopeTileData } from "./envelope-codec";

const S = NO_DATA_SENTINEL;
const tile = (mins: number[], maxs: number[]) =>
  ({ mins: Int16Array.from(mins), maxs: Int16Array.from(maxs) });

describe("mergeEnvelopeTileData", () => {
  it("merges elementwise: sentinel yields, overlaps take min/max", () => {
    const a = tile([S, -10, -20], [S, 10, 20]);
    const b = tile([-5, S, -15], [5, S, 25]);
    const merged = mergeEnvelopeTileData(a, b);
    expect([...merged.mins]).toEqual([-5, -10, -20]);
    expect([...merged.maxs]).toEqual([5, 10, 25]);
  });
  it("throws on length mismatch", () => {
    expect(() => mergeEnvelopeTileData(tile([1], [1]), tile([1, 2], [1, 2]))).toThrow();
  });
});
```

**Step 2:** Run — FAIL. **Step 3: Implement** — append to `envelope-codec.ts` (and add
`NO_DATA_SENTINEL` to its existing `./envelope-config` import):

```ts
/**
 * Merge two envelope tiles for the same tile index. A point where either side is
 * sentinel takes the other side's value; where both have data, the result is
 * min-of-mins / max-of-maxes — the correct envelope over the union of the raw
 * samples each side covered, which makes incremental re-generation idempotent.
 */
export function mergeEnvelopeTileData(a: EnvelopeTileData, b: EnvelopeTileData): EnvelopeTileData {
  const n = a.mins.length;
  if (n !== b.mins.length) {
    throw new Error(`Cannot merge envelope tiles of different sizes (${n} and ${b.mins.length})`);
  }
  const mins = new Int16Array(n);
  const maxs = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const aHas = a.mins[i] !== NO_DATA_SENTINEL && a.maxs[i] !== NO_DATA_SENTINEL;
    const bHas = b.mins[i] !== NO_DATA_SENTINEL && b.maxs[i] !== NO_DATA_SENTINEL;
    mins[i] = aHas && bHas ? Math.min(a.mins[i], b.mins[i]) : aHas ? a.mins[i] : b.mins[i];
    maxs[i] = aHas && bHas ? Math.max(a.maxs[i], b.maxs[i]) : aHas ? a.maxs[i] : b.maxs[i];
  }
  return { mins, maxs };
}
```

**Step 4:** Tests pass. **Step 5:** Commit: `"Add envelope tile merge for incremental uploads"`

---

### Task 4: Shared channel metadata lookup — ALREADY DONE

Completed ahead of plan execution: `getMetadataForChannel` was moved from
`SeismicQueryService` into `shared/seismic/channel-metadata-utils.ts` (with tests), and the
script's duplicate `findSensitivity` was replaced by a thin `requireMetadataForChannel`
wrapper over it. The processor in Task 8 imports `getMetadataForChannel` from there.
Nothing to do for this task.

---

### Task 5: Envelope uploader & credentials (`src/models/stores/seismic/envelope-uploader.ts`)

One module for the S3 write path: the token-service credentials provider produces exactly the
`AwsCredentials` the uploader consumes, so both live here. In `src/models/stores/seismic/`
(not seismic-admin) because Wave Runner (part 2) will use them too.

**Files:** Create: `src/models/stores/seismic/envelope-uploader.ts`, `src/models/stores/seismic/envelope-uploader.test.ts`

**Step 1: Failing tests.** Inject both `fetchFn` (plain GET) and `signFetch` (signed PUT) —
jsdom lacks `Request`/SubtleCrypto, so aws4fetch signing itself is not unit-tested (manual
verification covers it). Cases:

1. New tile (GET 404): PUT body is the encoded tile, headers include `If-None-Match: *`.
2. Existing tile: GET returns encoded tile + ETag; PUT body decodes to the *merged* tile and
   headers include `If-Match: <etag>`; GET was called with `cache: "no-store"`.
3. 412 conflict: PUT returns 412 once → re-GET, re-merge, second PUT succeeds.
4. Persistent 412: throws after 3 retries.
5. Non-412 PUT failure and non-404 GET failure: throw.
6. `createEnvelopeCredentialsProvider` (inject a fake client factory): resource id is
   `v${ENVELOPE_LAYOUT_VERSION}`; credentials are cached across calls; a new client + fetch
   happens once the cached credentials are within 5 minutes of expiry
   (use `jest.spyOn(Date, "now")`).

```ts
import { encodeEnvelopeTile, decodeEnvelopeTile } from "../../../../shared/seismic/envelope-codec";
import { createEnvelopeUploader } from "./envelope-uploader";

const station = { network: "AK", station: "K204", location: "00", channel: "HNZ" };
const tile = { mins: Int16Array.from([-10]), maxs: Int16Array.from([10]) };
const existingTile = { mins: Int16Array.from([-20]), maxs: Int16Array.from([5]) };
const notFound = { ok: false, status: 404, headers: { get: () => null } };
const found = {
  ok: true, status: 200,
  headers: { get: (h: string) => h === "ETag" ? '"abc"' : null },
  arrayBuffer: async () => encodeEnvelopeTile(existingTile.mins, existingTile.maxs),
};
const putOk = { ok: true, status: 200 };

it("PUTs a new tile with If-None-Match", async () => {
  const fetchFn = jest.fn().mockResolvedValue(notFound);
  const signFetch = jest.fn().mockResolvedValue(putOk);
  const uploader = createEnvelopeUploader({ getCredentials: jest.fn(), fetchFn, signFetch } as any);
  await uploader.uploadTile(station, 2, 56123, tile);
  const [url, init] = signFetch.mock.calls[0];
  expect(url).toContain("v2/AK_K204/00/HNZ/L2/56123");
  expect(init.headers["If-None-Match"]).toBe("*");
  expect([...decodeEnvelopeTile(init.body).mins]).toEqual([-10]);
});

it("merges with an existing tile and PUTs with If-Match", async () => {
  const fetchFn = jest.fn().mockResolvedValue(found);
  const signFetch = jest.fn().mockResolvedValue(putOk);
  const uploader = createEnvelopeUploader({ getCredentials: jest.fn(), fetchFn, signFetch } as any);
  await uploader.uploadTile(station, 2, 56123, tile);
  const [, init] = signFetch.mock.calls[0];
  expect(init.headers["If-Match"]).toBe('"abc"');
  expect([...decodeEnvelopeTile(init.body).mins]).toEqual([-20]);   // min of -10/-20
  expect([...decodeEnvelopeTile(init.body).maxs]).toEqual([10]);    // max of 10/5
});
// ...plus the 412-retry, retry-exhaustion, and error cases
```

**Step 2:** Run — FAIL. **Step 3: Implement:**

```ts
import { AwsClient } from "aws4fetch";
import { TokenServiceClient } from "@concord-consortium/token-service";
import { decodeEnvelopeTile, encodeEnvelopeTile, mergeEnvelopeTileData }
  from "../../../../shared/seismic/envelope-codec";
import { AWS_REGION, ENVELOPE_LAYOUT_VERSION, S3_PREFIX, TILE_BASE_URL }
  from "../../../../shared/seismic/envelope-config";
import { EnvelopeTileData, StationData } from "../../../../shared/seismic/seismic-types";
import { getS3Root, getTileS3Key } from "../../../../shared/seismic/tile-addressing";

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

type SignFetchFn = (url: string, init: {
  method: string; body: ArrayBuffer; headers: Record<string, string>;
}) => Promise<Pick<Response, "ok" | "status">>;

export interface EnvelopeUploaderDeps {
  getCredentials: () => Promise<AwsCredentials>;
  /** Plain (anonymous) fetch used for the read side; tests inject a fake. */
  fetchFn?: typeof fetch;
  /** Signed fetch used for PUTs; the default signs with aws4fetch. Tests inject a fake. */
  signFetch?: SignFetchFn;
}

const MAX_CONFLICT_RETRIES = 3;

export interface EnvelopeUploader {
  uploadTile(stationData: StationData, level: number, tileIndex: number,
    tile: EnvelopeTileData): Promise<void>;
}

export function createEnvelopeUploader(deps: EnvelopeUploaderDeps): EnvelopeUploader {
  const fetchFn = deps.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const signFetch: SignFetchFn = deps.signFetch ?? (async (url, init) => {
    const { accessKeyId, secretAccessKey, sessionToken } = await deps.getCredentials();
    const aws = new AwsClient({ accessKeyId, secretAccessKey, sessionToken,
      service: "s3", region: AWS_REGION });
    const signed = await aws.sign(url, init);
    return fetchFn(signed);
  });

  return {
    async uploadTile(stationData, level, tileIndex, tile) {
      const url = `${TILE_BASE_URL}${getS3Root(S3_PREFIX)}${getTileS3Key(stationData, level, tileIndex)}`;
      for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
        // no-store: a cached GET would produce a stale ETag and a spurious 412 loop.
        const existing = await fetchFn(url, { cache: "no-store" });
        let merged = tile;
        let etag: string | null = null;
        if (existing.ok) {
          etag = existing.headers.get("ETag");
          merged = mergeEnvelopeTileData(decodeEnvelopeTile(await existing.arrayBuffer()), tile);
        } else if (existing.status !== 404) {
          throw new Error(`Envelope tile read failed: ${existing.status}`);
        }
        const put = await signFetch(url, {
          method: "PUT",
          body: encodeEnvelopeTile(merged.mins, merged.maxs),
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "gzip",
            ...(etag ? { "If-Match": etag } : { "If-None-Match": "*" }),
          },
        });
        if (put.ok) return;
        if (put.status !== 412) throw new Error(`Envelope tile upload failed: ${put.status}`);
      }
      throw new Error(`Envelope tile upload conflicted ${MAX_CONFLICT_RETRIES + 1} times`);
    },
  };
}

// ---- Credentials ----

export const ENVELOPE_RESOURCE_ID = `v${ENVELOPE_LAYOUT_VERSION}`;
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

interface TimedCredentials extends AwsCredentials { expiration: string; }
type GetCredentialsClient = Pick<TokenServiceClient, "getCredentials">;

export interface EnvelopeCredentialsDeps {
  /** Returns a fresh portal-signed Firebase JWT (admin: via OAuth token; Wave Runner: rawFirebaseJWT). */
  getJwt: () => Promise<string>;
  env?: "staging" | "production";
  /** Test seam. */
  createClient?: (jwt: string, env: "staging" | "production") => GetCredentialsClient;
}

/** getCredentials source for createEnvelopeUploader: token-service STS credentials,
 *  cached until near expiry. */
export function createEnvelopeCredentialsProvider(deps: EnvelopeCredentialsDeps) {
  const { getJwt, env = "production" } = deps;
  const createClient = deps.createClient ?? ((jwt, e) => new TokenServiceClient({ jwt, env: e }));
  let cached: TimedCredentials | undefined;
  return async (): Promise<AwsCredentials> => {
    if (cached && new Date(cached.expiration).getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return cached;
    }
    const client = createClient(await getJwt(), env);
    cached = await client.getCredentials(ENVELOPE_RESOURCE_ID) as TimedCredentials;
    return cached;
  };
}
```

Note: check the actual `Credentials` type exported by `@concord-consortium/token-service` and
adjust the cast (it includes `accessKeyId`, `secretAccessKey`, `sessionToken`, `expiration`).

**Step 4:** Tests pass. **Step 5:** Commit: `"Add envelope tile uploader with token-service credentials"`

---

### Task 6: Portal OAuth utilities (`src/seismic-admin/utils/portal-auth.ts`)

**Files:** Create: `src/seismic-admin/utils/portal-auth.ts`, `src/seismic-admin/utils/portal-auth.test.ts`

**Step 1: Failing tests** for the pure/storage parts (jsdom provides `sessionStorage` and lets
tests set `window.location` pieces via `history.replaceState`):

- `buildAuthorizeUrl()` contains `response_type=token`, `client_id=seismic-admin`, and the
  URI-encoded redirect.
- `consumeAccessTokenFromLocation()` with a hash `#access_token=abc&token_type=bearer` returns
  `"abc"`, stores it in sessionStorage, and clears the hash; returns the stored token when the
  hash has none; returns null when neither exists.
- `getPortalUrl()` returns the default and honors `?portal=`.

**Step 3: Implement:**

```ts
const DEFAULT_PORTAL_URL = "https://learn.concord.org";
/** Must match the OAuth client registered in the portal for the admin page. */
export const OAUTH_CLIENT_ID = "seismic-admin";
const ACCESS_TOKEN_KEY = "seismic-admin-portal-access-token";

export function getPortalUrl(): string {
  const param = new URLSearchParams(window.location.search).get("portal");
  return param ? `https://${param.replace(/^https?:\/\//, "")}` : DEFAULT_PORTAL_URL;
}

export function buildAuthorizeUrl(): string {
  const redirectUri = window.location.origin + window.location.pathname + window.location.search;
  return `${getPortalUrl()}/auth/oauth_authorize?response_type=token` +
    `&client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/** Access token from the OAuth redirect hash (persisting it), else from sessionStorage. */
export function consumeAccessTokenFromLocation(): string | null {
  const match = /access_token=([^&]+)/.exec(window.location.hash);
  if (match) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, match[1]);
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return match[1];
  }
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** Exchange a portal access token for the portal-signed Firebase JWT token-service verifies. */
export async function fetchPortalFirebaseJwt(accessToken: string): Promise<string> {
  const url = `${getPortalUrl()}/api/v1/jwt/firebase?firebase_app=token-service`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Portal JWT fetch failed: ${response.status}`);
  return (await response.json()).token;
}
```

**Step 4:** Tests pass. **Step 5:** Commit: `"Add portal OAuth utilities for seismic admin"`

---

### Task 7: Credentials provider — FOLDED INTO TASK 5

`createEnvelopeCredentialsProvider` lives in `envelope-uploader.ts` (see Task 5); it does not
get its own file. Nothing to do for this task.

---

### Task 8: Envelope processor (`src/models/stores/seismic/seismic-envelope-processor.ts`)

**Files:** Create: `src/models/stores/seismic/seismic-envelope-processor.ts` + test

**Step 1: Failing tests.** All seams injected: `listTiles`, `cache` (readDayChunk), `parseDay`,
`fetchMetadata`, `uploadTile`. Fabricate metadata with `scale: 1`, `instrumentCode: "H"`, and
one-segment days (constant sample rate) so expected tile contents are computable. Cases:

1. Fully covered range → returns zeros, never fetches metadata or reads the cache.
2. One missing day with raw data → uploads the day's L2 tiles; uploaded tile data round-trips
   through `decodeEnvelopeTile`... (uploadTile receives `EnvelopeTileData` — verify a known
   window's quantized min/max value); `onProgress` called with (0,1) then (1,1);
   `onTileUploaded` fired per upload; result counts `{processedDays: 1, skippedDays: 0}`.
3. Missing day with no OPFS file → skippedDays incremented, no uploads for it.
4. Segments processed in time order even when parseDay returns them out of order.
5. Missing channel metadata or unknown instrument code → the call rejects up front, before
   any day is read or uploaded (the quantization range is resolved once per channel).

**Step 3: Implement:**

```ts
import { miniseed } from "seisplotjs";
import { getMetadataForChannel } from "../../../../shared/seismic/channel-metadata-utils";
import { quantize } from "../../../../shared/seismic/envelope-codec";
import { AMPLITUDE_RANGES, FINEST_LEVEL, LEVEL_SPACINGS } from "../../../../shared/seismic/envelope-config";
import { computeEnvelopesFromRaw } from "../../../../shared/seismic/envelope-compute";
import { listEnvelopeTileIndices, missingEnvelopeDaySpans } from "../../../../shared/seismic/envelope-coverage";
import { createPipelineState, flushTiles, processL2Point } from "../../../../shared/seismic/envelope-pipeline";
import { createOpfsCache, SeismicCache } from "../../../../shared/seismic/opfs-seismic-cache";
import { fetchStationMetadata } from "../../../../shared/seismic/earthscope-client";
import { ChannelMetadata, EnvelopeTileData, RawSegment, StationData, StationId, TimeRange }
  from "../../../../shared/seismic/seismic-types";

export interface ProcessEnvelopeOptions {
  stationData: StationData;
  /** Unix seconds; caller guarantees day-aligned bounds (same contract as processUncoveredRanges). */
  range: TimeRange;
  uploadTile: (level: number, tileIndex: number, tile: EnvelopeTileData) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
  /** Fires after each successful upload; level 2 events drive the live timeline fill. */
  onTileUploaded?: (level: number, tileIndex: number) => void;
  /** Test seams; production defaults construct real ones. */
  cache?: Pick<SeismicCache, "readDayChunk">;
  listTiles?: (s: StationData) => Promise<Set<number>>;
  fetchMetadata?: (s: StationId) => Promise<ChannelMetadata[]>;
  parseDay?: (buffer: ArrayBuffer) => RawSegment[];
}

/** Parse one OPFS day file into raw-count segments (sensitivity applied later). */
function defaultParseDay(buffer: ArrayBuffer): RawSegment[] {
  const records = miniseed.parseDataRecords(buffer);
  const seismogram = miniseed.merge(records);
  const segments: RawSegment[] = [];
  for (const seg of seismogram?.segments ?? []) {
    segments.push({
      startTime: seg.startTime.toSeconds(),
      sampleRate: seg.sampleRate,
      samples: new Float64Array(seg.y),
    });
  }
  return segments;
}

/**
 * Generate envelope tiles for every day in range not already fully covered in S3,
 * streaming OPFS raw data through the envelope pipeline and merge-uploading each
 * flushed tile. Runs before event coverage in the admin update flow.
 */
export async function processEnvelopeCoverage(options: ProcessEnvelopeOptions):
  Promise<{ uploadedTiles: number; processedDays: number; skippedDays: number; totalDays: number }> {
  const { stationData, range, uploadTile, onProgress, onTileUploaded } = options;

  const tiles = await (options.listTiles ?? listEnvelopeTileIndices)(stationData);
  const spans = missingEnvelopeDaySpans(tiles, range);
  const totalDays = spans.reduce((sum, s) => sum + (s.endDay - s.startDay + 1), 0);
  onProgress?.(0, totalDays);
  if (!spans.length) return { uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 0 };

  const metadata = await (options.fetchMetadata ?? fetchStationMetadata)(stationData);
  const cache = options.cache ?? createOpfsCache();
  const parseDay = options.parseDay ?? defaultParseDay;

  // instrumentCode is the channel code's 2nd character, identical across all of a channel's metadata epochs.
  const channelMetadata = getMetadataForChannel(metadata, stationData, range.start);
  if (!channelMetadata) throw new Error(`No metadata for channel ${stationData.channel}`);
  const rangeMax = AMPLITUDE_RANGES[channelMetadata.instrumentCode];
  if (!rangeMax) throw new Error(`Unknown instrument code "${channelMetadata.instrumentCode}"`);

  let uploadedTiles = 0;
  let processedDays = 0;
  let skippedDays = 0;

  // flushTiles takes a sync callback, so completed tiles queue here and upload after.
  const pending: { level: number; tileIndex: number; tile: EnvelopeTileData }[] = [];
  const queueTile = (level: number, tileIndex: number, tile: EnvelopeTileData) =>
    pending.push({ level, tileIndex, tile });
  const uploadPending = async () => {
    for (const { level, tileIndex, tile } of pending.splice(0)) {
      await uploadTile(level, tileIndex, tile);
      uploadedTiles++;
      onTileUploaded?.(level, tileIndex);
    }
  };

  for (const span of spans) {
    // Each span gets fresh pipeline state; boundary tiles are completed by merge-on-upload.
    const state = createPipelineState();
    for (let day = span.startDay; day <= span.endDay; day++) {
      const buffer = await cache.readDayChunk(stationData, day);
      if (!buffer) {
        // No raw data (unavailable at EarthScope): the day can never get envelopes.
        skippedDays++;
        onProgress?.(processedDays + skippedDays, totalDays);
        continue;
      }
      const segments = parseDay(buffer).sort((a, b) => a.startTime - b.startTime);
      for (const seg of segments) {
        const segMetadata = getMetadataForChannel(metadata, stationData, seg.startTime);
        if (!segMetadata) throw new Error(`No metadata for channel ${stationData.channel}`);
        const { scale } = segMetadata;
        const physical = new Float64Array(seg.samples.length);
        for (let i = 0; i < seg.samples.length; i++) physical[i] = seg.samples[i] / scale;
        const { mins, maxs, times } =
          computeEnvelopesFromRaw(physical, seg.sampleRate, LEVEL_SPACINGS[FINEST_LEVEL], seg.startTime);
        for (let i = 0; i < mins.length; i++) {
          processL2Point(state, times[i], quantize(mins[i], rangeMax), quantize(maxs[i], rangeMax));
        }
      }
      flushTiles(state, queueTile);
      await uploadPending();
      processedDays++;
      onProgress?.(processedDays + skippedDays, totalDays);
    }
    flushTiles(state, queueTile, true);
    await uploadPending();
  }

  return { uploadedTiles, processedDays, skippedDays, totalDays };
}
```

**Step 4:** Tests pass. **Step 5:** Commit: `"Add envelope coverage processor"`

---

### Task 9: Store — envelope coverage state & display data

**Files:** Modify: `src/seismic-admin/seismic-admin-store.ts`, `src/seismic-admin/seismic-admin-store.test.ts`

Follow the existing `modelCoverage` patterns. New store imports:

```ts
import { classifyEnvelopeDayCoverage, listEnvelopeTileIndices }
  from "../../shared/seismic/envelope-coverage";
```

**⚠️ Existing-test impact:** sub-step 9d makes `isFullyCovered` require envelope coverage, so
every existing `isFullyCovered` fixture must gain envelope coverage or those tests go red. Give
`makeCoverageStore` and `makeUpdateStore` a default lister that covers any test range:

```ts
// Tiles spanning far beyond any range these tests use -> every day classifies as covered.
const allTiles = () =>
  new Set(getTileIndicesForViewport(utcDay(2025, 12, 1), utcDay(2026, 3, 1), FINEST_LEVEL));
// in both helpers' deps:
listEnvelopeTiles: jest.fn(async () => allTiles()),
```

(`FINEST_LEVEL` from envelope-config, `getTileIndicesForViewport` from tile-addressing,
`dayRange` from seismic-day join the test file's imports.)

**9a. Coverage state.**

Step 1 — failing tests (new `describe("envelope coverage")`, using the existing `fakeCache`
fixture whose station is AK K204 HNZ):

```ts
describe("envelope coverage", () => {
  const d30 = dayIndex(utcDay(2026, 1, 30));
  const dayTiles = (day: number) => {
    const { start, end } = dayRange(day);
    return getTileIndicesForViewport(start, end, FINEST_LEVEL);
  };

  it("loads tile listings per station without auth", async () => {
    const listEnvelopeTiles = jest.fn(async () => new Set(dayTiles(d30)));
    const store = new SeismicAdminStore({ cache: fakeCache() as any, listEnvelopeTiles });
    store.setRange("2026-01-30", "2026-02-01");   // 3 days
    await store.refresh();                        // note: no setAuthReady()
    const key = [...store.stations.keys()][0];
    expect(listEnvelopeTiles).toHaveBeenCalledTimes(1);
    expect(store.envelopeCoverageFor(key).state).toBe("loaded");
  });

  it("records an error state when the listing fails", async () => {
    const listEnvelopeTiles = jest.fn(async () => { throw new Error("nope"); });
    const store = new SeismicAdminStore({ cache: fakeCache() as any, listEnvelopeTiles });
    store.setRange("2026-01-30", "2026-02-01");
    await store.refresh();
    const key = [...store.stations.keys()][0];
    expect(store.envelopeCoverageFor(key).state).toBe("error");
  });
});
```

Step 2 — run `npm test -- --no-watchman src/seismic-admin/seismic-admin-store.test.ts`: FAIL.

Step 3 — implement. Add to `SeismicAdminDeps`:
`listEnvelopeTiles?: (s: StationData) => Promise<Set<number>>`. Then:

```ts
/** One station's envelope coverage: the L2 tile indices listed from S3. */
export interface EnvelopeCoverageStats {
  state: CoverageLoadState;
  tileIndices?: Set<number>;
}

// state:
envelopeCoverage = new Map<string, EnvelopeCoverageStats>();   // keyed by stationKey

/** Not gated on authReady — the S3 listing is anonymous. The listing is also
 *  range-independent: day states are derived against the current range on read. */
async loadEnvelopeCoverage(station: StationConfig) {
  const key = getStationChannelPrefix(station);
  runInAction(() => this.envelopeCoverage.set(key, { state: "pending" }));
  try {
    const list = this.deps.listEnvelopeTiles ?? listEnvelopeTileIndices;
    const tileIndices = await list(station);
    runInAction(() => this.envelopeCoverage.set(key, { state: "loaded", tileIndices }));
  } catch (err) {
    console.warn("Failed to list envelope tiles:", err);
    runInAction(() => this.envelopeCoverage.set(key, { state: "error" }));
  }
}

envelopeCoverageFor(stationKey: string): EnvelopeCoverageStats {
  return this.envelopeCoverage.get(stationKey) ?? { state: "pending" };
}
```

And in `loadAllCoverageStats`, load envelopes per station before its models (sequential, same
stampede rationale):

```ts
async loadAllCoverageStats() {
  for (const station of this.selectedStationList) {
    await this.loadEnvelopeCoverage(station);
    for (const url of this.selectedModels) {
      await this.loadCoverageStats(station, url);
    }
  }
}
```

Step 4 — tests pass. Step 5 — commit: `"Add envelope coverage state to seismic admin store"`

**9b. Day states + stats.**

Step 1 — failing tests (same describe):

```ts
it("classifies days and aggregates stats from the listed tiles", async () => {
  // d30 fully covered, d31 partially (one tile), Feb 1 not at all.
  const d31 = d30 + 1;
  const listEnvelopeTiles = jest.fn(async () => new Set([...dayTiles(d30), dayTiles(d31)[0]]));
  const store = new SeismicAdminStore({ cache: fakeCache() as any, listEnvelopeTiles });
  store.setRange("2026-01-30", "2026-02-01");
  await store.refresh();
  const key = [...store.stations.keys()][0];

  expect(store.envelopeDayStates(key)?.get(d30)).toBe("covered");
  expect(store.envelopeDayStates(key)?.get(d31)).toBe("partial");
  expect(store.envelopeDayStates(key)?.get(d31 + 1)).toBe("uncovered");

  const stats = store.envelopeStats(key);
  expect(stats.coveredDayCount).toBe(1);
  expect(stats.partialDayCount).toBe(1);
  expect(stats.totalDays).toBe(3);
  expect(stats.coveredDays.get(key)?.has(d30)).toBe(true);
  expect(stats.partialDays.get(key)?.has(d31)).toBe(true);
});

it("aggregates envelope stats across all selected stations when stationKey is absent", async () => {
  // Two catalog stations, same lister -> totals double; per-station sets keyed by each key.
});
```

Step 3 — implement. Extract the day-accumulation loop that `modelStats` already does into a
private helper both methods share (DRY — the only difference is where day states come from
and `eventCount`):

```ts
/** Accumulate covered/partial day sets and counts across stations.
 *  Shared by modelStats and envelopeStats. */
private collectDayStats(
  stationKeys: Set<string>,
  getDayStates: (stationKey: string) => Map<number, DayCoverageState> | undefined
): ModelStats {
  const coveredDays = new Map<string, Set<number>>();
  const partialDays = new Map<string, Set<number>>();
  let coveredDayCount = 0;
  let partialDayCount = 0;
  let totalDays = 0;
  const { rangeDays } = this;

  stationKeys.forEach(sk => {
    totalDays += rangeDays;
    const dayStates = getDayStates(sk);
    if (!dayStates) return;

    const stationCoveredDays = new Set<number>();
    coveredDays.set(sk, stationCoveredDays);
    const stationPartialDays = new Set<number>();
    partialDays.set(sk, stationPartialDays);
    dayStates.forEach((state, day) => {
      if (state === "covered") {
        stationCoveredDays.add(day);
        coveredDayCount++;
      } else if (state === "partial") {
        stationPartialDays.add(day);
        partialDayCount++;
      }
    });
  });

  return { coveredDays, partialDays, coveredDayCount, partialDayCount, totalDays };
}

/** Derived per-day envelope coverage for a station; undefined until its listing loads. */
envelopeDayStates(stationKey: string): Map<number, DayCoverageState> | undefined {
  const stats = this.envelopeCoverage.get(stationKey);
  const range = this.rangeSec;
  if (stats?.state !== "loaded" || !stats.tileIndices || !range) return;
  return classifyEnvelopeDayCoverage(stats.tileIndices, range);
}

/** Envelope coverage stats for one station, or all selected stations when stationKey is absent. */
envelopeStats(stationKey?: string): ModelStats {
  const stations = stationKey ? new Set([stationKey]) : this.selectedStations;
  return this.collectDayStats(stations, sk => this.envelopeDayStates(sk));
}
```

Rewrite `modelStats` on the helper (behavior unchanged — its existing tests are the guard):

```ts
modelStats(modelUrl: string, stationKey?: string): ModelStats {
  const stations = stationKey ? new Set([stationKey]) : this.selectedStations;
  let eventCount = 0;
  stations.forEach(sk => {
    const stats = this.modelCoverage.get(coverageKey(sk, modelUrl));
    if (stats?.state === "loaded") eventCount += stats.eventCount ?? 0;
  });
  const dayStats = this.collectDayStats(stations,
    sk => this.modelCoverage.get(coverageKey(sk, modelUrl))?.dayStates);
  return { eventCount, ...dayStats };
}
```

Step 4 — the whole suite passes (including untouched `modelStats` tests).
Step 5 — commit: `"Derive envelope day states and stats in admin store"`

**9c. Live fill.**

Step 1 — failing test:

```ts
it("marks uploaded tiles so days fill in live", async () => {
  const listEnvelopeTiles = jest.fn(async () => new Set<number>());
  const store = new SeismicAdminStore({ cache: fakeCache() as any, listEnvelopeTiles });
  store.setRange("2026-01-30", "2026-02-01");
  await store.refresh();
  const key = [...store.stations.keys()][0];
  expect(store.envelopeDayStates(key)?.get(d30)).toBe("uncovered");

  dayTiles(d30).forEach(i => store.markTileUploaded(key, i));
  expect(store.envelopeDayStates(key)?.get(d30)).toBe("covered");

  // Unknown station: ignored, no entry synthesized.
  store.markTileUploaded("nope", 1);
  expect(store.envelopeCoverage.has("nope")).toBe(false);
});
```

Step 3 — implement:

```ts
/** Fold a freshly-uploaded L2 tile into a station's envelope coverage so its timeline
 *  fills in live. Ignored unless that station's coverage is already loaded — the
 *  post-upload reload reconciles (same contract as markDayCovered). */
markTileUploaded(stationKey: string, tileIndex: number) {
  const stats = this.envelopeCoverage.get(stationKey);
  if (stats?.state !== "loaded" || !stats.tileIndices) return;
  stats.tileIndices.add(tileIndex);
}
```

(The observable map deep-observes its values, so mutating the Set notifies observers — the
same mechanism `markDayCovered` relies on for `dayStates`.)

Step 4 — tests pass. Step 5 — commit: `"Fill envelope timeline live as tiles upload"`

**9d. Ready gating.**

Step 1 — failing tests. First update `makeCoverageStore`/`makeUpdateStore` with the
`listEnvelopeTiles: allTiles` default (see the warning at the top of this task) and confirm
the suite is green again, then add:

```ts
it("is not fully covered while envelopes are missing, even when models are covered", async () => {
  const { store } = makeCoverageStore({ listEnvelopeTiles: jest.fn(async () => new Set()) });
  store.setAuthReady();
  store.setRange("2026-01-01", "2026-01-03");
  await store.refresh();
  expect(store.isFullyCovered(rc01Key)).toBe(false);   // model coverage IS complete here
});

it("is fully covered when both envelopes and all selected models are covered", async () => {
  const { store } = makeCoverageStore();               // allTiles default
  store.setAuthReady();
  store.setRange("2026-01-01", "2026-01-03");
  await store.refresh();
  expect(store.isFullyCovered(rc01Key)).toBe(true);
});
```

Step 3 — implement:

```ts
/** Pending or errored envelope listings are NOT fully covered — unknown ≠ covered. */
envelopesFullyCovered(stationKey?: string): boolean {
  const stationKeys = stationKey ? [stationKey] : [...this.selectedStations];
  if (stationKeys.length === 0) return false;
  return stationKeys.every(sk => {
    const dayStates = this.envelopeDayStates(sk);
    return !!dayStates && [...dayStates.values()].every(s => s === "covered");
  });
}
```

and prepend to `isFullyCovered`:

```ts
isFullyCovered(stationKey?: string): boolean {
  if (!this.envelopesFullyCovered(stationKey)) return false;
  ...existing model logic unchanged...
}
```

Step 4 — tests pass. Step 5 — commit: `"Include envelope coverage in station readiness"`

---

### Task 10: Store — portal auth & update flow integration

**Files:** Modify: `src/seismic-admin/seismic-admin-store.ts`, `src/seismic-admin/seismic-admin-store.test.ts`

New store imports:

```ts
import { FINEST_LEVEL } from "../../shared/seismic/envelope-config";
import { createEnvelopeCredentialsProvider, createEnvelopeUploader, EnvelopeUploader }
  from "../models/stores/seismic/envelope-uploader";
import { processEnvelopeCoverage } from "../models/stores/seismic/seismic-envelope-processor";
```

**⚠️ Existing-test impact:** `updateSingleStation` will bail out unless portal auth is set, so
`primed()` must call `store.setPortalAuth(...)` (with a fake uploader) after `setAuthReady()`,
and the call-order assertions gain the envelope step. Update `makeUpdateStore`:

```ts
// added to makeUpdateStore's deps:
envelopeUploader: { uploadTile: jest.fn(async () => {}) },
processEnvelopes: jest.fn(async (_options: any) => {
  calls.push("envelopes");
  return { uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 0 };
}),
// and in primed(), after ctx.store.setAuthReady():
ctx.store.setPortalAuth(async () => "fake-jwt");
```

The existing order assertion becomes:

```ts
expect(calls.filter((c: string) => !c.startsWith("coverage"))).toEqual([
  "download", "envelopes", "process:compact-v1", "process:large-v1",
]);
```

**10a. Portal auth state.**

Step 1 — failing tests:

```ts
describe("portal auth", () => {
  it("setPortalAuth flips portalReady", () => {
    const store = new SeismicAdminStore({ cache: fakeCache() as any });
    expect(store.portalReady).toBe(false);
    store.setPortalAuth(async () => "jwt");
    expect(store.portalReady).toBe(true);
  });

  it("updateStation reports failure when portal auth is missing", async () => {
    // Prime by hand, deliberately skipping setPortalAuth.
    const { store, calls } = makeUpdateStore();
    store.setRange("2026-01-01", "2026-01-03");
    await store.refresh();
    store.setAuthReady();
    calls.length = 0;
    await store.updateStation(rc01Key);
    expect(calls).not.toContain("envelopes");
    expect(store.feedback).toBe("Finished updating Rabbit Creek with failures.");
  });
});
```

Step 3 — implement. Add to `SeismicAdminDeps`:

```ts
processEnvelopes?: typeof processEnvelopeCoverage;
envelopeUploader?: EnvelopeUploader;
```

Add state and action (declare `envelopeUploader` as a private field and exclude it from
observability alongside `deps`/`cache`):

```ts
portalReady = false;
private envelopeUploader?: EnvelopeUploader;

// constructor: makeAutoObservable<SeismicAdminStore, "deps" | "cache" | "envelopeUploader">(
//   this, { deps: false, cache: false, envelopeUploader: false }, { autoBind: true });

/** Wire up the S3 upload path once a portal JWT source exists. env selects the
 *  token-service environment ("production" default; "staging" for testing). */
setPortalAuth(getJwt: () => Promise<string>, env?: "staging" | "production") {
  this.envelopeUploader = this.deps.envelopeUploader ??
    createEnvelopeUploader({ getCredentials: createEnvelopeCredentialsProvider({ getJwt, env }) });
  this.portalReady = true;
}
```

Step 4 — tests pass. Step 5 — commit: `"Add portal auth state to seismic admin store"`

**10b. Update order + envelope step.**

Step 1 — failing tests (on top of the fixture changes above):

```ts
it("updateStation runs envelopes after download and before events", async () => {
  const { store, calls } = await primed();
  await store.updateStation(rc01Key);
  expect(calls.filter((c: string) => !c.startsWith("coverage"))).toEqual([
    "download", "envelopes", "process:compact-v1", "process:large-v1",
  ]);
});

it("passes the range and a station-bound uploadTile to processEnvelopes", async () => {
  const { store, processEnvelopes, envelopeUploader } = await primed();
  await store.updateStation(rc01Key);
  const options = processEnvelopes.mock.calls[0][0];
  expect(options.stationData).toMatchObject({ station: "RC01" });
  expect(options.range).toEqual({
    start: utcDay(2026, 1, 1), end: utcDay(2026, 1, 3) + SECONDS_PER_DAY,
  });
  const tile = { mins: Int16Array.from([1]), maxs: Int16Array.from([2]) };
  await options.uploadTile(2, 77, tile);
  expect(envelopeUploader.uploadTile).toHaveBeenCalledWith(
    expect.objectContaining({ station: "RC01" }), 2, 77, tile);
});

it("live-fills only finest-level tiles via onTileUploaded", async () => {
  const processEnvelopes = jest.fn(async ({ onTileUploaded }: any) => {
    onTileUploaded?.(0, 1);               // coarse level: ignored
    onTileUploaded?.(FINEST_LEVEL, 56123);
    return { uploadedTiles: 2, processedDays: 1, skippedDays: 0, totalDays: 1 };
  });
  const marked: Array<[string, number]> = [];
  const { store } = await primed({ processEnvelopes });
  store.markTileUploaded = (key: string, i: number) => { marked.push([key, i]); };
  await store.updateStation(rc01Key);
  expect(marked).toEqual([[rc01Key, 56123]]);
});

it("continues into events and reports failures when processEnvelopes rejects", async () => {
  const processEnvelopes = jest.fn(async () => { throw new Error("upload died"); });
  const { store, calls } = await primed({ processEnvelopes });
  await store.updateStation(rc01Key);
  expect(calls).toContain("process:compact-v1");   // events still ran
  expect(store.feedback).toBe("Finished updating Rabbit Creek with failures.");
});

it("reconciles envelope coverage from the listing after the envelope step", async () => {
  const { store, listEnvelopeTiles } = await primed();
  listEnvelopeTiles.mockClear();
  await store.updateStation(rc01Key);
  expect(listEnvelopeTiles).toHaveBeenCalled();
});

it("reports envelope day progress in feedback", async () => {
  const seen: string[] = [];
  const processEnvelopes = jest.fn(async ({ onProgress }: any) => {
    onProgress?.(1, 3);
    seen.push(store.feedback);
    return { uploadedTiles: 0, processedDays: 1, skippedDays: 0, totalDays: 3 };
  });
  const ctx = await primed({ processEnvelopes });
  const store = ctx.store;
  await store.updateStation(rc01Key);
  expect(seen).toEqual(["Rabbit Creek — envelopes: day 1 of 3"]);
});
```

Step 3 — implement. Revised `updateSingleStation` (envelope step ② inserted; `let ok = true;`
moves above it; doc comment updated):

```ts
/** Download the whole range, then generate + upload missing envelopes, then generate
 *  events for each selected model's uncovered days. Returns false if anything failed. */
private async updateSingleStation(key: string, prefix = ""): Promise<boolean> {
  const stationData = this.stations.get(key);
  const range = this.rangeSec;
  if (!stationData || !range || !this.authReady) return false;
  const uploader = this.envelopeUploader;
  if (!this.portalReady || !uploader) return false;

  // 1) Raw data for the whole range (existing flow, reports its own feedback).
  await this.download(stationData, prefix);

  let ok = true;

  // 2) Envelopes for days not fully covered in S3 — before events: they are the
  // cheap byproduct of the raw data the events step also needs.
  try {
    const run = this.deps.processEnvelopes ?? processEnvelopeCoverage;
    await run({
      stationData, range,
      uploadTile: (level, tileIndex, tile) => uploader.uploadTile(stationData, level, tileIndex, tile),
      onProgress: (done, total) => this.setFeedback(
        `${prefix}${getStationLabel(stationData)} — envelopes: day ${done} of ${total}`),
      onTileUploaded: (level, tileIndex) => {
        if (level === FINEST_LEVEL) this.markTileUploaded(key, tileIndex);
      },
    });
  } catch (err) {
    console.warn("Envelope update failed:", err);
    this.setFeedback(`${prefix}Envelope update failed for ${getStationLabel(stationData)}.`);
    ok = false;
  }
  // Reconcile with the actual listing; the incremental updates above are an estimate.
  await this.loadEnvelopeCoverage(stationData);

  // 3) Events for uncovered days, model by model. Snapshot the live selection:
  // ...existing model loop unchanged (drop its own `let ok = true;`)...
  return ok;
}
```

Step 4 — full suite passes. Step 5 — commit: `"Generate and upload envelopes in admin update flow"`

---

### Task 11: UI — Envelopes section & portal login

**Files:**
- Modify: `src/seismic-admin/components/station-section.tsx` + test
- Modify: `src/seismic-admin/components/admin-header.tsx` + test
- Modify: `src/seismic-admin/components/app.tsx`

**11a. `EnvelopesSection`** in `station-section.tsx`, modeled directly on `CoverageSection`
(reuse `.data-section coverage` markup — no new SCSS; if styling gaps appear, ask the user):
header "Envelopes" + `"${coveredDayCount} / ${totalDays} days"`, per-station three-state
`RawTimeline` fed from `store.envelopeStats(stationKey)` day sets, `"Loading..."` /
`"Unable to list envelopes"` states, aggregate-count-only for the all-stations section.
Render it between the Local Raw Data section and the model sections. Also extend
`updateDisabled` with `!store.portalReady`. Tests: rendered between raw and model sections;
counts correct; update disabled without portal login.

**11b. Login button** in `admin-header.tsx` options row: when `!store.portalReady`, a
"Log in with Portal" button whose onClick sets `window.location.href = buildAuthorizeUrl()`;
when ready, a "Portal: signed in" indicator (plain text, existing classes). Test: button
rendered only when not ready.

**11c. Wire up in `app.tsx`**: after store creation:

```ts
const accessToken = consumeAccessTokenFromLocation();
if (accessToken) {
  created.setPortalAuth(() => fetchPortalFirebaseJwt(accessToken));
}
```

(JWTs are fetched per credentials refresh; the ~1 h access token living in sessionStorage is
enough for an admin session. A failed JWT fetch surfaces through the update-flow error path.)

**Step 5:** Commit: `"Add envelope coverage UI and portal login to seismic admin"`

---

### Task 12: Full verification

1. `npm test -- --no-watchman` (full suite), `npm run lint:build`, `npm run check:types` — all clean.
2. Manual end-to-end (requires the ops prerequisites; use the staging portal via `?portal=`):
   `npm start` → `http://localhost:8080/seismic-admin/?seismicProxy` → log in with portal →
   pick one station and a **2-3 day range** → Update station → watch feedback progress through
   raw → envelopes → events; envelope timeline fills live; reload page → coverage persists
   (now read from S3); spot-check `curl "https://models-resources.s3.amazonaws.com/?list-type=2&prefix=collaborative-learning/envelopes/v2/"`;
   verify the Timeline tile in CLUE proper renders the new envelopes at L2 zoom.
3. Commit any fixes; then use superpowers:finishing-a-development-branch.

**Known limitation (accepted in design):** days whose raw data doesn't exist at EarthScope can
never get envelope tiles, so their stations report "Not Ready!" — truthful, matches the raw
timeline showing those days as missing.
