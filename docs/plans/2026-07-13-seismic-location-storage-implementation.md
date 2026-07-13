# Location-Aware Seismic Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Incorporate the SEED location code into seismic storage keys (S3 envelope tiles, OPFS raw cache, in-memory caches) so two instruments at one station can't collide.

**Architecture:** Clean break to a v2 layout — location becomes a path segment in FDSN NSLC order (`{network}_{station}/{location}/{channel}/...`), blank encoded as `--` only inside two path helpers. `StationData` gains optional `location` (`undefined ≡ ""`) and replaces `StationLocation` everywhere. Old S3 (v1) and OPFS (`seismic-cache`) layouts are simply never read again; no migration code.

**Tech Stack:** TypeScript, Jest, MobX, OPFS, AWS SDK (S3), seisplotjs.

**Design doc:** `docs/plans/2026-07-13-seismic-location-storage-design.md`

**Machine note:** Always run Jest with `--no-watchman`, e.g. `npm test -- --no-watchman <path>`.

---

### Task 1: Collapse the type ladder (`StationData` gains optional `location`; delete `StationLocation`)

This is a pure type refactor — no behavior change, so no new failing test. The "test" is that `npm run check:types` and the existing suite pass.

**Files:**
- Modify: `shared/seismic/seismic-types.ts`
- Modify: `shared/seismic/seismic-downloader.ts`
- Modify: `src/models/stores/seismic-query-service.ts`
- Modify: `src/plugins/shared-seismogram/components/waveform-panel.tsx`
- Modify: `src/models/stores/seismic-query-service.test.ts`

**Step 1: Update the types**

In `shared/seismic/seismic-types.ts`, replace the `StationData` / `StationLocation` / `StationConfig` / `StationQuery` block (lines 9–29) with:

```ts
/** Basic station data: a station plus a specific channel and location.
 *  `location` is the SEED location code; `undefined` and `""` both mean the blank location. */
export interface StationData extends StationId {
  channel: string;
  location?: string;
}

/** A station entry in unit configuration: identity plus optional label. */
export interface StationConfig extends StationData {
  label?: string;
}

/** A station/channel/location plus an ISO time range (e.g. a metadata epoch). */
export interface StationQuery extends StationData {
  startTime: string;
  endTime: string;
}
```

(`StationLocation` is deleted. `ChannelMetadata extends StationQuery` is unchanged, but note its `location` is now optional — parsed metadata always supplies a string, so nothing breaks.)

In the same file, `SeismicViewportParams` (line 82): rename the field `stationLocation: StationLocation` → `stationData: StationData`.

**Step 2: Fix compile errors in the downloader**

In `shared/seismic/seismic-downloader.ts`:
- Line 1: import `StationData, StationQuery, TimeRange` (drop `StationLocation`).
- Line 14: `export interface DownloadParams extends StationData, EarthscopeOptions {`
- Line 59: `const stationData: StationData = { network, station, location, channel };` and rename the two later uses of `stationLocation` (lines 76, 91, 118, 120) to `stationData`.

**Step 3: Fix compile errors in the query service and panel**

- `src/models/stores/seismic-query-service.ts`: remove `StationLocation` from... (it isn't imported — it destructures `params.stationLocation`). Rename every `stationLocation` occurrence in the file to `stationData` (lines 72, 74, 158, 175, 190, 223, 230, 243, 255, 264, 316, 327, 335). No import changes needed.
- `src/plugins/shared-seismogram/components/waveform-panel.tsx` lines 52 and 63: `stationLocation: stationInfo` → `stationData: stationInfo`.
- `src/models/stores/seismic-query-service.test.ts`: line 21 delete `const stationLocation = { ...stationData, location: "" };` and change the `stationLocation,` keys in viewport params (lines 62, 156, 173) to `stationData,`.

**Step 4: Verify**

Run: `npm run check:types`
Expected: no errors.

Run: `npm test -- --no-watchman shared/seismic src/models/stores/seismic-query-service.test.ts`
Expected: all pass (behavior unchanged).

**Step 5: Commit**

```bash
git add shared/seismic src/models src/plugins
git commit -m "Collapse StationLocation into StationData with optional location."
```

---

### Task 2: Location-aware path encoding + layout version bump

**Files:**
- Modify: `shared/seismic/tile-addressing.ts`
- Modify: `shared/seismic/tile-addressing.test.ts`
- Modify: `shared/seismic/envelope-config.ts:14`
- Modify: `src/models/stores/seismic-query-service.ts` (doc comments only)

**Step 1: Write the failing tests**

In `shared/seismic/tile-addressing.test.ts`, add `encodeLocation, decodeLocation, getS3Root` to the import from `./tile-addressing`, update the existing `getTileS3Key` expectation, and add:

```ts
describe("encodeLocation / decodeLocation", () => {
  it("encodes blank locations as '--'", () => {
    expect(encodeLocation("")).toBe("--");
    expect(encodeLocation(undefined)).toBe("--");
    expect(encodeLocation("00")).toBe("00");
  });

  it("round-trips through decodeLocation", () => {
    expect(decodeLocation(encodeLocation(""))).toBe("");
    expect(decodeLocation(encodeLocation("00"))).toBe("00");
  });
});

describe("getS3Root", () => {
  it("appends the current layout version", () => {
    expect(getS3Root("base/")).toBe("base/v2/");
  });
});
```

Update the existing `getTileS3Key` test:

```ts
describe("getTileS3Key", () => {
  it("constructs the expected key format", () => {
    const key = getTileS3Key({ network: "AK", station: "K204", channel: "BHZ" }, 2, 42);
    expect(key).toBe("AK_K204/--/BHZ/L2/42");
  });

  it("includes a non-blank location code", () => {
    const key = getTileS3Key({ network: "IU", station: "ANMO", location: "00", channel: "BHZ" }, 2, 42);
    expect(key).toBe("IU_ANMO/00/BHZ/L2/42");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman shared/seismic/tile-addressing.test.ts`
Expected: FAIL — `encodeLocation` is not exported; key is `"AK_K204/BHZ/L2/42"`; root is `"base/v1/"`.

**Step 3: Implement**

In `shared/seismic/tile-addressing.ts`, add above `getStationChannelPrefix`:

```ts
/** Encode a SEED location code as a path segment. Blank (undefined or "") becomes "--". */
export function encodeLocation(location?: string): string {
  return location ? location : "--";
}

/** Inverse of encodeLocation: "--" becomes "". */
export function decodeLocation(segment: string): string {
  return segment === "--" ? "" : segment;
}
```

Replace `getStationChannelPrefix` (keep the `getTileS3Key` comment in sync — format is now `{network}_{station}/{location}/{channel}/L{level}/{tileIndex}`):

```ts
/**
 * Constructs the S3 key prefix for all tiles of a given station, location, and channel.
 * Format: {network}_{station}/{location}/{channel} (blank location encoded as "--")
 */
export function getStationChannelPrefix(stationData: StationData): string {
  const { channel, location } = stationData;
  return `${getStationPrefix(stationData)}/${encodeLocation(location)}/${channel}`;
}
```

In `shared/seismic/envelope-config.ts` line 14: `export const ENVELOPE_LAYOUT_VERSION = 2;`

In `src/models/stores/seismic-query-service.ts`, update the two cache-key doc comments (lines 32, 35) to the new shape, e.g. `"{network}_{station}/{location}/{channel}/L{level}/{tileIndex}"`.

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman shared/seismic src/models/stores/seismic-query-service.test.ts`
Expected: PASS (query-service tests build keys via `envelopeCacheKey`, so they follow automatically).

**Step 5: Commit**

```bash
git add shared/seismic src/models
git commit -m "Add location segment to tile keys and bump envelope layout to v2."
```

---

### Task 3: OPFS cache — v2 root with location segment

**Files:**
- Modify: `shared/seismic/opfs-seismic-cache.ts`
- Modify: `shared/seismic/opfs-seismic-cache.test.ts`

**Step 1: Write the failing tests**

In `shared/seismic/opfs-seismic-cache.test.ts`, update the `listStations` expectations (returned objects now include `location`), and add a multi-location test:

```ts
  it("lists the (network, station, location, channel) present in the cache", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const day = dayIndex(utcDay(2026, 1, 30));
    await cache.writeDayChunk(STA, day, bytes(1));                                     // AK/K204/--/HNZ
    await cache.writeDayChunk({ network: "AK", station: "RC01", channel: "BHZ" }, day, bytes(1));
    const stations = await cache.listStations();
    expect(stations).toContainEqual({ network: "AK", station: "K204", location: "", channel: "HNZ" });
    expect(stations).toContainEqual({ network: "AK", station: "RC01", location: "", channel: "BHZ" });
  });

  it("keeps locations at the same station and channel separate", async () => {
    const root = new FakeDirHandle();
    const cache = createOpfsCache(async () => root as any);
    const day = dayIndex(utcDay(2026, 1, 30));
    const loc00 = { ...STA, location: "00" };
    await cache.writeDayChunk(STA, day, bytes(1));
    await cache.writeDayChunk(loc00, day, bytes(2));

    const stations = await cache.listStations();
    expect(stations).toContainEqual({ ...STA, location: "" });
    expect(stations).toContainEqual(loc00);

    // Deleting one location's day must not touch the other's.
    await cache.deleteDaysInRange(loc00, day, day);
    expect(await cache.readDayChunk(STA, day)).not.toBeNull();
    expect(await cache.readDayChunk(loc00, day)).toBeNull();
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman shared/seismic/opfs-seismic-cache.test.ts`
Expected: FAIL — listed stations have no `location` key, and both locations map to the same file today (the delete test's `readDayChunk(STA, day)` comes back null).

**Step 3: Implement**

In `shared/seismic/opfs-seismic-cache.ts`:

- Import `decodeLocation, encodeLocation` from `./tile-addressing`.
- `const ROOT_DIR = "seismic-cache-v2";` — the old `seismic-cache` root is intentionally left in place and ignored (clean break, no cleanup code).
- Update the factory doc comment to `/seismic-cache-v2/{network}_{station}/{location}/{channel}/{year}/{doy}.mseed`.
- In `channelYearDir`, insert the location segment:

```ts
    for (const name of [
      ROOT_DIR, getStationPrefix(station), encodeLocation(station.location), station.channel, String(year)
    ]) {
```

- In `listStations`, walk the extra level:

```ts
      // Walk /seismic-cache-v2/{network}_{station}/{location}/{channel}/…
      for await (const [dirName, stationHandle] of seismicRoot.entries()) {
        if (!isDirectory(stationHandle)) continue;
        const parsed = parseStationPrefix(dirName);
        if (!parsed) continue;
        for await (const [locationSeg, locationHandle] of stationHandle.entries()) {
          if (!isDirectory(locationHandle)) continue;
          const location = decodeLocation(locationSeg);
          for await (const [channel, channelHandle] of locationHandle.entries()) {
            if (isDirectory(channelHandle)) out.push({ ...parsed, location, channel });
          }
        }
      }
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman shared/seismic/opfs-seismic-cache.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add shared/seismic
git commit -m "Store OPFS raw cache under a v2 root with a location segment."
```

---

### Task 4: Match station metadata by channel AND location

Different location codes are different instruments with different sensitivities — sensitivity lookup must respect location.

**Files:**
- Modify: `src/models/stores/seismic-query-service.ts:96-99, 381-392, 407`
- Test: `src/models/stores/seismic-query-service.test.ts`

**Step 1: Write the failing test**

In `src/models/stores/seismic-query-service.test.ts`, add a `describe` block. `getMetadata` fetches the FDSN station text (pipe-delimited, 17 fields: net|sta|loc|cha|...|scale(11)|scaleFreq(12)|units(13)|sampleRate(14)|start(15)|end(16)) through the mocked `global.fetch`, and caches per station — so one mock serves both assertions:

```ts
describe("getMetadata", () => {
  function metadataLine(location: string, scale: number) {
    const fields = new Array(17).fill("");
    fields[0] = "AK"; fields[1] = "K204"; fields[2] = location; fields[3] = "HNZ";
    fields[11] = String(scale); fields[12] = "1"; fields[13] = "M/S"; fields[14] = "100";
    fields[15] = "2020-01-01T00:00:00Z"; fields[16] = "";
    return fields.join("|");
  }

  it("matches metadata by channel and location", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => [metadataLine("", 100), metadataLine("00", 200)].join("\n"),
    });
    const service = new SeismicQueryService();
    const t = new Date("2021-01-01T00:00:00Z").getTime() / 1000;

    const meta00 = await service.getMetadata({ ...stationData, location: "00" }, t);
    expect(meta00?.scale).toBe(200);

    const metaBlank = await service.getMetadata(stationData, t);
    expect(metaBlank?.scale).toBe(100);
  });
});
```

(Place it after the existing top-level `describe` blocks; `mockFetch` and `stationData` are module-level in this file. Add `beforeEach(() => mockFetch.mockReset())` only if the existing tests don't already isolate mocks — check the file first.)

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/models/stores/seismic-query-service.test.ts`
Expected: FAIL — `meta00?.scale` is `100` (channel-only matching returns the first row).

**Step 3: Implement**

In `src/models/stores/seismic-query-service.ts`, change `getMetadataForChannel` to take the station identity and normalize blank on both sides:

```ts
  private getMetadataForChannel(
    metadata: ChannelMetadata[], station: { channel: string; location?: string }, timeSec: number
  ): ChannelMetadata | undefined {
    const location = station.location ?? "";
    const matching = metadata.filter(m => m.channel === station.channel && (m.location ?? "") === location);
    for (const m of matching) {
      const start = new Date(m.startTime).getTime() / 1000;
      const end = m.endTime === "" ? Infinity : new Date(m.endTime).getTime() / 1000;
      if (timeSec >= start && timeSec < end) return m;
    }
    // When no time matches, return the last metadata (or undefined if there aren't any)
    return matching[matching.length - 1];
  }
```

Update its two callers:
- `getMetadata` (line ~98): `return this.getMetadataForChannel(allMetadata, stationData, timeSec);`
- `fetchAndParseRaw` (line ~407): `this.getMetadataForChannel(metadata, query, segStartTime)?.scale ?? 1;`

**Step 4: Run test to verify it passes**

Run: `npm test -- --no-watchman src/models/stores/seismic-query-service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/models
git commit -m "Match station metadata by channel and location."
```

---

### Task 5: Propagate location through the download service

**Files:**
- Modify: `src/models/stores/seismic-download-service.ts:47`
- Modify: `shared/seismic/seismic-downloader.test.ts:4`

**Step 1: Store the full identity**

In `ensureRange` (line 47), include location so `readDay` reads the correct OPFS path:

```ts
    this.station = {
      network: params.network, station: params.station, location: params.location, channel: params.channel
    };
```

**Step 2: Fix the downloader test fixture**

In `shared/seismic/seismic-downloader.test.ts` line 4, the fixture uses `location: "--"` as a stored value — under the new scheme `"--"` is path encoding only, never an in-memory value. Change to `location: ""`.

**Step 3: Verify**

Run: `npm test -- --no-watchman shared/seismic/seismic-downloader.test.ts && npm run check:types`
Expected: PASS / no errors. (The admin store already passes `location: station.location ?? ""` into `ensureRange`; the worker forwards `DownloadParams` verbatim — no changes needed there.)

**Step 4: Commit**

```bash
git add src/models shared/seismic
git commit -m "Propagate location through the seismic download service."
```

---

### Task 6: Admin UI — location in labels and test fixtures

**Files:**
- Modify: `src/seismic-admin/utils/seismic-admin-utils.ts:43-55`
- Test: `src/seismic-admin/utils/seismic-admin-utils.test.ts`

**Step 1: Write the failing test**

In `src/seismic-admin/utils/seismic-admin-utils.test.ts`, add to the `stationLabel` tests (create the describe block if there isn't one):

```ts
  it("includes the location code in the fallback label when present", () => {
    expect(stationLabel({ network: "IU", station: "ANMO", location: "00", channel: "BHZ" }))
      .toBe("IU ANMO 00 BHZ");
    expect(stationLabel({ network: "AK", station: "K204", channel: "HNZ" })).toBe("AK K204 HNZ");
  });
```

Also update the `mergeStations` fixture at lines 22 and 28: `location: "--"` → `location: "00"` (same reason as Task 5 — `"--"` is not an in-memory value).

**Step 2: Run test to verify it fails**

Run: `npm test -- --no-watchman src/seismic-admin`
Expected: the new `stationLabel` assertion FAILS (`"IU ANMO BHZ"`); everything else passes.

**Step 3: Implement**

In `src/seismic-admin/utils/seismic-admin-utils.ts`:

```ts
/** A station's display name: its catalog label, else "{network} {station} {location} {channel}". */
export function stationLabel(station: StationConfig): string {
  return station.label ||
    [station.network, station.station, station.location, station.channel].filter(Boolean).join(" ");
}
```

Also refresh the `mergeStations` comment (line 52): OPFS entries now carry a location too — the catalog wins collisions because it has labels, e.g. `// Override with entries from catalog when there are collisions, since these have labels.`

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/seismic-admin`
Expected: PASS. (Saved admin selections in localStorage use the old key shape; they're pruned automatically on refresh — accepted in the design.)

**Step 5: Commit**

```bash
git add src/seismic-admin
git commit -m "Show location in admin station labels and fixtures."
```

---

### Task 7: Envelope generation script — `--location` arg and per-location trace filtering

No Jest coverage exists for this CLI; verification is the scripts type check plus a careful read. The key correctness fix: today traces are keyed by channel only, so two instruments sharing a channel code (e.g. locations `00` and `10`, both `BHZ`) would be merged into one envelope stream.

**Files:**
- Modify: `scripts/seismic/generate-envelopes.ts`

**Step 1: Add the CLI arg**

- `ScriptConfig`: add `/** SEED location code (e.g., "00"). Blank ("") is the blank location. */ location: string;` and seed `location: ""` in the `parseArgs` defaults object.
- Add to the arg switch: `case "--location": config.location = args[i + 1]; i += 2; break;`
- Add `[--location <loc>]` to the usage message and to the example command in the header comment.

**Step 2: Capture and filter by location code**

- `RawTrace`: add `location: string;`.
- In `loadMiniSeedFile`, capture it from seisplotjs: `location: seis.locationCode ?? "",` (verify the property name against `node_modules/seisplotjs`'s `Seismogram` typings before assuming; segments also expose it if the seismogram doesn't).
- `findSensitivity`: add a `location: string` parameter and filter `metadata.filter(m => m.channel === channel && (m.location ?? "") === location)`; update both call sites to pass `config.location`.
- In `main`, filter every trace read by location as well as channel:
  - channel discovery: `const channelsFound = new Set(firstFileTraces.filter(t => t.location === config.location).map(t => t.channel));`
  - `firstTrace`: `firstFileTraces.find(t => t.channel === channel && t.location === config.location)`
  - `channelTraces`: `.filter(t => t.channel === channel && t.location === config.location)`

**Step 3: Thread location into tile keys**

- Fix the stale call: `const metadata = await fetchStationMetadata({ network: config.network, station: config.station });`
- `wipeExistingTiles`: replace the `network, station, channel` string params with a single `stationData: StationData` param and use it in `getStationChannelPrefix(stationData)`; caller passes `{ network: config.network, station: config.station, location: config.location, channel }`.
- `makeFlushTile`: same replacement — take `stationData: StationData` instead of the three strings and pass it to `getTileS3Key`; caller builds the same object.
- Import `StationData` from `../../shared/seismic/seismic-types.js`.

**Step 4: Verify**

Run: `npx tsc --noEmit -p scripts/tsconfig.json`
Expected: no errors in `generate-envelopes.ts` (if the project-wide scripts check surfaces pre-existing errors in other files, ignore those but fix any in this file).

Also run: `npm run check:types` (unchanged, but cheap insurance).

**Step 5: Commit**

```bash
git add scripts/seismic
git commit -m "Generate envelopes per location code and add --location arg."
```

---

### Task 8: Docs sweep + full verification

**Files:**
- Modify: any doc that shows the old key layouts (check `docs/seismic/envelope-tile-cache-design.md`, `docs/seismic/browser-seismic-downloader.md`, `docs/seismic/seismic-tiles-plan.md`)

**Step 1: Update stale layout examples**

Run: `grep -rn 'network}_{station\|seismic-cache' docs/` and update any key-format examples to the v2 shapes:
- S3: `v2/{network}_{station}/{location}/{channel}/L{level}/{tileIndex}`
- OPFS: `/seismic-cache-v2/{network}_{station}/{location}/{channel}/{year}/{doy}.mseed`

**Step 2: Full verification**

Run, and confirm each passes before claiming done:

```bash
npm run check:types
npm run lint:build
npm test -- --no-watchman
```

**Step 3: Commit**

```bash
git add docs
git commit -m "Update seismic storage docs for v2 location-aware layout."
```

**Step 4: Manual follow-ups (outside this change)**

- Regenerate envelope tiles into `v2/` with the updated script (once per station/location).
- Optionally delete the v1 S3 objects: `aws s3 rm --recursive s3://models-resources/collaborative-learning/envelopes/v1/`.
