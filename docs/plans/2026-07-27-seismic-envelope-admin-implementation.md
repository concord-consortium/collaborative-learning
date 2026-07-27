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
import { FINEST_LEVEL, S3_BUCKET, S3_PREFIX } from "./envelope-config";
import { dayIndex, dayRange } from "./seismic-day";
import { DayCoverageState, DaySpan, StationData, TimeRange } from "./seismic-types";
import { getS3Root, getStationChannelPrefix, getTileIndicesForViewport } from "./tile-addressing";

const LIST_BASE_URL = `https://${S3_BUCKET}.s3.amazonaws.com/`;

type ListFetchFn = (url: string) => Promise<Pick<Response, "ok" | "status" | "text">>;

/** All existing L2 tile indices for a station, via anonymous paginated S3 listing. */
export async function listEnvelopeTileIndices(
  stationData: StationData, fetchFn: ListFetchFn = fetch
): Promise<Set<number>> {
  const prefix = `${getS3Root(S3_PREFIX)}${getStationChannelPrefix(stationData)}/L${FINEST_LEVEL}/`;
  const indices = new Set<number>();
  let continuationToken: string | undefined;
  do {
    let url = `${LIST_BASE_URL}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
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

### Task 3: Tile merge (`shared/seismic/envelope-merge.ts`)

**Files:** Create: `shared/seismic/envelope-merge.ts`, `shared/seismic/envelope-merge.test.ts`

**Step 1: Failing tests.** Cases: both sentinel → sentinel; one side data → that side (both channels move together — a point is "present" only when *both* min and max are non-sentinel); both data → min-of-mins/max-of-maxes; length mismatch throws.

```ts
import { NO_DATA_SENTINEL } from "./envelope-config";
import { mergeEnvelopeTileData } from "./envelope-merge";

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

**Step 2:** Run — FAIL. **Step 3: Implement:**

```ts
import { NO_DATA_SENTINEL } from "./envelope-config";
import { EnvelopeTileData } from "./seismic-types";

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

### Task 4: Extract `findSensitivity` to shared

The browser processor needs the sensitivity lookup currently private to
`scripts/seismic/generate-envelopes.ts` (lines ~176-200).

**Files:**
- Create: `shared/seismic/channel-sensitivity.ts`, `shared/seismic/channel-sensitivity.test.ts`
- Modify: `scripts/seismic/generate-envelopes.ts` (delete local `findSensitivity`, import instead)

**Steps:** Move the function verbatim (signature
`findSensitivity(metadata: ChannelMetadata[], channel: string, location: string, timeSec: number): { scale: number; instrumentCode: string }`),
including the throw-on-no-channel-match and warn-and-use-latest fallback. Write tests first
(match by time epoch; blank location matching `undefined`; fallback to latest; throw when no
channel matches). Then update the script's import (note the script uses `.js` suffixes:
`from "../../shared/seismic/channel-sensitivity.js"`). Verify:
`npm test -- --no-watchman shared/seismic/channel-sensitivity.test.ts` and `npm run check:types`.
Commit: `"Extract findSensitivity into shared channel-sensitivity module"`

---

### Task 5: Envelope uploader (`src/models/stores/seismic/envelope-uploader.ts`)

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
import { decodeEnvelopeTile, encodeEnvelopeTile } from "../../../../shared/seismic/envelope-codec";
import { S3_BUCKET, S3_PREFIX } from "../../../../shared/seismic/envelope-config";
import { mergeEnvelopeTileData } from "../../../../shared/seismic/envelope-merge";
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

const TILE_BASE_URL = `https://${S3_BUCKET}.s3.amazonaws.com/`;
const AWS_REGION = "us-east-1";
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
```

**Step 4:** Tests pass. **Step 5:** Commit: `"Add merge-uploading envelope tile uploader"`

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

### Task 7: Credentials provider (`src/models/stores/seismic/envelope-credentials.ts`)

Lives beside the uploader (not in seismic-admin) because Wave Runner (part 2) will use it too.

**Files:** Create: `src/models/stores/seismic/envelope-credentials.ts` + test

**Step 1: Failing tests.** Inject a fake client factory; assert: resource id is
`v${ENVELOPE_LAYOUT_VERSION}`; credentials are cached across calls; a new client+fetch happens
once the cached credentials are within 5 minutes of expiry (use `jest.spyOn(Date, "now")`).

**Step 3: Implement:**

```ts
import { TokenServiceClient } from "@concord-consortium/token-service";
import { ENVELOPE_LAYOUT_VERSION } from "../../../../shared/seismic/envelope-config";
import { AwsCredentials } from "./envelope-uploader";

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

**Step 4:** Tests pass. **Step 5:** Commit: `"Add token-service envelope credentials provider"`

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
5. Unknown instrument code → the span fails (throw), propagated to the caller.

**Step 3: Implement:**

```ts
import { miniseed } from "seisplotjs";
import { findSensitivity } from "../../../../shared/seismic/channel-sensitivity";
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
  const location = stationData.location ?? "";

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
        const { scale, instrumentCode } =
          findSensitivity(metadata, stationData.channel, location, seg.startTime);
        const rangeMax = AMPLITUDE_RANGES[instrumentCode];
        if (!rangeMax) throw new Error(`Unknown instrument code "${instrumentCode}"`);
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

Follow the existing `modelCoverage` patterns. Sub-steps (test-first for each):

**9a. Coverage state.** Add to `SeismicAdminDeps`:
`listEnvelopeTiles?: (s: StationData) => Promise<Set<number>>`. Add state
`envelopeCoverage = new Map<string, EnvelopeCoverageStats>()` where

```ts
export interface EnvelopeCoverageStats {
  state: CoverageLoadState;
  tileIndices?: Set<number>;
}
```

Add `loadEnvelopeCoverage(station)` (pending → list → loaded / error, like
`loadCoverageStats` but **not** gated on `authReady`) and call it for each selected station
from `loadAllCoverageStats` (sequential, same stampede rationale). Tests: loads via injected
dep; error path sets `"error"`; runs without `authReady`.

**9b. Day states + stats.** Add views (deriving from `tileIndices` + `rangeSec` via
`classifyEnvelopeDayCoverage`):

```ts
envelopeDayStates(stationKey: string): Map<number, DayCoverageState> | undefined
envelopeStats(stationKey?: string): ModelStats   // eventCount stays 0; reuse the shape
```

`envelopeStats` mirrors `modelStats` (per-station covered/partial day sets + aggregate counts
across selected stations). Tests: known tile sets → expected day sets/counts.

**9c. Live fill.** `markTileUploaded(stationKey: string, tileIndex: number)` — adds to
`tileIndices` when that station's coverage is loaded (ignored otherwise, same contract as
`markDayCovered`). Because day states derive from `tileIndices`, the timeline updates
automatically. Test: uploading all of a day's tiles flips its state to covered.

**9d. Ready gating.** Add `envelopesFullyCovered(stationKey?)` (loaded && every day covered;
unknown ≠ covered) and AND it into `isFullyCovered`. Tests: envelopes missing → not ready even
when models covered; both covered → ready.

Commit after each sub-step (e.g. `"Add envelope coverage state to seismic admin store"`, ...).

---

### Task 10: Store — portal auth & update flow integration

**Files:** Modify: `src/seismic-admin/seismic-admin-store.ts` + test

**10a. Portal auth state.** Add observable `portalReady = false` and
`setPortalAuth(getJwt: () => Promise<string>)` which stores the getter (non-observable, like
`deps`), builds the credentials provider + uploader lazily
(`deps.envelopeUploader ?? createEnvelopeUploader({ getCredentials: createEnvelopeCredentialsProvider({ getJwt }) })`),
and sets `portalReady`. Add `processEnvelopes?: typeof processEnvelopeCoverage` and
`envelopeUploader?: EnvelopeUploader` to `SeismicAdminDeps`. Tests: `portalReady` flips.

**10b. Update order + envelope step.** In `updateSingleStation`, insert between download (①)
and the model loop (③):

```ts
// 2) Envelopes for days not fully covered in S3. Runs before events: envelopes are
// the cheap byproduct of the raw data the events step also needs.
if (!this.portalReady || !this.envelopeUploader) return false;
try {
  const run = this.deps.processEnvelopes ?? processEnvelopeCoverage;
  const uploader = this.envelopeUploader;
  await run({
    stationData, range,
    uploadTile: (level, tileIndex, tile) => uploader.uploadTile(stationData, level, tileIndex, tile),
    onProgress: (done, total) => this.setFeedback(
      `${prefix}${getStationLabel(stationData)} — envelopes: day ${done} of ${total}`),
    onTileUploaded: (level, tileIndex) => {
      if (level === 2) this.markTileUploaded(key, tileIndex);
    },
  });
} catch (err) {
  console.warn("Envelope update failed:", err);
  this.setFeedback(`${prefix}Envelope update failed for ${getStationLabel(stationData)}.`);
  ok = false;
}
await this.loadEnvelopeCoverage(stationData);   // reconcile with the actual listing
```

Tests (injected `processEnvelopes`): runs after download and before `processCoverage`;
`onTileUploaded` reaches `markTileUploaded`; a processor throw sets `ok = false` but events
still run; final reconcile listing happens.

**Step 5:** Commit: `"Generate and upload envelopes in admin update flow"`

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
