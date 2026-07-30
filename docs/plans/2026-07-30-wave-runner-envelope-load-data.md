# Wave Runner Envelope Load Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the Wave Runner tile's "Load Data" button to generate missing envelope tiles for the
tile's station/date range and upload them to S3, reusing Part 1's `processEnvelopeCoverage` service,
with credentials obtained by exchanging the session's portal JWT for a token-service firebase JWT.

**Architecture:** The button (React toolbar layer) gathers everything store-dependent — a
`getJwt` exchange callback built from `stores.portal`, the token-service env, and a cache-invalidation
callback for `stores.seismicQueryService` — and passes them to a new `loadEnvelopeData` MST action on
the Wave Runner content model. That action reuses Part 1's `processEnvelopeCoverage` +
`createEnvelopeUploader` + `createEnvelopeCredentialsProvider` unchanged. After uploads, the query
service's envelope cache is invalidated for the station and the `WaveformPanel` re-fetches, so the
waveform fills in. In dev/demo/qa modes there is no portal JWT, so the button is disabled.

**Key design decision (differs from the Part 2 sentence in
`2026-07-27-seismic-envelope-admin-design.md`):** the user's existing `rawFirebaseJWT` is minted with
`firebase_app=collaborative-learning` and is signed with a key token-service's `ADMIN_PUBLIC_KEY`
does not verify. Instead, at click time we call the same portal endpoint CLUE already uses at launch —
`GET {basePortalUrl}api/v1/jwt/firebase?firebase_app=token-service` — authorized with the stored
portal JWT (`Bearer/JWT` header form, already used by standalone auth). No new sign-in route or OAuth
flow. Task 8 corrects the design doc.

**Tech Stack:** MST, MobX, React 17, Jest, existing `@concord-consortium/token-service` + `aws4fetch`
deps from Part 1.

**Testing note:** Run jest with `--no-watchman` on this machine:
`npx jest --no-watchman <path>`.

---

### Task 1: `firebaseApp` parameter on the JWT exchange helpers

**Files:**
- Modify: `src/lib/auth.ts:104-147`
- Test: `src/lib/auth.test.ts`

**Step 1: Write the failing tests**

Add to `src/lib/auth.test.ts` (top level, alongside the existing describes; `getFirebaseJWTParams` is
already imported there):

```ts
describe("getFirebaseJWTParams", () => {
  it("defaults to the collaborative-learning firebase app", () => {
    expect(getFirebaseJWTParams()).toBe("?firebase_app=collaborative-learning");
  });

  it("supports requesting a JWT for another firebase app", () => {
    expect(getFirebaseJWTParams(undefined, "token-service")).toBe("?firebase_app=token-service");
    expect(getFirebaseJWTParams("class-hash", "token-service"))
      .toBe("?firebase_app=token-service&class_hash=class-hash");
  });
});
```

**Step 2: Run the tests to make sure they fail**

Run: `npx jest --no-watchman src/lib/auth.test.ts -t getFirebaseJWTParams`
Expected: FAIL — "Expected 1 arguments, but got 2" (TS) or the second-arg call ignoring `firebaseApp`.

**Step 3: Implement**

In `src/lib/auth.ts`, change the two signatures (bodies otherwise unchanged):

```ts
export const getFirebaseJWTParams = (classHash?: string, firebaseApp = FIREBASE_APP_NAME) => {
  const params: Record<string,string> = {
    firebase_app: firebaseApp
  };
  // ... rest unchanged
```

```ts
export const getFirebaseJWTWithBearerToken = (basePortalUrl: string, type: string,
                                              rawToken: string, classHash?: string, firebaseApp?: string) => {
  return new Promise<[string, PortalFirebaseJWT]>((resolve, reject) => {
    const url = `${basePortalUrl}${FIREBASE_JWT_URL_SUFFIX}${getFirebaseJWTParams(classHash, firebaseApp)}`;
    // ... rest unchanged
```

**Step 4: Run the tests to verify they pass**

Run: `npx jest --no-watchman src/lib/auth.test.ts`
Expected: PASS (all existing auth tests must stay green — the default keeps prior behavior).

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "Allow requesting portal firebase JWTs for other firebase apps"
```

---

### Task 2: Token-service JWT getter from the portal session

**Files:**
- Create: `src/lib/token-service-jwt.ts`
- Create: `src/lib/token-service-jwt.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/token-service-jwt.test.ts`:

```ts
import { getFirebaseJWTWithBearerToken } from "./auth";
import { makeTokenServiceJwtGetter, TOKEN_SERVICE_FIREBASE_APP } from "./token-service-jwt";
import { Portal } from "../models/stores/portal";

jest.mock("./auth", () => ({
  getFirebaseJWTWithBearerToken: jest.fn(),
}));
const mockExchange = getFirebaseJWTWithBearerToken as jest.Mock;

function specPortal(overrides?: Record<string, unknown>) {
  return {
    rawPortalJWT: "portal-jwt",
    basePortalUrl: "https://learn.example.com/",
    requestPortalJWT: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as Portal;
}

describe("makeTokenServiceJwtGetter", () => {
  beforeEach(() => mockExchange.mockReset());

  it("returns undefined when the session has no portal JWT", () => {
    expect(makeTokenServiceJwtGetter(specPortal({ rawPortalJWT: undefined }))).toBeUndefined();
    expect(makeTokenServiceJwtGetter(specPortal({ basePortalUrl: undefined }))).toBeUndefined();
  });

  it("exchanges the portal JWT for a token-service firebase JWT", async () => {
    mockExchange.mockResolvedValue(["ts-jwt", {}]);
    const getJwt = makeTokenServiceJwtGetter(specPortal())!;
    await expect(getJwt()).resolves.toBe("ts-jwt");
    expect(mockExchange).toHaveBeenCalledWith(
      "https://learn.example.com/", "Bearer/JWT", "portal-jwt", undefined, TOKEN_SERVICE_FIREBASE_APP);
  });

  it("refreshes the portal JWT and retries once when the exchange fails", async () => {
    const portal = specPortal();
    mockExchange
      .mockRejectedValueOnce(new Error("401"))
      .mockImplementationOnce(async (_base, _type, jwt) => [`ts-jwt-for-${jwt}`, {}]);
    (portal.requestPortalJWT as jest.Mock).mockImplementation(async () => {
      (portal as { rawPortalJWT: string }).rawPortalJWT = "fresh-portal-jwt";
      return {};
    });
    const getJwt = makeTokenServiceJwtGetter(portal)!;
    await expect(getJwt()).resolves.toBe("ts-jwt-for-fresh-portal-jwt");
    expect(portal.requestPortalJWT).toHaveBeenCalled();
  });

  it("rejects when the retry also fails", async () => {
    const portal = specPortal();
    mockExchange.mockRejectedValue(new Error("still 401"));
    const getJwt = makeTokenServiceJwtGetter(portal)!;
    await expect(getJwt()).rejects.toThrow("still 401");
    expect(portal.requestPortalJWT).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run the tests to make sure they fail**

Run: `npx jest --no-watchman src/lib/token-service-jwt.test.ts`
Expected: FAIL — cannot find module `./token-service-jwt`.

**Step 3: Implement**

Create `src/lib/token-service-jwt.ts`:

```ts
import { Portal } from "../models/stores/portal";
import { getFirebaseJWTWithBearerToken } from "./auth";

/** The portal firebase app whose JWTs token-service verifies (via its ADMIN_PUBLIC_KEY). */
export const TOKEN_SERVICE_FIREBASE_APP = "token-service";

/**
 * Returns a getJwt callback (for createEnvelopeCredentialsProvider) that exchanges the
 * session's portal JWT for a portal-signed firebase JWT for the token-service app, or
 * undefined when the session has no portal JWT (dev/demo/qa modes). The portal JWT
 * expires ~1h after launch, so a failed exchange refreshes it via the stored bearer
 * credentials and retries once.
 */
export function makeTokenServiceJwtGetter(portal: Portal): (() => Promise<string>) | undefined {
  const { basePortalUrl } = portal;
  if (!portal.rawPortalJWT || !basePortalUrl) return undefined;
  // Reads rawPortalJWT at call time so the retry below picks up the refreshed value.
  const exchange = async () => {
    const [rawJwt] = await getFirebaseJWTWithBearerToken(
      basePortalUrl, "Bearer/JWT", portal.rawPortalJWT, undefined, TOKEN_SERVICE_FIREBASE_APP);
    return rawJwt;
  };
  return async () => {
    try {
      return await exchange();
    } catch {
      await portal.requestPortalJWT();
      return exchange();
    }
  };
}
```

**Step 4: Run the tests to verify they pass**

Run: `npx jest --no-watchman src/lib/token-service-jwt.test.ts`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add src/lib/token-service-jwt.ts src/lib/token-service-jwt.test.ts
git commit -m "Add token-service JWT getter over the portal session"
```

---

### Task 3: Envelope cache invalidation in SeismicQueryService

**Files:**
- Modify: `src/models/stores/seismic/seismic-query-service.ts`
- Test: `src/models/stores/seismic/seismic-query-service.test.ts`

**Step 1: Write the failing test**

Append to `src/models/stores/seismic/seismic-query-service.test.ts` (the file already imports
`SeismicQueryService`, `envelopeCacheKey`, and defines `stationData` at module scope):

```ts
describe("SeismicQueryService invalidateEnvelopes", () => {
  it("removes the station's envelope entries and bumps the version", () => {
    const service = new SeismicQueryService();
    const otherStation = { network: "AK", station: "DDM", channel: "HNZ" };
    service.envelopeCache.set(envelopeCacheKey(stationData, 2, 5), "missing");
    service.envelopeCache.set(envelopeCacheKey(stationData, 0, 0), "loading");
    service.envelopeCache.set(envelopeCacheKey(otherStation, 2, 5), "missing");
    expect(service.envelopeCacheVersion).toBe(0);

    service.invalidateEnvelopes(stationData);

    expect(service.envelopeCache.has(envelopeCacheKey(stationData, 2, 5))).toBe(false);
    expect(service.envelopeCache.has(envelopeCacheKey(stationData, 0, 0))).toBe(false);
    expect(service.envelopeCache.has(envelopeCacheKey(otherStation, 2, 5))).toBe(true);
    expect(service.envelopeCacheVersion).toBe(1);
  });
});
```

**Step 2: Run the test to make sure it fails**

Run: `npx jest --no-watchman src/models/stores/seismic/seismic-query-service.test.ts -t invalidateEnvelopes`
Expected: FAIL — `invalidateEnvelopes` is not a function.

**Step 3: Implement**

In `src/models/stores/seismic/seismic-query-service.ts` (`getStationChannelPrefix` is already
imported), add a property next to the caches and a method after `loadViewport`:

```ts
  /** Bumped by invalidateEnvelopes so viewport loaders know to re-fetch. */
  envelopeCacheVersion = 0;
```

```ts
  /**
   * Drop every cached envelope tile for a station — including "missing" markers and
   * tiles whose S3 copies may have been merged with new data — so subsequent viewport
   * loads re-fetch them. Called after new envelope tiles are uploaded.
   */
  invalidateEnvelopes(stationData: StationData) {
    const prefix = `${getStationChannelPrefix(stationData)}/L`;
    for (const key of [...this.envelopeCache.keys()]) {
      if (key.startsWith(prefix)) this.envelopeCache.delete(key);
    }
    this.envelopeCacheVersion++;
  }
```

(`makeAutoObservable` in the constructor picks both up automatically — no annotation changes needed.)

**Step 4: Run the tests to verify they pass**

Run: `npx jest --no-watchman src/models/stores/seismic/seismic-query-service.test.ts`
Expected: PASS (all, including pre-existing tests).

**Step 5: Commit**

```bash
git add src/models/stores/seismic/seismic-query-service.ts \
        src/models/stores/seismic/seismic-query-service.test.ts
git commit -m "Add envelope cache invalidation to the seismic query service"
```

---

### Task 4: WaveformPanel re-fetches after invalidation

**Files:**
- Modify: `src/plugins/shared-seismogram/components/waveform-panel.tsx:45-58`
- Test: `src/plugins/shared-seismogram/components/waveform-panel.test.tsx`

**Step 1: Make the test's mock service observable**

In `src/plugins/shared-seismogram/components/waveform-panel.test.tsx`, add `observable` and
`runInAction` to imports and replace the `jest.mock("../../../hooks/use-stores", ...)` block (keep
`mockQuery`/`mockLoadViewport` as they are):

```ts
import { observable, runInAction } from "mobx";
import { act } from "@testing-library/react";
```

```ts
// Observable so envelopeCacheVersion bumps re-render the observer component
const mockService = observable({
  envelopeCacheVersion: 0,
  query: mockQuery,
  loadViewport: mockLoadViewport,
});

jest.mock("../../../hooks/use-stores", () => ({
  useStores: () => ({ seismicQueryService: mockService }),
}));
```

**Step 2: Write the failing test**

Append inside the `describe("WaveformPanel", ...)` block:

```tsx
  it("re-runs loadViewport when the envelope cache version is bumped", () => {
    jest.useFakeTimers();
    const OriginalResizeObserver = global.ResizeObserver;
    // A ResizeObserver that reports a width immediately so pixelWidth > 0
    global.ResizeObserver = class {
      constructor(private cb: ResizeObserverCallback) {}
      observe() { this.cb([{ contentRect: { width: 500 } }] as any, this as any); }
      unobserve() { /* noop */ }
      disconnect() { /* noop */ }
    } as any;
    try {
      render(
        <WaveformPanel sharedSeismogram={sharedSeismogram} startTime={START} endTime={END} />
      );
      act(() => { jest.advanceTimersByTime(200); });  // past the 150ms debounce
      expect(mockLoadViewport).toHaveBeenCalledTimes(1);

      act(() => { runInAction(() => { mockService.envelopeCacheVersion++; }); });
      act(() => { jest.advanceTimersByTime(200); });
      expect(mockLoadViewport).toHaveBeenCalledTimes(2);
    } finally {
      global.ResizeObserver = OriginalResizeObserver;
      jest.useRealTimers();
    }
  });
```

**Step 3: Run the test to make sure it fails**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/components/waveform-panel.test.tsx`
Expected: the new test FAILS on the second assertion (`loadViewport` still called once); all
pre-existing tests PASS (they ignore the extra mock property).

**Step 4: Implement**

In `waveform-panel.tsx`, read the version in render and add it to the debounce effect deps:

```tsx
  // Re-run loadViewport when cached envelope data is invalidated (e.g. after tile uploads).
  const cacheVersion = seismicQueryService.envelopeCacheVersion;

  // Debounce loadViewport
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!stationInfo || pixelWidth === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      seismicQueryService.loadViewport(callerIdRef.current, {
        stationData: stationInfo, startTime, endTime, pixelWidth
      });
    }, LOAD_VIEWPORT_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stationInfo, startTime, endTime, pixelWidth, seismicQueryService, cacheVersion]);
```

**Step 5: Run the tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/shared-seismogram/components/waveform-panel.test.tsx`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/plugins/shared-seismogram/components/waveform-panel.tsx \
        src/plugins/shared-seismogram/components/waveform-panel.test.tsx
git commit -m "Re-fetch waveform data when the envelope cache is invalidated"
```

---

### Task 5: `loadEnvelopeData` action on the Wave Runner content model

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts`
- Test: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

**Step 1: Write the failing tests**

Append to `src/plugins/wave-runner/models/wave-runner-content.test.ts` (import
`WaveRunnerContentModel` from `./wave-runner-content` if the file currently only imports
`defaultWaveRunnerContent`):

```ts
describe("loadEnvelopeData", () => {
  const station = { network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport" };
  const fakeUploader = { uploadTile: jest.fn().mockResolvedValue(undefined) };
  const getJwt = jest.fn().mockResolvedValue("jwt");

  function createContent() {
    return WaveRunnerContentModel.create({ station, startDate: "2025-01-01", endDate: "2025-01-02" });
  }

  beforeEach(() => {
    fakeUploader.uploadTile.mockClear();
    getJwt.mockClear();
  });

  it("runs the envelope service over the day-aligned inclusive range", async () => {
    const content = createContent();
    const processEnvelopes = jest.fn().mockImplementation(async (opts: any) => {
      opts.onProgress?.(1, 2);
      return { uploadedTiles: 3, processedDays: 2, skippedDays: 0, totalDays: 2 };
    });
    const onEnvelopesUpdated = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes, onEnvelopesUpdated });

    expect(processEnvelopes).toHaveBeenCalledTimes(1);
    const opts = processEnvelopes.mock.calls[0][0];
    // 2025-01-01 through the end of 2025-01-02 (endDate is inclusive)
    expect(opts.range).toEqual({ start: Date.UTC(2025, 0, 1) / 1000, end: Date.UTC(2025, 0, 3) / 1000 });
    expect(content.loadDaysDone).toBe(1);
    expect(content.loadDaysTotal).toBe(2);
    expect(content.isLoadingData).toBe(false);
    expect(content.loadDataError).toBeNull();
    expect(onEnvelopesUpdated).toHaveBeenCalled();
  });

  it("routes tile uploads through the uploader with the station", async () => {
    const content = createContent();
    const tile = { mins: new Int16Array(0), maxs: new Int16Array(0) };
    const processEnvelopes = jest.fn().mockImplementation(async (opts: any) => {
      await opts.uploadTile(2, 7, tile);
      return { uploadedTiles: 1, processedDays: 1, skippedDays: 0, totalDays: 1 };
    });
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes });
    expect(fakeUploader.uploadTile).toHaveBeenCalledWith(content.station, 2, 7, tile);
  });

  it("skips the refresh callback when nothing was uploaded", async () => {
    const content = createContent();
    const processEnvelopes = jest.fn().mockResolvedValue(
      { uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 0 });
    const onEnvelopesUpdated = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes, onEnvelopesUpdated });
    expect(onEnvelopesUpdated).not.toHaveBeenCalled();
  });

  it("reports errors and still refreshes since tiles may have uploaded before the failure", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const content = createContent();
      const processEnvelopes = jest.fn().mockRejectedValue(new Error("upload failed"));
      const onEnvelopesUpdated = jest.fn();
      await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes, onEnvelopesUpdated });
      expect(content.loadDataError).toBe("Error loading data: upload failed");
      expect(content.isLoadingData).toBe(false);
      expect(onEnvelopesUpdated).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("rejects an end date before the start date", async () => {
    const content = WaveRunnerContentModel.create({ station, startDate: "2025-02-01", endDate: "2025-01-01" });
    const processEnvelopes = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes });
    expect(processEnvelopes).not.toHaveBeenCalled();
    expect(content.loadDataError).toMatch(/Invalid date range/);
  });

  it("does nothing without a station", async () => {
    const content = WaveRunnerContentModel.create({});
    const processEnvelopes = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes });
    expect(processEnvelopes).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run the tests to make sure they fail**

Run: `npx jest --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts -t loadEnvelopeData`
Expected: FAIL — `loadEnvelopeData` is not a function.

**Step 3: Implement**

In `src/plugins/wave-runner/models/wave-runner-content.ts`:

Add imports:

```ts
import { EnvironmentName } from "@concord-consortium/token-service";
import {
  createEnvelopeCredentialsProvider, createEnvelopeUploader, EnvelopeUploader
} from "../../../models/stores/seismic/envelope-uploader";
import { processEnvelopeCoverage } from "../../../models/stores/seismic/seismic-envelope-processor";
```

Extend the existing shared-seismic type import with `EnvelopeTileData`:

```ts
import { EnvelopeTileData, TimeRange } from "../../../../shared/seismic/seismic-types";
```

Add the options interface above the model definition:

```ts
export interface ILoadEnvelopeDataOptions {
  /** Exchanges the session's portal credentials for a token-service firebase JWT. */
  getJwt: () => Promise<string>;
  /** Token-service environment; "production" default. */
  env?: EnvironmentName;
  /** Called after a run that may have uploaded tiles so cached envelope data can be refreshed. */
  onEnvelopesUpdated?: () => void;
  /** Test seams; production defaults construct real ones. */
  processEnvelopes?: typeof processEnvelopeCoverage;
  uploader?: EnvelopeUploader;
}
```

Add to the `.volatile` block:

```ts
    isLoadingData: false,
    loadDaysDone: 0,
    loadDaysTotal: 0,
    loadDataError: null as string | null,
```

Add next to `updateChunkProgress` (same `.actions` block):

```ts
    updateLoadProgress(done: number, total: number) {
      self.loadDaysDone = done;
      self.loadDaysTotal = total;
    },
```

Add to the final `.actions` block (alongside `runModel`):

```ts
    /** Generate + upload any missing envelope tiles for the current station and date range. */
    loadEnvelopeData: flow(function* (options: ILoadEnvelopeDataOptions) {
      if (self.isRunning || self.isLoadingData) return;
      if (!self.station) return;
      const station = self.station;

      // Keep the shared seismogram in sync (the pre-upload behavior of Load Data).
      self.loadData();

      const startMs = new Date(`${self.startDate}T00:00:00Z`).getTime();
      const endMs = new Date(`${self.endDate}T00:00:00Z`).getTime();
      // endDate is inclusive, so equal dates are a valid single-day range.
      if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) {
        self.loadDataError = "Invalid date range. End date must not be before start date.";
        return;
      }
      const range: TimeRange = { start: startMs / 1000, end: endMs / 1000 + SECONDS_PER_DAY };

      self.loadDataError = null;
      self.isLoadingData = true;
      self.loadDaysDone = 0;
      self.loadDaysTotal = 0;

      const uploader = options.uploader ?? createEnvelopeUploader({
        getCredentials: createEnvelopeCredentialsProvider({ getJwt: options.getJwt, env: options.env }),
      });

      // Assume tiles may have landed unless the run reports otherwise: a thrown error can
      // still have uploaded tiles first, so refresh conservatively.
      let uploadedTiles = 1;
      try {
        const run = options.processEnvelopes ?? processEnvelopeCoverage;
        const result = yield run({
          stationData: station, range,
          uploadTile: (level: number, tileIndex: number, tile: EnvelopeTileData) =>
            uploader.uploadTile(station, level, tileIndex, tile),
          onProgress: (done: number, total: number) => self.updateLoadProgress(done, total),
        });
        uploadedTiles = result.uploadedTiles;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.loadDataError = `Error loading data: ${message}`;
        console.error("Wave Runner loadEnvelopeData error:", err);
      } finally {
        self.isLoadingData = false;
        if (uploadedTiles > 0) options.onEnvelopesUpdated?.();
      }
    }),
```

Note: no `proxy` option — Wave Runner talks to EarthScope directly, matching its existing
`processUncoveredRanges` call (the admin passes `proxy: true`; the tile does not).

**Step 4: Run the tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/wave-runner/models/wave-runner-content.test.ts`
Expected: PASS (all, including pre-existing tests).

**Step 5: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts \
        src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "Add envelope generation and upload to the Wave Runner content model"
```

---

### Task 6: Enable and wire the Load Data toolbar button

**Files:**
- Modify: `src/plugins/wave-runner/wave-runner-toolbar.tsx:22-39`
- Modify: `src/utilities/url-params.ts` (QueryParams interface)
- Modify: `src/plugins/wave-runner/components/data-setup.tsx:100,135,146`
- Test: `src/plugins/wave-runner/components/wave-runner-tile.test.tsx`

**Step 1: Write the failing tests**

Append to `src/plugins/wave-runner/components/wave-runner-tile.test.tsx` (inside the main describe;
the button renders with `aria-label={title}` and `aria-disabled` when disabled):

```tsx
  it("disables Load Data without portal credentials", () => {
    renderWithStores();
    const button = screen.getByRole("button", { name: "Load Data" });
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("enables Load Data when the session has portal credentials and a station", () => {
    stores.portal.rawPortalJWT = "portal-jwt";
    stores.portal.basePortalUrl = "https://learn.example.com/";
    try {
      renderWithStores();
      const button = screen.getByRole("button", { name: "Load Data" });
      expect(button).not.toHaveAttribute("aria-disabled");
    } finally {
      stores.portal.rawPortalJWT = undefined as any;
      stores.portal.basePortalUrl = undefined;
    }
  });
```

(The shared `content` already has a station via the auto-select-default-station effect.)

**Step 2: Run the tests to make sure they fail**

Run: `npx jest --no-watchman src/plugins/wave-runner/components/wave-runner-tile.test.tsx -t "Load Data"`
Expected: the "enables" test FAILS (button is hard-coded `disabled={true}`); the "disables" test
passes already.

**Step 3: Implement**

Add to the `QueryParams` interface in `src/utilities/url-params.ts` (after the `targetUserId` entry):

```ts
  //
  // seismic envelope upload parameters
  //

  // token-service environment for envelope uploads; "staging" for testing (production default)
  tokenServiceEnv?: string;
```

Replace `LoadDataButton` in `src/plugins/wave-runner/wave-runner-toolbar.tsx`:

```tsx
const LoadDataButton = observer(function LoadDataButton({ name }: IToolbarButtonComponentProps) {
  const content = useWaveRunnerContent();
  const { portal, seismicQueryService } = useStores();
  const getJwt = makeTokenServiceJwtGetter(portal);
  const disabled = !getJwt || !content.station || content.isRunning || content.isLoadingData;

  function handleClick() {
    const station = content.station;
    if (!getJwt || !station) return;
    content.loadEnvelopeData({
      getJwt,
      env: urlParams.tokenServiceEnv === "staging" ? "staging" : "production",
      onEnvelopesUpdated: () => seismicQueryService.invalidateEnvelopes(station),
    });
  }

  return (
    <TileToolbarButton name={name} title="Load Data" onClick={handleClick} disabled={disabled}>
      <LoadDataIcon/>
    </TileToolbarButton>
  );
});
```

with the new imports:

```tsx
import { useStores } from "../../hooks/use-stores";
import { makeTokenServiceJwtGetter } from "../../lib/token-service-jwt";
import { urlParams } from "../../utilities/url-params";
```

Also block conflicting interactions while a load runs:

- `PlayButton` disabled expression becomes:
  `const disabled = content.isRunning || content.isLoadingData || !content.selectedModelUrl || !!content.eventsDataSet;`
- In `data-setup.tsx`, the station select (line 100) and both date inputs (lines 135, 146) change
  `disabled={content.isRunning}` → `disabled={content.isRunning || content.isLoadingData}`.
  (The model select stays as-is — the model choice doesn't affect envelope loading.)

**Step 4: Run the tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/wave-runner/components/wave-runner-tile.test.tsx`
Expected: PASS (all).

**Step 5: Commit**

```bash
git add src/plugins/wave-runner/wave-runner-toolbar.tsx src/plugins/wave-runner/components/data-setup.tsx \
        src/utilities/url-params.ts src/plugins/wave-runner/components/wave-runner-tile.test.tsx
git commit -m "Enable the Wave Runner Load Data button for portal-authenticated sessions"
```

---

### Task 7: Load progress and error display

**Files:**
- Modify: `src/plugins/wave-runner/components/status-and-output.tsx:26-29`
- Test: `src/plugins/wave-runner/components/wave-runner-tile.test.tsx`

**Step 1: Write the failing tests**

Append to `wave-runner-tile.test.tsx`. These drive the volatile state through `loadEnvelopeData`
with a never-resolving/rejecting fake run (fresh model per test so the shared one is untouched):

```tsx
  function renderModel(model2: ReturnType<typeof TileModel.create>) {
    stores.ui.setSelectedTileId(model2.id);
    return render(
      <Provider stores={stores}>
        <TileModelContext.Provider value={model2}>
          <WaveRunnerComponent {...defaultProps} {...{model: model2}} />
        </TileModelContext.Provider>
      </Provider>
    );
  }

  it("shows envelope load progress while loading", async () => {
    const content2 = defaultWaveRunnerContent();
    const model2 = TileModel.create({ content: content2 });
    content2.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" });
    let resolveRun: (v: unknown) => void = () => undefined;
    const processEnvelopes = jest.fn((opts: any) => {
      opts.onProgress(2, 5);
      return new Promise(res => { resolveRun = res; });
    });
    const pending = content2.loadEnvelopeData({
      getJwt: async () => "jwt",
      uploader: { uploadTile: jest.fn() },
      processEnvelopes: processEnvelopes as any,
    });
    renderModel(model2);
    expect(screen.getByText("Loading data: day 3 of 5...")).toBeInTheDocument();
    resolveRun({ uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 5 });
    await pending;
  });

  it("shows envelope load errors", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const content2 = defaultWaveRunnerContent();
      const model2 = TileModel.create({ content: content2 });
      content2.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" });
      await content2.loadEnvelopeData({
        getJwt: async () => "jwt",
        uploader: { uploadTile: jest.fn() },
        processEnvelopes: jest.fn().mockRejectedValue(new Error("no credentials")) as any,
      });
      renderModel(model2);
      expect(screen.getByText("Error loading data: no credentials")).toBeInTheDocument();
    } finally {
      consoleSpy.mockRestore();
    }
  });
```

(Import `defaultWaveRunnerContent` is already present in this test file.)

**Step 2: Run the tests to make sure they fail**

Run: `npx jest --no-watchman src/plugins/wave-runner/components/wave-runner-tile.test.tsx -t envelope`
Expected: FAIL — progress/error text not rendered.

**Step 3: Implement**

In `src/plugins/wave-runner/components/status-and-output.tsx`, add `isLoadingData` and
`loadDataError` to the destructured model fields and extend the status container:

```tsx
  const {
    hasStationData, sharedSeismogram, startDateISO, endDateISO, isRunning, isLoadingData,
    eventsDataSet, runError, loadDataError
  } = model;
```

```tsx
      <div className="download-status-container">
        {isLoadingData && <div>Loading data: day {model.loadDaysDone + 1} of {model.loadDaysTotal || "?"}...</div>}
        {isRunning && <div>Running model...</div>}
        {loadDataError && <div className="waveform-error">{loadDataError}</div>}
        {runError && <div className="waveform-error">{runError}</div>}
      </div>
```

(The "day N + 1 of total" phrasing matches the existing `Processing day … of …` line for model runs.
No SCSS changes — existing classes are reused.)

**Step 4: Run the tests to verify they pass**

Run: `npx jest --no-watchman src/plugins/wave-runner/components/wave-runner-tile.test.tsx`
Expected: PASS (all).

**Step 5: Commit**

```bash
git add src/plugins/wave-runner/components/status-and-output.tsx \
        src/plugins/wave-runner/components/wave-runner-tile.test.tsx
git commit -m "Show envelope load progress and errors in the Wave Runner status section"
```

---

### Task 8: Correct the design doc and stale comment

**Files:**
- Modify: `docs/plans/2026-07-27-seismic-envelope-admin-design.md` (Part 2 section, and the Part 2
  sentence in the Goal section)
- Modify: `src/models/stores/seismic/envelope-uploader.ts:104`

**Step 1: Update the design doc**

Replace the "Part 2 (Wave Runner — designed for, not built here)" section body with:

```markdown
The Wave Runner tile's "Load Data" button calls the same `processEnvelopeCoverage` service
(built separately; see `2026-07-30-wave-runner-envelope-load-data.md`). Credentials come from
exchanging the session's portal JWT for a `firebase_app=token-service` firebase JWT at click
time — the user's existing `rawFirebaseJWT` is minted for the `collaborative-learning`
firebase app, whose signature token-service's `ADMIN_PUBLIC_KEY` does not verify. In
dev/demo/qa modes no portal JWT exists, so the button is disabled.
```

**Step 2: Fix the credentials comment**

In `envelope-uploader.ts`, the `getJwt` doc comment becomes:

```ts
  /** Returns a fresh portal-signed Firebase JWT (admin: via OAuth token; Wave Runner: portal-JWT exchange). */
```

**Step 3: Commit**

```bash
git add docs/plans/2026-07-27-seismic-envelope-admin-design.md \
        src/models/stores/seismic/envelope-uploader.ts
git commit -m "Document the Wave Runner token-service JWT exchange"
```

---

### Task 9: Full verification

**Step 1: Type check**

Run: `npm run check:types`
Expected: no errors.

**Step 2: Lint**

Run: `npm run lint:build`
Expected: no errors (this is the stricter pre-commit variant per CLAUDE.md).

**Step 3: Full test suite**

Run: `npx jest --no-watchman`
Expected: all suites pass.

**Step 4: Fix anything that surfaced, amend the relevant commits or add a cleanup commit**

```bash
git add -A && git commit -m "Lint and type fixes for Wave Runner envelope loading"
```

(Skip if nothing surfaced.)

---

## Manual QA (needs portal + token-service staging; can't be automated here)

1. Launch CLUE from the staging portal with `?tokenServiceEnv=staging` added, place a Wave Runner
   tile, pick a station and a short date range (2–3 days) not yet covered in S3.
2. Click **Load Data**: progress text should advance ("Loading data: day N of M..."), network tab
   should show signed `PUT`s to `models-resources`, and the waveform should fill in after the run
   (envelope cache invalidation → re-fetch).
3. Click **Load Data** again for the same range: it should finish almost immediately (all days
   covered, no uploads).
4. Open the same unit in dev mode (`?appMode=dev`): the Load Data button must be disabled.
5. Prerequisite reminder (ops, outside this repo): the token-service `v2` resource doc and IAM/CORS
   items from the Part 1 design's ops checklist must be in place for staging/production.
