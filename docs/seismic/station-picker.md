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

If `stations` is missing or empty, the station dropdown should be hidden or disabled
with no selectable options.

### StationConfig Interface

The unit config station entries use this shape (defined in the wave-runner plugin):

```typescript
interface StationConfig {
  network: string;
  station: string;
  location?: string;
  channel: string;
  label: string;
}
```

This is the config shape (with `label` for display). `StationModel` (below) is the
persisted shape (without `label`). The component maps between them.

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

With a computed `id` view returning the SEED identifier (using underscore separators):

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
setStation(station: SnapshotIn<typeof StationModel>) {
  self.station = cast(station);
  self.sharedSeismogram?.setSeismogram(undefined);
}
```

Takes a snapshot (plain object), not a live MST instance. This avoids MST ownership
issues — live instances get adopted into the tree on assignment and cannot be reused.
Clears the existing seismogram when station changes, same pattern as `setStartDate`/
`setEndDate`.

**loadData change:**

If `station` is undefined when `loadData` is called, bail out (do not load). The
component's `useEffect` is responsible for setting the default station on mount — see
DataSetup Component section below. This keeps config access in the React layer (via
hooks) rather than reaching into `getAppConfig` from the model.

Pass `self.station` snapshot through to `SharedSeismogram.loadData`.

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

`fetchRawSeismicData` gains a `location` parameter inserted between `station` and
`channel`. This is a breaking change to the internal API — all existing call sites must
be updated (including any tests).

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

`fetchFromLocal` and `fetchFromMock` remain location-agnostic — they do not use the
location parameter in their URL construction. The local ROVER path format
(`{station}.{network}.{year}.{doy}`) does not include location.

---

## DataSetup Component Changes

File: `src/plugins/wave-runner/components/data-setup.tsx`

**Reading config:**

```typescript
const stationConfigs = useSettingFromStores("stations", "wave-runner") as StationConfig[] | undefined;
const defaultStationIndex = (useSettingFromStores("defaultStation", "wave-runner") as number) ?? 0;
```

**Building the options list:**

Use `useMemo` to build an array of `{ config: StationConfig; id: string }` entries from
the config. The `id` is computed using the same logic as `StationModel`'s `id` view.
These are plain objects, not MST instances.

If `content.station` exists but its `id` doesn't match any config entry, append it to
the list using its `id` as the display label. This handles the case where a saved
document references a station later removed from the unit config.

If `stationConfigs` is undefined or empty, the dropdown is disabled.

**Default station on mount:**

If `content.station` is undefined when the component mounts (or when `stationConfigs`
becomes available), auto-set it from the `defaultStation` index via a `useEffect`. This
is the single authoritative mechanism for applying the default — `loadData` does not
fall back to config.

**Select element:**

- `<option value={id}>` with `config.label` as display text
- Selected value matches `content.station?.id` (computed via the same id logic)
- On change, find the matching config entry and call `content.setStation({ network, station, location, channel })` with a plain snapshot
