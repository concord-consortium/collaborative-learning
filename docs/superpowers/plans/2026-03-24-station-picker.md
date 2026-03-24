# Station Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the station picker dropdown so users can select from a unit-configured list of seismic stations, with the selection persisted in the document.

**Architecture:** A new `StationModel` MST model holds station identity (network/station/location/channel/label). Unit config provides the station list and default index. The `DataSetup` component reads config, populates the dropdown, and sets the station on the content model. `SharedSeismogram.loadData` and `fetchRawSeismicData` are updated to accept station parameters instead of hardcoded values.

**Tech Stack:** React 17, MobX State Tree, TypeScript, Jest

**Spec:** `docs/seismic/station-picker.md`

---

### Task 1: Create StationModel

**Files:**
- Create: `src/plugins/shared-seismogram/station-model.ts`
- Test: `src/plugins/shared-seismogram/station-model.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/plugins/shared-seismogram/station-model.test.ts
import { StationModel, stationId } from "./station-model";

describe("StationModel", () => {
  it("creates a station with all fields", () => {
    const station = StationModel.create({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(station.network).toBe("AK");
    expect(station.station).toBe("K204");
    expect(station.location).toBe("");
    expect(station.channel).toBe("HNZ");
    expect(station.label).toBe("Anchorage Airport");
  });

  it("defaults location to empty string", () => {
    const station = StationModel.create({
      network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(station.location).toBe("");
  });

  it("computes id with empty location as double underscore", () => {
    const station = StationModel.create({
      network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(station.id).toBe("AK_K204___HNZ");
  });

  it("computes id with non-empty location", () => {
    const station = StationModel.create({
      network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine"
    });
    expect(station.id).toBe("AK_DDM_01_HNZ");
  });
});

describe("stationId", () => {
  it("computes id from a plain object (snapshot)", () => {
    expect(stationId({ network: "AK", station: "K204", location: "", channel: "HNZ" }))
      .toBe("AK_K204___HNZ");
  });

  it("computes id when location is undefined", () => {
    expect(stationId({ network: "AK", station: "K204", channel: "HNZ" }))
      .toBe("AK_K204___HNZ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/plugins/shared-seismogram/station-model.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write the StationModel implementation**

```typescript
// src/plugins/shared-seismogram/station-model.ts
import { types, Instance, SnapshotIn } from "mobx-state-tree";

/**
 * Compute the SEED-style station identifier from station fields.
 * Usable with both MST instances and plain config objects.
 * Format: {network}_{station}_{location}_{channel}
 * Empty location becomes "__".
 */
export function stationId(
  station: { network: string; station: string; location?: string; channel: string }
): string {
  const loc = station.location || "__";
  return `${station.network}_${station.station}_${loc}_${station.channel}`;
}

export const StationModel = types
  .model("Station", {
    network: types.string,
    station: types.string,
    location: types.optional(types.string, ""),
    channel: types.string,
    label: types.string,
  })
  .views(self => ({
    get id() {
      return stationId(self);
    },
  }));

export interface StationModelType extends Instance<typeof StationModel> {}
export type StationSnapshot = SnapshotIn<typeof StationModel>;

/**
 * Shape of a station entry in unit configuration.
 * Same fields as StationSnapshot (location is optional, defaults to "").
 */
export interface StationConfig {
  network: string;
  station: string;
  location?: string;
  channel: string;
  label: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/plugins/shared-seismogram/station-model.test.ts --no-coverage`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/plugins/shared-seismogram/station-model.ts src/plugins/shared-seismogram/station-model.test.ts
git commit -m "CLUE-440 feat: add StationModel MST model with id view and stationId helper"
```

---

### Task 2: Add location parameter to fetchRawSeismicData

**Files:**
- Modify: `shared/seismic/earthscope-client.ts`
- Modify: `shared/seismic/earthscope-client.test.ts`

- [ ] **Step 1: Update existing tests to include location parameter**

In `shared/seismic/earthscope-client.test.ts`, update all `fetchRawSeismicData` calls
to include `location` as the 3rd parameter (between `station` and `channel`).

Change every call from:
```typescript
fetchRawSeismicData("AK", "K204", "HNZ", ...)
```
to:
```typescript
fetchRawSeismicData("AK", "K204", "", "HNZ", ...)
```

Also add a test that verifies the proxy URL uses `loc=--` when location is empty,
and uses the actual location value when provided:

```typescript
it("passes location to proxy URL, mapping empty to '--'", async () => {
  setUrl("http://localhost/?seismicProxy");
  fetchMock.mockResponseOnce(new ArrayBuffer(8) as any);

  await fetchRawSeismicData(
    "AK", "K204", "", "HNZ",
    "2026-01-30T00:00:00Z", "2026-01-31T00:00:00Z"
  );

  const calledUrl = fetchMock.mock.calls[0][0] as string;
  expect(calledUrl).toContain("loc=--");
});

it("passes non-empty location to proxy URL", async () => {
  setUrl("http://localhost/?seismicProxy");
  fetchMock.mockResponseOnce(new ArrayBuffer(8) as any);

  await fetchRawSeismicData(
    "AK", "DDM", "01", "HNZ",
    "2026-01-30T00:00:00Z", "2026-01-31T00:00:00Z"
  );

  const calledUrl = fetchMock.mock.calls[0][0] as string;
  expect(calledUrl).toContain("loc=01");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest shared/seismic/earthscope-client.test.ts --no-coverage`
Expected: FAIL — location parameter causes argument mismatch

- [ ] **Step 3: Update fetchRawSeismicData signature and proxy call**

In `shared/seismic/earthscope-client.ts`:

1. Add `location: string` parameter between `station` and `channel` in `fetchRawSeismicData`:

```typescript
export async function fetchRawSeismicData(
  network: string,
  station: string,
  location: string,
  channel: string,
  startTime: string,
  endTime: string,
  options?: { baseUrl?: string; signal?: AbortSignal }
): Promise<Response> {
```

2. Pass `location` through in the proxy call path. Update `fetchFromProxy` to accept
   `location` and use it:

```typescript
async function fetchFromProxy(
  network: string,
  station: string,
  location: string,
  channel: string,
  ...
) {
  ...
  const params = new URLSearchParams({
    net: network, sta: station, cha: channel, loc: location || "--",
    start: startTime, end: endTime,
  });
```

3. Update the call to `fetchFromProxy` inside `fetchRawSeismicData`:

```typescript
return fetchFromProxy(network, station, location, channel, startTime, endTime, options);
```

`fetchFromLocal` and `fetchFromMock` remain unchanged — they don't use location.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest shared/seismic/earthscope-client.test.ts --no-coverage`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/seismic/earthscope-client.ts shared/seismic/earthscope-client.test.ts
git commit -m "CLUE-440 feat: add location parameter to fetchRawSeismicData"
```

---

### Task 3: Update SharedSeismogram.loadData to accept station

**Files:**
- Modify: `src/plugins/shared-seismogram/shared-seismogram.ts`
- Modify: `src/plugins/shared-seismogram/shared-seismogram.test.ts`

- [ ] **Step 1: Update existing loadData tests to pass station**

In `shared-seismogram.test.ts`, define a test station at the top of the describe block:

```typescript
const testStation = { network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport" };
```

Update all 9 `model.loadData("2026-...", "2026-...")` calls in the file to
`model.loadData(testStation, "2026-...", "2026-...")`.

Update the assertion that checks `fetchRawSeismicData` call args:

```typescript
expect(mockFetch).toHaveBeenCalledWith(
  "AK", "K204", "", "HNZ",
  expect.stringContaining("2026-01-30"),
  expect.stringContaining("2026-01-31")
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/plugins/shared-seismogram/shared-seismogram.test.ts --no-coverage`
Expected: FAIL — loadData doesn't accept station argument yet

- [ ] **Step 3: Update SharedSeismogram.loadData implementation**

In `src/plugins/shared-seismogram/shared-seismogram.ts`:

1. Import the `StationSnapshot` type:
```typescript
import { StationSnapshot } from "./station-model";
```

2. Change the `loadData` signature from `(startDate: string, endDate: string)` to
   `(station: StationSnapshot, startDate: string, endDate: string)`.

3. Replace the hardcoded fetch call:
```typescript
// Before:
const response: Response = yield fetchRawSeismicData(
  "AK", "K204", "HNZ",
  chunkStart.toISOString(), chunkEnd.toISOString()
);

// After:
const response: Response = yield fetchRawSeismicData(
  station.network, station.station, station.location ?? "", station.channel,
  chunkStart.toISOString(), chunkEnd.toISOString()
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/plugins/shared-seismogram/shared-seismogram.test.ts --no-coverage`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/plugins/shared-seismogram/shared-seismogram.ts src/plugins/shared-seismogram/shared-seismogram.test.ts
git commit -m "CLUE-440 feat: SharedSeismogram.loadData accepts station parameter"
```

---

### Task 4: Add station property and setStation action to WaveRunnerContentModel

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts`
- Modify: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

- [ ] **Step 1: Add tests for station property and setStation action**

Add to `src/plugins/wave-runner/models/wave-runner-content.test.ts`:

```typescript
import { StationModel } from "../../shared-seismogram/station-model";

// ... existing tests ...

it("starts with no station", () => {
  const content = WaveRunnerContentModel.create();
  expect(content.station).toBeUndefined();
});

it("allows setting a station via snapshot", () => {
  const content = WaveRunnerContentModel.create();
  content.setStation({
    network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
  });
  expect(content.station?.network).toBe("AK");
  expect(content.station?.station).toBe("K204");
  expect(content.station?.channel).toBe("HNZ");
  expect(content.station?.label).toBe("Anchorage Airport");
});

it("replaces station when setStation is called again", () => {
  const content = WaveRunnerContentModel.create();
  content.setStation({
    network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
  });
  content.setStation({
    network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine"
  });
  expect(content.station?.station).toBe("DDM");
  expect(content.station?.location).toBe("01");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/plugins/wave-runner/models/wave-runner-content.test.ts --no-coverage`
Expected: FAIL — `station` property and `setStation` don't exist

- [ ] **Step 3: Add station property and setStation action**

In `src/plugins/wave-runner/models/wave-runner-content.ts`:

1. Add imports:
```typescript
import { cast, types, Instance } from "mobx-state-tree";
import { StationModel, StationSnapshot } from "../../shared-seismogram/station-model";
```

2. Add `station` to props:
```typescript
.props({
  type: types.optional(types.literal(kWaveRunnerTileType), kWaveRunnerTileType),
  startDate: types.optional(types.string, "2026-01-30"),
  endDate: types.optional(types.string, "2026-02-06"),
  station: types.maybe(StationModel),
})
```

3. Add `setStation` to the first actions block (alongside `setStartDate`/`setEndDate`):
```typescript
setStation(station: StationSnapshot) {
  self.station = cast(station);
  self.sharedSeismogram?.setSeismogram(undefined);
},
```

4. Update `loadData` to bail out if no station is set, and pass station to
   `SharedSeismogram.loadData`:

```typescript
async loadData() {
  if (!self.station) return;
  const smm = getSharedModelManager(self);
  if (!smm?.isReady) return;

  let sharedSeismogram = self.sharedSeismogram;
  if (!sharedSeismogram) {
    const newSharedSeismogram = SharedSeismogram.create();
    smm.addTileSharedModel(self, newSharedSeismogram, true);
    sharedSeismogram = self.sharedSeismogram ?? newSharedSeismogram;
  }

  // Pass a plain snapshot, not a live MST node, since loadData is async
  // and the station could theoretically be replaced between yields.
  const { network, station, location, channel, label } = self.station;
  sharedSeismogram.loadData({ network, station, location, channel, label },
    self.startDate, self.endDate);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/plugins/wave-runner/models/wave-runner-content.test.ts --no-coverage`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "CLUE-440 feat: add station property and setStation action to WaveRunnerContentModel"
```

---

### Task 5: Wire up station picker dropdown in DataSetup component

**Files:**
- Modify: `src/plugins/wave-runner/components/data-setup.tsx`
- Modify: `src/plugins/wave-runner/components/wave-runner-tile.test.tsx`

- [ ] **Step 1: Add tests for station dropdown rendering and interaction**

In `src/plugins/wave-runner/components/wave-runner-tile.test.tsx`:

1. Add station config to the test stores setup:

```typescript
const stores = specStores({
  appConfig: specAppConfig({
    config: {
      settings: {
        "wave-runner": {
          tools: ["load-data", "|", "play", "restart", "reset", "|", "timeline"],
          stations: [
            { network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport" },
            { network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine" }
          ],
          defaultStation: 0
        }
      }
    }
  })
});
```

2. Add tests:

```typescript
it("renders station dropdown with options from config", () => {
  renderWithStores();
  const stationSelect = screen.getByLabelText("Station") as HTMLSelectElement;
  const options = Array.from(stationSelect.options);
  expect(options).toHaveLength(2);
  expect(options[0].text).toBe("Anchorage Airport");
  expect(options[1].text).toBe("Dexter Display Mine");
});

it("auto-selects the default station on mount", () => {
  renderWithStores();
  const stationSelect = screen.getByLabelText("Station") as HTMLSelectElement;
  expect(stationSelect.value).toBe("AK_K204___HNZ");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/plugins/wave-runner/components/wave-runner-tile.test.tsx --no-coverage`
Expected: FAIL — dropdown still has only the placeholder option

- [ ] **Step 3: Wire up the DataSetup component**

In `src/plugins/wave-runner/components/data-setup.tsx`:

```typescript
import { observer } from "mobx-react";
import React, { useEffect, useMemo } from "react";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { StationConfig, stationId } from "../../shared-seismogram/station-model";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import "./data-setup.scss";

export const DataSetup: React.FC = observer(function DataSetup() {
  const content = useWaveRunnerContent();
  const stationConfigs = useSettingFromStores("stations", "wave-runner") as StationConfig[] | undefined;
  const defaultStationIndex = (useSettingFromStores("defaultStation", "wave-runner") as number) ?? 0;

  // Build the options list: config stations + orphaned saved station
  const stationOptions = useMemo(() => {
    const options = (stationConfigs ?? []).map(config => ({
      config,
      id: stationId(config),
    }));
    return options;
  }, [stationConfigs]);

  // Compute the current station's id for matching
  const currentStationId = content.station
    ? stationId(content.station)
    : undefined;

  // Check if the saved station is orphaned (not in config)
  const isOrphaned = currentStationId != null
    && stationOptions.every(opt => opt.id !== currentStationId);

  // Build the full dropdown list including orphaned station
  const dropdownOptions = useMemo(() => {
    if (!isOrphaned || !content.station) return stationOptions;
    return [
      ...stationOptions,
      { config: content.station as StationConfig, id: currentStationId! },
    ];
  }, [stationOptions, isOrphaned, content.station, currentStationId]);

  // Auto-set default station on mount
  useEffect(() => {
    if (!content.station && stationConfigs?.length) {
      const defaultConfig = stationConfigs[defaultStationIndex] ?? stationConfigs[0];
      content.setStation({
        network: defaultConfig.network,
        station: defaultConfig.station,
        location: defaultConfig.location ?? "",
        channel: defaultConfig.channel,
        label: defaultConfig.label,
      });
    }
  }, [content, stationConfigs, defaultStationIndex]);

  const handleStationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const match = dropdownOptions.find(opt => opt.id === selectedId);
    if (match) {
      content.setStation({
        network: match.config.network,
        station: match.config.station,
        location: match.config.location ?? "",
        channel: match.config.channel,
        label: match.config.label,
      });
    }
  };

  const hasStations = dropdownOptions.length > 0;

  return (
    <div className="section data-setup">
      <div className="section-title">Data Setup</div>
      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="wave-runner-station">Station</label>
          <select
            id="wave-runner-station"
            className="dropdown"
            value={currentStationId ?? ""}
            onChange={handleStationChange}
            disabled={!hasStations}
          >
            {!hasStations && <option value="">No stations configured</option>}
            {dropdownOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.config.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Model</label>
          <select className="dropdown">
            <option>Choose a model</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="wave-runner-start-date">Start Date and Time</label>
          <input
            id="wave-runner-start-date"
            className="datetime"
            type="datetime-local"
            value={`${content.startDate}T00:00`}
            onChange={e => content.setStartDate(e.target.value.split("T")[0])}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="wave-runner-end-date">End Date and Time</label>
          <input
            id="wave-runner-end-date"
            className="datetime"
            type="datetime-local"
            value={`${content.endDate}T00:00`}
            onChange={e => content.setEndDate(e.target.value.split("T")[0])}
          />
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/plugins/wave-runner/components/wave-runner-tile.test.tsx --no-coverage`
Expected: PASS — all tests pass including new station dropdown tests

- [ ] **Step 5: Commit**

```bash
git add src/plugins/wave-runner/components/data-setup.tsx src/plugins/wave-runner/components/wave-runner-tile.test.tsx
git commit -m "CLUE-440 feat: wire up station picker dropdown with unit config"
```

---

### Task 6: Add stations to default app config

**Files:**
- Modify: `src/clue/app-config.json`

- [ ] **Step 1: Add default stations to wave-runner settings**

In `src/clue/app-config.json`, add `stations` and `defaultStation` to the
`wave-runner` settings block:

```json
"wave-runner": {
  "tools": [
    "load-data",
    "|",
    "play",
    "restart",
    "reset",
    "|",
    "timeline"
  ],
  "stations": [
    { "network": "AK", "station": "K204", "channel": "HNZ", "label": "Anchorage Airport" }
  ],
  "defaultStation": 0
}
```

This provides a single default station matching the existing mock data, so the app
works out of the box without unit-level config.

- [ ] **Step 2: Run all wave-runner and shared-seismogram tests**

Run: `npx jest --testPathPattern="wave-runner|shared-seismogram" --no-coverage`
Expected: PASS — all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/clue/app-config.json
git commit -m "CLUE-440 feat: add default station config for wave-runner"
```

---

### Task 7: Run full test suite and type check

- [ ] **Step 1: Run TypeScript type checking**

Run: `npm run check:types`
Expected: No type errors

- [ ] **Step 2: Run full test suite for affected files**

Run: `npx jest --testPathPattern="wave-runner|shared-seismogram|earthscope-client" --no-coverage`
Expected: PASS — all tests pass

- [ ] **Step 3: Fix any failures**

If there are failures, fix them and commit.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "CLUE-440 fix: address test/type issues from station picker integration"
```
