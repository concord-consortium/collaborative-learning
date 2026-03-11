# SharedSeismogram Design

**Date:** 2026-03-11
**Branch:** seismic-shared-model

## Overview

Introduce a `SharedSeismogram` shared model that holds seismic waveform data loaded by the wave runner tile. When the user presses "Load Data," the wave runner fetches miniseed files from S3, parses them into a `seisplotjs` `Seismogram` object, and stores it in the shared model. When the user presses "Timeline It!," a new timeline tile is created and linked to the same shared model, where it renders a single full-waveform visualization.

## Architecture

### New: SharedSeismogram (`src/plugins/shared-seismogram/`)

Follows the same pattern as `src/plugins/shared-variables/shared-variables.ts` and `src/models/shared/shared-data-set.ts`.

**`shared-seismogram.ts`**

```typescript
export const kSharedSeismogramType = "SharedSeismogram";

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
  })
  .volatile(() => ({
    seismogram: undefined as Seismogram | undefined,
  }))
  .views(self => ({
    get hasData() {
      return self.seismogram !== undefined;
    }
  }))
  .actions(self => ({
    setSeismogram(s: Seismogram | undefined) {
      self.seismogram = s;
    }
  }));
```

Because the seismogram is volatile, it is never persisted. On document reload, the wave runner tile will show no data and the user must press "Load Data" again.

**`shared-seismogram-registration.ts`**

```typescript
registerSharedModelInfo({
  type: kSharedSeismogramType,
  modelClass: SharedSeismogram,
  hasName: false,
});
```

This file is imported from `src/register-tile-types.ts` alongside other shared model registrations.

### Changes: WaveRunnerContentModel (`src/plugins/wave-runner/models/wave-runner-content.ts`)

Two new actions are added to the content model:

**`loadData()`**
1. Get the shared model manager via `getSharedModelManager(self)`.
2. If no `SharedSeismogram` is linked yet, create one and register it via `smm.addTileSharedModel(self, sharedSeismogram, true)` (wave runner is the provider).
3. Fetch the hardcoded S3 miniseed URLs, parse them, and call `sharedSeismogram.setSeismogram(merged)`.
4. Store loading/error state as volatile properties on the content model so the toolbar and component can observe them.

**`timelineIt()`**
1. Get the document content via `getParent(self, 2)` (or equivalent MST traversal).
2. Call `documentContent.addTileContentInNewRow(defaultTimelineContent())` to insert a new timeline tile below.
3. Get the `SharedSeismogram` already linked to the wave runner from the shared model manager.
4. Link the new timeline tile as a consumer: `smm.addTileSharedModel(timelineTileContent, sharedSeismogram)`.

### Changes: Wave Runner Toolbar (`src/plugins/wave-runner/wave-runner-toolbar.tsx`)

- **Load Data** button: enabled when `!model.isLoading && !model.hasData`. Calls `model.loadData()`.
- **Timeline It!** button: enabled when `model.hasData`. Calls `model.timelineIt()`.

Both buttons need access to the tile's content model. They receive it via the existing `IToolbarButtonComponentProps` or by using `getTileModel` / MST environment patterns established by other toolbar buttons.

### Changes: StatusAndOutput Component (`src/plugins/wave-runner/components/status-and-output.tsx`)

- Remove the `useEffect` auto-fetch and local React state (`seismogramData`, `loading`, `error`).
- Observe the wave runner content model's volatile `isLoading` and `error` state, and the `SharedSeismogram`'s volatile `seismogram` property.
- Render waveform panels from the shared model's data, same as before.

### Changes: Timeline Tile (`src/plugins/timeline/`)

- In `updateAfterSharedModelChanges`, check for a linked `SharedSeismogram`.
- If present and `hasData`, render a single `WaveformPanel` covering the seismogram's full time range.
- `WaveformPanel` is currently in `src/plugins/wave-runner/components/`. It should be moved to a shared location (e.g., `src/plugins/shared-seismogram/components/waveform-panel.tsx`) so both tiles can import it without a cross-plugin dependency.

## Data Flow

```
User clicks "Load Data"
  → WaveRunnerContentModel.loadData()
    → Creates SharedSeismogram (if first time), registers as provider
    → Sets isLoading = true (volatile)
    → Fetches 7 miniseed files from S3
    → Parses and merges into Seismogram
    → SharedSeismogram.setSeismogram(merged)
    → Sets isLoading = false (volatile)
  → StatusAndOutput observes change, renders waveform panels

User clicks "Timeline It!"
  → WaveRunnerContentModel.timelineIt()
    → Inserts timeline tile via addTileContentInNewRow
    → Links timeline to SharedSeismogram as consumer
  → TimelineContentModel.updateAfterSharedModelChanges()
    → Reads seismogram from SharedSeismogram
    → Timeline renders single full-waveform WaveformPanel
```

## File Map

| File | Change |
|------|--------|
| `src/plugins/shared-seismogram/shared-seismogram.ts` | New — SharedSeismogram MST model |
| `src/plugins/shared-seismogram/shared-seismogram-registration.ts` | New — registers model with shared model registry |
| `src/plugins/shared-seismogram/components/waveform-panel.tsx` | Moved from wave-runner (updated imports) |
| `src/plugins/shared-seismogram/components/waveform-panel.scss` | Moved from wave-runner |
| `src/plugins/wave-runner/models/wave-runner-content.ts` | Add `loadData()`, `timelineIt()`, volatile loading/error state |
| `src/plugins/wave-runner/wave-runner-toolbar.tsx` | Wire Load Data and Timeline It! buttons |
| `src/plugins/wave-runner/components/status-and-output.tsx` | Remove auto-fetch; observe shared model |
| `src/plugins/timeline/models/timeline-content.ts` | Add `updateAfterSharedModelChanges` to link SharedSeismogram |
| `src/register-tile-types.ts` | Import shared-seismogram-registration |

## Out of Scope

- Persisting the seismogram data across reloads (volatile only for now)
- Using dropdown selections to determine the data source
- Multiple seismogram channels or stations
- Running the seismic model (Play/Restart/Reset buttons remain stubs)
