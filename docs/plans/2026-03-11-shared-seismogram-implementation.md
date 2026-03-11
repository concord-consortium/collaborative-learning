# SharedSeismogram Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a `SharedSeismogram` shared model so the wave runner tile can load seismic data behind a "Load Data" button and share it with a new timeline tile created via a "Timeline It!" button.

**Architecture:** Follow the existing shared model pattern (`SharedVariables`, `SharedDataSet`). The shared model lives in `src/plugins/shared-seismogram/`. `SharedSeismogram` owns all data-loading logic (fetch, parse, store). `WaveRunnerContentModel` creates the shared model and calls `sharedSeismogram.loadData()`. The "Timeline It!" button uses `AddTilesContext.addTileAfter` (from the React component layer) to create the timeline tile and link the shared model — this is the same pattern as `DataSetViewButton` in `data-set-view-button.tsx`. The timeline tile reads the seismogram from the shared model via a view.

**Key type-safety rules:**
- Never cast to `any`. Use type guards instead of casts.
- `findFirstSharedModelByType(SharedSeismogram)` already infers `SharedSeismogramType | undefined` — no cast needed.
- Use `isSharedSeismogram` in views that get a shared model from a generic union.
- Use `isWaveRunnerContentModel` in toolbar buttons instead of casting.

**Tech Stack:** MobX State Tree (MST) with `flow()` for async, React with `observer`, `TileModelContext` and `AddTilesContext` for toolbar access, `seisplotjs` for waveform types.

**Design doc:** `docs/plans/2026-03-11-shared-seismogram-design.md`

---

### Task 1: Create the SharedSeismogram model with data-loading logic

**Files:**
- Create: `src/plugins/shared-seismogram/shared-seismogram.ts`
- Create: `src/plugins/shared-seismogram/shared-seismogram.test.ts`

**Background — MST async actions with `flow()`:**

```typescript
import { flow, types } from "mobx-state-tree";

const MyModel = types.model({})
  .volatile(() => ({ isLoading: false }))
  .actions(self => ({
    doAsync: flow(function* () {
      self.isLoading = true;
      const result = yield fetch("url").then(r => r.arrayBuffer()); // yield = await
      self.isLoading = false;
    })
  }));
```

**Background — `isSharedSeismogram` type guard:**

The `SharedModel` base type is a union at runtime. Anywhere you receive a `SharedModelType` and need to narrow it to `SharedSeismogramType`, use the `isSharedSeismogram` guard exported from this file.

**Step 1: Write the failing tests**

```typescript
// src/plugins/shared-seismogram/shared-seismogram.test.ts
import { SharedSeismogram, kSharedSeismogramType, isSharedSeismogram } from "./shared-seismogram";

describe("SharedSeismogram", () => {
  it("has the correct type", () => {
    const model = SharedSeismogram.create();
    expect(model.type).toBe(kSharedSeismogramType);
  });

  it("starts with no seismogram data, not loading, no error", () => {
    const model = SharedSeismogram.create();
    expect(model.seismogram).toBeUndefined();
    expect(model.hasData).toBe(false);
    expect(model.isLoading).toBe(false);
    expect(model.loadError).toBeNull();
  });

  it("stores seismogram data after setSeismogram", () => {
    const model = SharedSeismogram.create();
    const fakeSeismogram = { numPoints: 100 } as any;
    model.setSeismogram(fakeSeismogram);
    expect(model.seismogram).toBe(fakeSeismogram);
    expect(model.hasData).toBe(true);
  });

  it("can clear seismogram data", () => {
    const model = SharedSeismogram.create();
    model.setSeismogram({ numPoints: 100 } as any);
    model.setSeismogram(undefined);
    expect(model.seismogram).toBeUndefined();
    expect(model.hasData).toBe(false);
  });

  it("isSharedSeismogram returns true for a SharedSeismogram instance", () => {
    const model = SharedSeismogram.create();
    expect(isSharedSeismogram(model)).toBe(true);
  });

  describe("loadData", () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as any);

      jest.mock("seisplotjs", () => ({
        miniseed: {
          parseDataRecords: jest.fn().mockReturnValue([{ stub: true }]),
          merge: jest.fn().mockReturnValue({ numPoints: 42 }),
        },
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("sets isLoading true while fetching, then false when done", async () => {
      const model = SharedSeismogram.create();
      const promise = model.loadData();
      expect(model.isLoading).toBe(true);
      await promise;
      expect(model.isLoading).toBe(false);
    });

    it("populates seismogram after successful load", async () => {
      const model = SharedSeismogram.create();
      await model.loadData();
      expect(model.hasData).toBe(true);
      expect(model.loadError).toBeNull();
    });

    it("sets loadError on fetch failure", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
      const model = SharedSeismogram.create();
      await model.loadData();
      expect(model.loadError).toContain("Network error");
      expect(model.isLoading).toBe(false);
      expect(model.hasData).toBe(false);
    });
  });
});
```

**Step 2: Run to verify failure**

```bash
npm test -- src/plugins/shared-seismogram/shared-seismogram.test.ts
```
Expected: FAIL — cannot find module `./shared-seismogram`

**Step 3: Implement the model**

```typescript
// src/plugins/shared-seismogram/shared-seismogram.ts
import { flow, getType, Instance, types } from "mobx-state-tree";
import { miniseed, seismogram as seismogramNS } from "seisplotjs";
type Seismogram = seismogramNS.Seismogram;
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";

export const kSharedSeismogramType = "SharedSeismogram";

const S3_BASE = "https://models-resources.s3.amazonaws.com/collaborative-learning/datasets";
const MSEED_URLS = [
  `${S3_BASE}/2026_01_30_00_00_00-2026_01_31_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_01_31_00_00_00-2026_02_01_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_01_00_00_00-2026_02_02_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_02_00_00_00-2026_02_03_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_03_00_00_00-2026_02_04_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_04_00_00_00-2026_02_05_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_05_00_00_00-2026_02_06_00_00_00_anchorage_airport.mseed`,
];

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
  })
  .volatile(() => ({
    seismogram: undefined as Seismogram | undefined,
    isLoading: false,
    loadError: null as string | null,
  }))
  .views(self => ({
    get hasData() {
      return self.seismogram !== undefined;
    }
  }))
  .actions(self => ({
    setSeismogram(s: Seismogram | undefined) {
      self.seismogram = s;
    },
    loadData: flow(function* () {
      self.isLoading = true;
      self.loadError = null;
      try {
        const buffers: ArrayBuffer[] = yield Promise.all(
          MSEED_URLS.map((url: string) => fetch(url).then((res: Response) => res.arrayBuffer()))
        );
        const allRecords = buffers.flatMap((buf: ArrayBuffer) => miniseed.parseDataRecords(buf));
        self.seismogram = miniseed.merge(allRecords);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.loadError = `Error loading seismic data: ${message}`;
      } finally {
        self.isLoading = false;
      }
    })
  }));

export interface SharedSeismogramType extends Instance<typeof SharedSeismogram> {}

export function isSharedSeismogram(model?: SharedModelType): model is SharedSeismogramType {
  return !!model && getType(model) === SharedSeismogram;
}
```

**Step 4: Run to verify tests pass**

```bash
npm test -- src/plugins/shared-seismogram/shared-seismogram.test.ts
```
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/plugins/shared-seismogram/shared-seismogram.ts src/plugins/shared-seismogram/shared-seismogram.test.ts
git commit -m "feat: add SharedSeismogram model with loadData action"
```

---

### Task 2: Register SharedSeismogram and add to tile registrations

**Files:**
- Create: `src/plugins/shared-seismogram/shared-seismogram-registration.ts`
- Modify: `src/register-tile-types.ts`

**Step 1: Create the registration file**

```typescript
// src/plugins/shared-seismogram/shared-seismogram-registration.ts
import { kSharedSeismogramType, SharedSeismogram } from "./shared-seismogram";
import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";

registerSharedModelInfo({
  type: kSharedSeismogramType,
  modelClass: SharedSeismogram,
  hasName: false,
});
```

**Step 2: Update `register-tile-types.ts`**

Add the shared seismogram registration import to both the `"Timeline"` and `"WaveRunner"` entries:

```typescript
  "Timeline": loggedLoad("Timeline", () => [
    import(/* webpackChunkName: "Timeline" */"./plugins/timeline/timeline-registration"),
    import(/* webpackChunkName: "SharedSeismogram" */"./plugins/shared-seismogram/shared-seismogram-registration")
  ]),
```

```typescript
  "WaveRunner": loggedLoad("WaveRunner", () => [
    import(/* webpackChunkName: "WaveRunner" */"./plugins/wave-runner/wave-runner-registration"),
    import(/* webpackChunkName: "SharedSeismogram" */"./plugins/shared-seismogram/shared-seismogram-registration")
  ])
```

**Step 3: Verify TypeScript compiles**

```bash
npm run check:types
```
Expected: no new errors

**Step 4: Commit**

```bash
git add src/plugins/shared-seismogram/shared-seismogram-registration.ts src/register-tile-types.ts
git commit -m "feat: register SharedSeismogram"
```

---

### Task 3: Move WaveformPanel to the shared-seismogram plugin

Both wave runner and timeline need `WaveformPanel`. Moving it into `shared-seismogram` avoids a cross-plugin dependency.

**Files:**
- Create: `src/plugins/shared-seismogram/components/waveform-panel.tsx` (copy + update scss import)
- Create: `src/plugins/shared-seismogram/components/waveform-panel.scss` (copy unchanged)
- Modify: `src/plugins/wave-runner/components/waveform-panel.test.tsx` (update import path)
- Modify: `src/plugins/wave-runner/components/status-and-output.tsx` (update import path)
- Delete: `src/plugins/wave-runner/components/waveform-panel.tsx`
- Delete: `src/plugins/wave-runner/components/waveform-panel.scss`

**Step 1: Copy files to new location**

Create `src/plugins/shared-seismogram/components/waveform-panel.tsx` with the same content as `src/plugins/wave-runner/components/waveform-panel.tsx`. The scss import (`import "./waveform-panel.scss"`) is a relative path that still works in the new location.

Copy `src/plugins/wave-runner/components/waveform-panel.scss` verbatim to `src/plugins/shared-seismogram/components/waveform-panel.scss`.

**Step 2: Update imports in wave-runner files**

In `src/plugins/wave-runner/components/waveform-panel.test.tsx`:
```typescript
// FROM:
import { WaveformPanel } from "./waveform-panel";
// TO:
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
```

In `src/plugins/wave-runner/components/status-and-output.tsx`:
```typescript
// FROM:
import { WaveformPanel } from "./waveform-panel";
// TO:
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
```

**Step 3: Delete old files**

```bash
rm src/plugins/wave-runner/components/waveform-panel.tsx
rm src/plugins/wave-runner/components/waveform-panel.scss
```

**Step 4: Run affected tests**

```bash
npm test -- src/plugins/wave-runner/components/waveform-panel.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/shared-seismogram/components/
git add src/plugins/wave-runner/components/waveform-panel.test.tsx
git add src/plugins/wave-runner/components/status-and-output.tsx
git rm src/plugins/wave-runner/components/waveform-panel.tsx
git rm src/plugins/wave-runner/components/waveform-panel.scss
git commit -m "refactor: move WaveformPanel to shared-seismogram plugin"
```

---

### Task 4: Update WaveRunnerContentModel with loadData and type guard

`WaveRunnerContentModel` creates the `SharedSeismogram`, delegates loading to it, and exposes proxy views for loading state. Add `isWaveRunnerContentModel` for use by toolbar buttons.

**Files:**
- Modify: `src/plugins/wave-runner/models/wave-runner-content.ts`
- Modify: `src/plugins/wave-runner/models/wave-runner-content.test.ts`

**Background — `findFirstSharedModelByType` infers the type:**

```typescript
// This call infers return type as SharedSeismogramType | undefined — no cast needed:
const shared = smm.findFirstSharedModelByType(SharedSeismogram);
```

**Background — inject a mock smm in tests:**

```typescript
const content = WaveRunnerContentModel.create({}, { sharedModelManager: mockSmm });
```

**Step 1: Write the failing tests**

```typescript
// src/plugins/wave-runner/models/wave-runner-content.test.ts
import { getType } from "mobx-state-tree";
import { WaveRunnerContentModel, isWaveRunnerContentModel } from "./wave-runner-content";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";

describe("WaveRunnerContent", () => {
  it("is always user resizable", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("isWaveRunnerContentModel returns true for a wave runner content model", () => {
    const content = WaveRunnerContentModel.create();
    expect(isWaveRunnerContentModel(content)).toBe(true);
  });

  it("isWaveRunnerContentModel returns false for other models", () => {
    const other = SharedSeismogram.create();
    expect(isWaveRunnerContentModel(other)).toBe(false);
  });

  describe("loadData", () => {
    it("creates a SharedSeismogram, registers it as provider, and calls loadData on it", async () => {
      const mockLoadData = jest.fn().mockResolvedValue(undefined);
      const createdSharedModel = { type: "SharedSeismogram", loadData: mockLoadData, hasData: false };
      let registeredSharedModel: unknown;

      const mockSmm = {
        isReady: true,
        findFirstSharedModelByType: jest.fn().mockReturnValue(undefined),
        addTileSharedModel: jest.fn().mockImplementation((_tile: unknown, model: unknown) => {
          registeredSharedModel = model;
          // Subsequent calls to findFirstSharedModelByType return the registered model
          mockSmm.findFirstSharedModelByType.mockReturnValue(model);
        }),
      };

      const content = WaveRunnerContentModel.create({}, { sharedModelManager: mockSmm });
      await content.loadData();

      expect(mockSmm.addTileSharedModel).toHaveBeenCalledWith(
        content,
        expect.objectContaining({ type: "SharedSeismogram" }),
        true
      );
      expect(mockLoadData).toHaveBeenCalled();
    });

    it("reuses an existing SharedSeismogram if already linked", async () => {
      const mockLoadData = jest.fn().mockResolvedValue(undefined);
      const existingSharedSeismogram = SharedSeismogram.create();
      // Attach a mock loadData to the existing model
      (existingSharedSeismogram as any).loadData = mockLoadData;

      const mockSmm = {
        isReady: true,
        findFirstSharedModelByType: jest.fn().mockReturnValue(existingSharedSeismogram),
        addTileSharedModel: jest.fn(),
      };

      const content = WaveRunnerContentModel.create({}, { sharedModelManager: mockSmm });
      await content.loadData();

      expect(mockSmm.addTileSharedModel).not.toHaveBeenCalled();
      expect(mockLoadData).toHaveBeenCalled();
    });

    it("does nothing if smm is not ready", async () => {
      const mockSmm = {
        isReady: false,
        findFirstSharedModelByType: jest.fn(),
        addTileSharedModel: jest.fn(),
      };
      const content = WaveRunnerContentModel.create({}, { sharedModelManager: mockSmm });
      await content.loadData();
      expect(mockSmm.addTileSharedModel).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run to verify failure**

```bash
npm test -- src/plugins/wave-runner/models/wave-runner-content.test.ts
```
Expected: FAIL — `content.loadData is not a function`, `isWaveRunnerContentModel is not exported`

**Step 3: Implement the updated model**

```typescript
// src/plugins/wave-runner/models/wave-runner-content.ts
import { getType, types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { kWaveRunnerTileType } from "../wave-runner-types";

export function defaultWaveRunnerContent(): WaveRunnerContentModelType {
  return WaveRunnerContentModel.create();
}

export const WaveRunnerContentModel = TileContentModel
  .named("WaveRunnerTool")
  .props({
    type: types.optional(types.literal(kWaveRunnerTileType), kWaveRunnerTileType),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram(): SharedSeismogramType | undefined {
      const smm = getSharedModelManager(self);
      // findFirstSharedModelByType infers SharedSeismogramType — no cast needed
      return smm?.findFirstSharedModelByType(SharedSeismogram);
    },
    get isLoading() {
      return this.sharedSeismogram?.isLoading ?? false;
    },
    get loadError() {
      return this.sharedSeismogram?.loadError ?? null;
    },
    get hasData() {
      return this.sharedSeismogram?.hasData ?? false;
    }
  }))
  .actions(self => ({
    async loadData() {
      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return;

      let sharedSeismogram = self.sharedSeismogram;
      if (!sharedSeismogram) {
        const newSharedSeismogram = SharedSeismogram.create();
        smm.addTileSharedModel(self, newSharedSeismogram, true);
        // After registration, re-read from the manager so we have the live instance
        sharedSeismogram = self.sharedSeismogram ?? newSharedSeismogram;
      }

      await sharedSeismogram.loadData();
    }
  }));

export interface WaveRunnerContentModelType extends Instance<typeof WaveRunnerContentModel> {}

export function isWaveRunnerContentModel(model: unknown): model is WaveRunnerContentModelType {
  return !!model && getType(model as object) === WaveRunnerContentModel;
}
```

**Step 4: Run the tests**

```bash
npm test -- src/plugins/wave-runner/models/wave-runner-content.test.ts
```
Expected: PASS. Fix any TypeScript issues.

**Step 5: Commit**

```bash
git add src/plugins/wave-runner/models/wave-runner-content.ts src/plugins/wave-runner/models/wave-runner-content.test.ts
git commit -m "feat: WaveRunnerContentModel delegates loading to SharedSeismogram"
```

---

### Task 5: Wire the toolbar buttons

The Load Data button calls `model.loadData()`. The Timeline It! button uses `AddTilesContext.addTileAfter` — the same pattern as `DataSetViewButton` in `data-set-view-button.tsx`. This is how tiles in CLUE create linked tiles: they pass the shared models to `addTileAfter`, which creates the tile and wires up the links.

Both buttons use `isWaveRunnerContentModel` to check the content model type instead of casting.

**Files:**
- Modify: `src/plugins/wave-runner/wave-runner-toolbar.tsx`

**Step 1: Rewrite the toolbar file**

```typescript
// src/plugins/wave-runner/wave-runner-toolbar.tsx
import React, { useContext } from "react";
import { observer } from "mobx-react";
import { AddTilesContext, TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { isWaveRunnerContentModel } from "./models/wave-runner-content";
import { kTimelineTileType } from "../timeline/timeline-types";

import LoadDataIcon from "./assets/toolbar/load-data-icon.svg";
import RunIcon from "./assets/toolbar/run-icon.svg";
import RestartIcon from "./assets/toolbar/restart-icon.svg";
import ClearAndResetIcon from "./assets/toolbar/clear-and-reset-icon.svg";
import TimelineItIcon from "./assets/toolbar/timeline-it-icon.svg";

const LoadDataButton = observer(function LoadDataButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const content = tileModel?.content;
  if (!isWaveRunnerContentModel(content)) return null;
  const disabled = content.isLoading || content.hasData;
  return (
    <TileToolbarButton name={name} title="Load Data" onClick={() => content.loadData()} disabled={disabled}>
      <LoadDataIcon/>
    </TileToolbarButton>
  );
});

function PlayButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton name={name} title="Run Model" onClick={() => undefined} disabled={true}>
      <RunIcon/>
    </TileToolbarButton>
  );
}

function RestartButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton name={name} title="Restart Model" onClick={() => undefined} disabled={true}>
      <RestartIcon/>
    </TileToolbarButton>
  );
}

function ResetButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton name={name} title="Clear & Reset Model" onClick={() => undefined} disabled={true}>
      <ClearAndResetIcon/>
    </TileToolbarButton>
  );
}

const TimelineButton = observer(function TimelineButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const content = tileModel?.content;
  if (!isWaveRunnerContentModel(content)) return null;
  const disabled = !content.hasData;

  function handleClick() {
    if (!tileModel || !addTilesContext) return;
    const sharedSeismogram = content.sharedSeismogram;
    const sharedModels = sharedSeismogram ? [sharedSeismogram] : undefined;
    addTilesContext.addTileAfter(kTimelineTileType, tileModel, sharedModels);
  }

  return (
    <TileToolbarButton name={name} title="Timeline It!" onClick={handleClick} disabled={disabled}>
      <TimelineItIcon/>
    </TileToolbarButton>
  );
});

registerTileToolbarButtons("wave-runner",
[
  { name: "load-data", component: LoadDataButton },
  { name: "play", component: PlayButton },
  { name: "restart", component: RestartButton },
  { name: "reset", component: ResetButton },
  { name: "timeline", component: TimelineButton }
]);
```

**Step 2: Manual verification**

```bash
npm start
```

Navigate to a wave runner tile. Verify:
- Load Data is enabled initially, disabled while loading and after data is loaded
- Timeline It! is disabled until data is loaded, enabled after
- Pressing Timeline It! inserts a new timeline tile

**Step 3: Commit**

```bash
git add src/plugins/wave-runner/wave-runner-toolbar.tsx
git commit -m "feat: wire Load Data and Timeline It toolbar buttons"
```

---

### Task 6: Update StatusAndOutput to read from the shared model

Remove the auto-fetch `useEffect` and local React state. Observe the content model for loading state and seismogram data.

**Files:**
- Modify: `src/plugins/wave-runner/components/status-and-output.tsx`

**Background — accessing the content model:**

Use `isWaveRunnerContentModel` to check the content model type. If it doesn't match (e.g. in tests), render nothing or a fallback.

**Step 1: Rewrite the component**

```typescript
// src/plugins/wave-runner/components/status-and-output.tsx
import React, { useContext } from "react";
import { observer } from "mobx-react";
import { DateTime } from "luxon";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isWaveRunnerContentModel } from "../models/wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

interface WindowConfig {
  label: string;
  startTime: DateTime;
  durationSeconds: number;
}

const SEVEN_DAY_START = DateTime.fromISO("2026-01-30T00:00:00Z", { zone: "utc" });
const THREE_DAY_START = DateTime.fromISO("2026-02-03T00:00:00Z", { zone: "utc" });
const FILE_START      = DateTime.fromISO("2026-02-01T00:00:00Z", { zone: "utc" });
const NINE_AM         = DateTime.fromISO("2026-02-01T09:00:00Z", { zone: "utc" });
const NINE_25         = DateTime.fromISO("2026-02-01T09:25:00Z", { zone: "utc" });
const NINE_28         = DateTime.fromISO("2026-02-01T09:28:25Z", { zone: "utc" });

const WINDOW_CONFIGS: WindowConfig[] = [
  { label: "1 week",      startTime: SEVEN_DAY_START, durationSeconds: 7 * 86400 },
  { label: "3 days",      startTime: THREE_DAY_START, durationSeconds: 3 * 86400 },
  { label: "24 hours",    startTime: FILE_START,      durationSeconds: 86400     },
  { label: "6 hours",     startTime: NINE_AM,         durationSeconds: 21600     },
  { label: "1 hour",      startTime: NINE_AM,         durationSeconds: 3600      },
  { label: "15 minutes",  startTime: NINE_25,         durationSeconds: 900       },
  { label: "5 minutes",   startTime: NINE_25,         durationSeconds: 300       },
  { label: "1 minute",    startTime: NINE_28,         durationSeconds: 60        },
  { label: "30 seconds",  startTime: NINE_28,         durationSeconds: 30        },
  { label: "15 seconds",  startTime: NINE_28,         durationSeconds: 15        },
  { label: "5 seconds",   startTime: NINE_28,         durationSeconds: 5         },
];

export const StatusAndOutput: React.FC = observer(() => {
  const content = useContext(TileModelContext)?.content;
  const model = isWaveRunnerContentModel(content) ? content : undefined;
  const seismogram = model?.sharedSeismogram?.seismogram;

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className="waveform-container">
        {model?.isLoading && <div className="waveform-loading">Loading seismic data...</div>}
        {model?.loadError && <div className="waveform-error">{model.loadError}</div>}
        {seismogram && WINDOW_CONFIGS.map(config => (
          <WaveformPanel
            key={config.label}
            label={config.label}
            startTime={config.startTime}
            durationSeconds={config.durationSeconds}
            seismogram={seismogram}
          />
        ))}
      </div>
      <div className="download-status-container" />
      <div className="estimated-time">Estimated time to complete run:</div>
      <div className="status-counts-row">
        <div className="status-count">
          <label className="status-count-label">Events Identified</label>
          <div className="status-count-box" />
        </div>
        <div className="status-count">
          <label className="status-count-label">Event Categories</label>
          <div className="status-count-box" />
        </div>
      </div>
    </div>
  );
});
```

**Step 2: Manual verification**

With the dev server running, press Load Data. Waveforms should appear as before.

**Step 3: Commit**

```bash
git add src/plugins/wave-runner/components/status-and-output.tsx
git commit -m "feat: StatusAndOutput reads seismogram from SharedSeismogram"
```

---

### Task 7: Make the timeline tile read from SharedSeismogram

Add a `seismogram` view to `TimelineContentModel` that reads from the linked `SharedSeismogram`. Add `isTimelineContentModel` for type-safe access in the component.

**Files:**
- Modify: `src/plugins/timeline/models/timeline-content.ts`
- Modify: `src/plugins/timeline/models/timeline-content.test.ts`
- Modify: `src/plugins/timeline/components/timeline-tile.tsx`

**Step 1: Write failing tests for the content model**

```typescript
// src/plugins/timeline/models/timeline-content.test.ts
import { TimelineContentModel, isTimelineContentModel } from "./timeline-content";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";

describe("TimelineContentModel", () => {
  it("is always user resizable", () => {
    const content = TimelineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("isTimelineContentModel returns true for a timeline content model", () => {
    const content = TimelineContentModel.create();
    expect(isTimelineContentModel(content)).toBe(true);
  });

  it("isTimelineContentModel returns false for other models", () => {
    const other = SharedSeismogram.create();
    expect(isTimelineContentModel(other)).toBe(false);
  });

  it("returns seismogram from a linked SharedSeismogram", () => {
    const sharedSeismogram = SharedSeismogram.create();
    const fakeSeismogram = { numPoints: 42 } as any;
    sharedSeismogram.setSeismogram(fakeSeismogram);

    const mockSmm = {
      isReady: true,
      findFirstSharedModelByType: jest.fn().mockReturnValue(sharedSeismogram),
    };

    const content = TimelineContentModel.create({}, { sharedModelManager: mockSmm });
    expect(content.seismogram).toBe(fakeSeismogram);
  });

  it("returns undefined seismogram when no SharedSeismogram is linked", () => {
    const mockSmm = {
      isReady: true,
      findFirstSharedModelByType: jest.fn().mockReturnValue(undefined),
    };
    const content = TimelineContentModel.create({}, { sharedModelManager: mockSmm });
    expect(content.seismogram).toBeUndefined();
  });
});
```

**Step 2: Run to verify failure**

```bash
npm test -- src/plugins/timeline/models/timeline-content.test.ts
```
Expected: FAIL — `content.seismogram` is undefined, `isTimelineContentModel` is not exported

**Step 3: Update `timeline-content.ts`**

```typescript
// src/plugins/timeline/models/timeline-content.ts
import { getType, types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { kTimelineTileType } from "../timeline-types";

export function defaultTimelineContent(): TimelineContentModelType {
  return TimelineContentModel.create();
}

export const TimelineContentModel = TileContentModel
  .named("TimelineTool")
  .props({
    type: types.optional(types.literal(kTimelineTileType), kTimelineTileType),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram() {
      const smm = getSharedModelManager(self);
      // findFirstSharedModelByType infers SharedSeismogramType — no cast needed
      return smm?.findFirstSharedModelByType(SharedSeismogram);
    },
    get seismogram() {
      return this.sharedSeismogram?.seismogram;
    }
  }));

export interface TimelineContentModelType extends Instance<typeof TimelineContentModel> {}

export function isTimelineContentModel(model: unknown): model is TimelineContentModelType {
  return !!model && getType(model as object) === TimelineContentModel;
}
```

**Step 4: Run tests**

```bash
npm test -- src/plugins/timeline/models/timeline-content.test.ts
```
Expected: PASS

**Step 5: Update `timeline-tile.tsx` to render the waveform**

The seismogram's full time range comes from the seisplotjs `Seismogram` API:
- `seismogram.startTime` — a Luxon `DateTime`
- `seismogram.endTime.diff(seismogram.startTime, "seconds").seconds` — duration in seconds

```typescript
// src/plugins/timeline/components/timeline-tile.tsx
import { observer } from "mobx-react";
import React, { useContext } from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { isTimelineContentModel } from "../models/timeline-content";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(({ readOnly, tileElt }) => {
  const content = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(content) ? content : undefined;
  const seismogram = model?.seismogram;

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="timeline-container">
        <div className="event-row">
          <button disabled={true}>Prev</button>
          <button disabled={true}>Next</button>
          <div className="event-label">Event</div>
        </div>
        <Timeline />
        <TimelineKey />
        {seismogram && (
          <WaveformPanel
            label="Full waveform"
            startTime={seismogram.startTime}
            durationSeconds={seismogram.endTime.diff(seismogram.startTime, "seconds").seconds}
            seismogram={seismogram}
          />
        )}
      </div>
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
```

**Step 6: Manual end-to-end verification**

```bash
npm start
```

1. Open a document with a wave runner tile
2. Press Load Data — waveforms appear in Status and Output
3. Press Timeline It! — a new timeline tile appears
4. The timeline tile shows the full waveform visualization

**Step 7: Run all related tests**

```bash
npm test -- src/plugins/timeline src/plugins/wave-runner src/plugins/shared-seismogram
```
Expected: All pass

**Step 8: Commit**

```bash
git add src/plugins/timeline/models/timeline-content.ts src/plugins/timeline/models/timeline-content.test.ts src/plugins/timeline/components/timeline-tile.tsx
git commit -m "feat: timeline tile renders seismogram from SharedSeismogram"
```

---

## Final Verification

```bash
# All tests
npm test

# TypeScript
npm run check:types

# Lint
npm run lint
```

Fix any issues before considering implementation complete.
