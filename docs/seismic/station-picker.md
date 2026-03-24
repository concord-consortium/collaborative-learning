# Station Picker Design

**Branch:** `CLUE-440-station-picker` (based on `CLUE-440-raw-data-fetching`)

**Goal:** Wire up the station picker so users can select from a unit-configured list of
stations, with the selection persisted in the document. This replaces the hardcoded
`AK`/`K204`/`HNZ` values currently in `SharedSeismogram.loadData`.

---

## Unit Configuration

Add `stations` array and `defaultStation` index to `settings["wave-runner"]` in the unit
`content.json`:

```json
"wave-runner": {
  "tools": ["load-data", "|", "play", "restart", "reset", "|", "timeline"],
  "stations": [
    { "network": "AK", "station": "K204", "channel": "HNZ", "label": "Anchorage Airport" },
    { "network": "AK", "station": "DDM", "location": "01", "channel": "HNZ", "label": "Dexter Display Mine" }
  ],
  "defaultStation": 0
}
```

- Each station entry has `network`, `station`, `channel`, `label`, and an optional
  `location` (defaults to `""` if omitted).
- `defaultStation` is the index into the `stations` array that is pre-selected for new
  tiles. Defaults to `0` if omitted.

---

## StationModel

New MST model defined in `src/plugins/shared-seismogram/station-model.ts`:

```typescript
export const StationModel = types.model("Station", {
  network: types.string,
  station: types.string,
  location: types.optional(types.string, ""),
  channel: types.string,
});
```

With a computed `id` view returning the SEED identifier:

```typescript
get id() {
  const loc = self.location || "__";
  return `${self.network}_${self.station}_${loc}_${self.channel}`;
}
```

Examples: `AK_K204___HNZ` (empty location → `__`), `AK_DDM_01_HNZ`.

Instances are immutable — no actions defined on the model. Changing station means
replacing the instance.

---

## WaveRunnerContentModel Changes

File: `src/plugins/wave-runner/models/wave-runner-content.ts`

**New property:**

```typescript
station: types.maybe(StationModel),
```

**New action:**

```typescript
setStation(station: SnapshotIn<typeof StationModel> | Instance<typeof StationModel>) {
  self.station = cast(station);
  self.sharedSeismogram?.setSeismogram(undefined);
}
```

Clears the existing seismogram when station changes, same pattern as `setStartDate`/
`setEndDate`.

**loadData change:**

When `loadData` is called and `station` is undefined, populate it from the unit config's
`defaultStation` index before proceeding.

Pass `self.station` through to `SharedSeismogram.loadData`.

---

## SharedSeismogram.loadData Changes

File: `src/plugins/shared-seismogram/shared-seismogram.ts`

Signature changes from:

```typescript
loadData(startDate: string, endDate: string)
```

to:

```typescript
loadData(station: StationSnapshot, startDate: string, endDate: string)
```

Where `StationSnapshot` is the snapshot type of `StationModel`.

Inside the fetch loop, uses `station.network`, `station.station`, `station.location`,
and `station.channel` instead of hardcoded `"AK", "K204", "HNZ"`.

---

## earthscope-client.ts Changes

File: `shared/seismic/earthscope-client.ts`

`fetchRawSeismicData` gains a `location` parameter:

```typescript
export async function fetchRawSeismicData(
  network: string,
  station: string,
  location: string,
  channel: string,
  startTime: string,
  endTime: string,
  options?: { baseUrl?: string; signal?: AbortSignal }
): Promise<Response>
```

In `fetchFromProxy`, the location is mapped for the FDSN URL:

```typescript
loc: location || "--",
```

Empty string becomes `"--"` (FDSN convention for empty location code).

---

## DataSetup Component Changes

File: `src/plugins/wave-runner/components/data-setup.tsx`

**Reading config:**

```typescript
const stations = useSettingFromStores("stations", "wave-runner") as StationConfig[];
const defaultStationIndex = (useSettingFromStores("defaultStation", "wave-runner") as number) ?? 0;
```

**Pre-creating station instances:**

Use `useMemo` to create immutable `StationModel` instances from the config array. These
are reused across renders — selecting a station sets `content.station` to one of these
pre-created instances.

**Orphaned station handling:**

If `content.station` exists but its `id` doesn't match any station in the unit config,
append it to the dropdown list using its `id` as the display label. This handles the case
where a saved document references a station that was later removed from the unit config.

**Default station on mount:**

If `content.station` is undefined when the component mounts, auto-set it from the
`defaultStation` index via a `useEffect`.

**Select element:**

- `<option value={station.id}>` with `label` as display text
- Selected value matches `content.station?.id`
- On change, find the matching pre-created instance and call `content.setStation(instance)`
