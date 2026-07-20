# Seismic Admin Event Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the seismic event database into the admin interface: per-station × per-model coverage visualization with event counts, model selection, and an Update button that downloads missing raw data and generates events for uncovered ranges — per the approved design [2026-07-19-seismic-admin-coverage-design.md](2026-07-19-seismic-admin-coverage-design.md).

**Architecture:** Seismic services move to `src/models/stores/seismic/`. The span/download/run/persist loop is extracted from Wave Runner's `runModel` into a shared `seismic-coverage-processor.ts`; Wave Runner becomes a thin MST wrapper and the admin's Update button drives the same processor. Model-metadata fetching is extracted to `shared/seismic/model-metadata.ts`. The admin bootstraps Firebase with anonymous auth (step-1 Decision), loads a model list from unit config, and renders three-state (covered/partial/uncovered) day bars from `getUncoveredRanges` gaps.

**Tech Stack:** TypeScript 4.9, Firebase 8 (namespaced), MobX (plain store), React 17, Jest.

**Branch:** current branch `clue-465-events-library`.

**Conventions (mandatory, same as step 1):**
- Jest: ALWAYS `--no-watchman` (`npm test -- --no-watchman <path>`).
- Strict TDD for new logic: failing test → observe fail → implement → observe pass → eslint (default AND `-c .eslintrc.build.js`) → `npm run check:types` → commit. Mechanical moves/refactors are verified by the existing suites instead.
- Commit style: plain sentence + blank line + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `classnames` helper for any conditional JSX classes (CLAUDE.md).
- The design doc is the spec; flag conflicts, don't silently pick.
- `StationConfig extends StationData`, so a `StationConfig` can be passed wherever `StationData` is needed (the extra `label` is ignored) — no conversion helpers.
- Code blocks in this plan are the reference implementation. Where they touch existing files, reconcile against the live file (line numbers drift); where they are new files, transcribe.

---

### Task 1: Move seismic services to `src/models/stores/seismic/`

Mechanical move, no behavior change.

**Steps:**
1. `git mv` from `src/models/stores/` into `src/models/stores/seismic/` (create the dir): `seismic-download-service.ts`, `seismic-download-service.test.ts`, `seismic-download-worker-runner.ts`, `seismic-query-service.ts`, `seismic-query-service.test.ts`, `seismic-event-service.ts`, `seismic-event-service.test.ts`.
2. Fix imports:
   - Inside the moved files: paths to `shared/` and to non-seismic `src/` modules gain one `../`; sibling imports (`./seismic-download-worker-runner`, including the lazy `import(...)` inside `seismic-download-service.ts`) stay relative and unchanged.
   - Known importers: `src/models/stores/stores.ts` (SeismicQueryService), `src/plugins/wave-runner/models/wave-runner-content.ts` (download + event services), `src/plugins/wave-runner/models/wave-runner-content.test.ts` (**including the `jest.mock("../../../models/stores/seismic-event-service", ...)` path string** → `../../../models/stores/seismic/seismic-event-service`), `src/seismic-admin/seismic-admin-store.ts` (download service).
   - Sweep: `grep -rn "stores/seismic-" src shared cypress` must return nothing.
3. **Acceptance:** `npm test -- --no-watchman src/models/stores/seismic src/plugins/wave-runner src/seismic-admin` all green (11 + 38 + existing admin tests); `npm run check:types` clean; eslint clean on every touched file; `git status` shows renames (R), not delete+add pairs.
4. Commit: "Move seismic services into src/models/stores/seismic/."

---

### Task 2: Extract model-metadata fetching to `shared/seismic/model-metadata.ts`

**Files:** Create `shared/seismic/model-metadata.ts` + `model-metadata.test.ts`; modify `src/plugins/wave-runner/models/wave-runner-content.ts`, `src/plugins/wave-runner/components/data-setup.tsx`, `shared/seismic/run-model-cli.ts`, and the wave-runner test if it imports the moved symbols.

**NO re-exports**: `wave-runner-content.ts` must not re-export the moved symbols. Every importer switches to the new module:
- `data-setup.tsx:6` currently does `import { ModelListEntry } from "../models/wave-runner-content"` → `import { ModelListEntry } from "../../../../shared/seismic/model-metadata"` (verify depth).
- `run-model-cli.ts` has its **own local duplicate** `PLACEHOLDER_METADATA` (~line 24) — delete it and import the shared one (also `PLACEHOLDER_MODEL_URL` if it hardcodes the string; check).
- `wave-runner-content.test.ts`: update any imports of the moved symbols.
- Sweep: `grep -rn "ModelListEntry\|PLACEHOLDER_MODEL_URL\|PLACEHOLDER_METADATA\|SUPPORTED_SCHEMA" src shared` — every hit must import from `shared/seismic/model-metadata` (or be the definition).

**New module** (moved verbatim from wave-runner-content.ts lines ~23–42 plus the fetch logic of `ensureModelMetadata` ~lines 204–228):

```typescript
// shared/seismic/model-metadata.ts
import { ModelMetadata } from "./seismic-model-types";

export const SUPPORTED_SCHEMA = "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json";

export const PLACEHOLDER_MODEL_URL = "placeholder:random-weights";

export const PLACEHOLDER_METADATA: ModelMetadata = {
  $schema: SUPPORTED_SCHEMA,
  id: "placeholder-v1",
  architecture: "placeholder",
  class_names: ["Noise", "Earthquake"],
  sampling_rate: 100,
  window_duration: 60,
  instrument_types: ["H", "N", "L"],
  weightsUrl: "",
};

// The model list is configured per-unit under settings["wave-runner"].models.
export interface ModelListEntry {
  label: string;
  metadataUrl: string;
}

/**
 * Fetch and validate model metadata; resolves weightsUrl relative to metadataUrl.
 * PLACEHOLDER_MODEL_URL short-circuits to a fresh copy of PLACEHOLDER_METADATA.
 * Throws on fetch failure or unsupported $schema.
 */
export async function fetchModelMetadata(metadataUrl: string): Promise<ModelMetadata> {
  if (metadataUrl === PLACEHOLDER_MODEL_URL) {
    return { ...PLACEHOLDER_METADATA };
  }

  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch model metadata: ${response.status}`);
  }
  const metadata: ModelMetadata = await response.json();
  if (metadata.$schema !== SUPPORTED_SCHEMA) {
    throw new Error(
      `Unsupported model schema: "${metadata.$schema}". This version of CLUE supports "${SUPPORTED_SCHEMA}".`
    );
  }
  // Resolve weightsUrl relative to the metadata URL
  metadata.weightsUrl = new URL(metadata.weightsUrl, metadataUrl).href;
  return metadata;
}
```

`ensureModelMetadata` in wave-runner-content becomes a thin wrapper: keep the MST state handling (`selectedModelUrl`/`selectedModelMetadata`/`modelLoadError`/`clearEventsDataSet`), replace the fetch/validate/placeholder body with `self.selectedModelMetadata = yield fetchModelMetadata(metadataUrl)` inside the existing try/catch.

**TDD — write `model-metadata.test.ts` first** (stub `global.fetch` with `jest.spyOn(global, "fetch")` or assignment; restore in `afterEach`):

```typescript
import { fetchModelMetadata, PLACEHOLDER_METADATA, PLACEHOLDER_MODEL_URL, SUPPORTED_SCHEMA }
  from "./model-metadata";

const validMetadata = () => ({
  $schema: SUPPORTED_SCHEMA, id: "test-v1", architecture: "compact",
  class_names: ["Noise", "Earthquake"], sampling_rate: 100, window_duration: 60,
  instrument_types: ["H"], weightsUrl: "weights.json",
});

describe("fetchModelMetadata", () => {
  const mockFetch = jest.fn();
  beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; });

  it("fetches, validates, and resolves weightsUrl relative to the metadata URL", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => validMetadata() });
    const metadata = await fetchModelMetadata("https://models.example.com/compact/metadata.json");
    expect(mockFetch).toHaveBeenCalledWith("https://models.example.com/compact/metadata.json");
    expect(metadata.weightsUrl).toBe("https://models.example.com/compact/weights.json");
  });

  it("short-circuits the placeholder URL without fetching, returning a fresh copy", async () => {
    const a = await fetchModelMetadata(PLACEHOLDER_MODEL_URL);
    const b = await fetchModelMetadata(PLACEHOLDER_MODEL_URL);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(a).toEqual(PLACEHOLDER_METADATA);
    expect(a).not.toBe(b);
  });

  it("throws on a non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchModelMetadata("https://x/metadata.json")).rejects.toThrow("404");
  });

  it("throws on an unsupported schema, naming it", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...validMetadata(), $schema: "bogus" }) });
    await expect(fetchModelMetadata("https://x/metadata.json")).rejects.toThrow('"bogus"');
  });
});
```

**Acceptance:** new tests pass; wave-runner suite (38) green; the grep sweep is clean; check:types + eslint clean.

Commit: "Extract model metadata fetching into shared/seismic."

---

### Task 3: Extract the coverage processor

**Files:** Create `src/models/stores/seismic/seismic-coverage-processor.ts` + `.test.ts` + `seismic-coverage-test-fakes.ts`; modify `wave-runner-content.ts` + `.test.ts`.

**Processor API:**

```typescript
export const DETECTION_THRESHOLD = 0.7;

export interface ProcessCoverageOptions {
  stationData: StationData;
  metadata: ModelMetadata;
  range: TimeRange;                       // Unix seconds; caller guarantees day-aligned
  /** Pre-resolved uncovered ranges. When absent the processor calls getUncoveredRanges
   *  itself and lets failures propagate (admin path). Wave Runner passes its
   *  fallback-resolved ranges here. */
  uncovered?: TimeRange[];
  onEvents?: (events: SeismicEvent[]) => void;
  onProgress?: (progress: number, total: number) => void;
  /** Test seams; production defaults construct real ones. */
  downloadService?: SeismicDownloadService;
  createRunner?: () => SeismicModelRunner;
}

/** Runs the model over the uncovered parts of range, persisting events + coverage
 *  per day (writeEvents before markCovered; empty days covered, errored days not).
 *  Owns the runner lifecycle (loadModel/dispose). Returns day counts. */
export async function processUncoveredRanges(options: ProcessCoverageOptions):
  Promise<{ processed: number; skipped: number; total: number }>
```

**Body: verbatim relocation** of `runModel`'s loop from `wave-runner-content.ts` (currently lines ~279–350 — reconcile against the live file). Function-by-function move list:
- `saveDayResults` (lines ~48–61) moves here unchanged, including its doc comment.
- The loop: `uncovered ?? await getUncoveredRanges(stationData, metadata.id, range)` → `uncoveredDaySpans` → `totalDays` → per-span `ensureRange` with `endSec: span.endDay * SECONDS_PER_DAY` (**keep the inclusive-convention comment**) → drain to `DONE` → `readDay` → miniSEED parse → `runner.processChunk(seismogram, { onProgress: () => {}, onEvents: collect + forward to options.onEvents }, DETECTION_THRESHOLD)` → `saveDayResults` → per-span empty-days loop → **keep the `updateProgress`-before-`skippedDays`-fold ordering and its comment** (prevents double-counting across ensureRange resets). Progress forwards through `options.onProgress`.
- Runner lifecycle: `const runner = (options.createRunner ?? (() => new SeismicModelRunner()))(); await runner.loadModel(metadata); try { ...loop... } finally { runner.dispose(); }`.
- Download service: `options.downloadService ?? new SeismicDownloadService()`.
- Return `{ processed, skipped: skippedDays, total: totalDays }`.

**Wave Runner refactor:** `runModel` keeps: validation, metadata resolution, `rangeSec` (endDate-inclusive comment), prior-events + offline fallback (resolving `uncovered`, warning on failure), then:

```typescript
yield processUncoveredRanges({
  stationData: station, metadata, range: rangeSec, uncovered,
  onEvents: events => self.addDetectedEvents(events),
  onProgress: (progress, total) => self.updateChunkProgress(progress, total),
});
```

then dataset population and the existing catch/finally (runner disposal moves OUT of wave-runner's finally — the processor owns it now). Delete the moved code (`saveDayResults`, the loop, the direct `SeismicModelRunner`/`markCovered`/`writeEvents`/`uncoveredDaySpans`/`DONE`/miniseed imports that become unused). `getUncoveredRanges`/`loadEvents` imports remain (fallback + prior events).

**Test fakes** (`seismic-coverage-test-fakes.ts`): relocate the fake download service (per-`ensureRange` cursor reset, inclusive `d * SECONDS_PER_DAY <= endSec` filtering, emptyDays/erroredDays), fake runner, and the event-service mock **factory** from `wave-runner-content.test.ts`. Each test file keeps its own `jest.mock("../../../models/stores/seismic/seismic-event-service", () => require("./...path...").makeEventServiceMock())`-style call (jest requires the mock call per file; only the factory is shared — get the hoisting right: `jest.mock` factories may not reference out-of-scope variables unless prefixed `mock`, so export plain functions and call them inside the factory via `jest.requireActual` on the fakes module).

**TDD — processor tests first** (failing: module doesn't exist), using the fakes:
- passes exact `startSec`/`endSec` to ensureRange per span (single + multi-span, inclusive convention);
- per processed day: writeEvents called before markCovered (spy call-order assertion), markCovered with `dayRange(day)` seconds;
- empty day → markCovered with no writeEvents; errored day → neither;
- `uncovered` provided → getUncoveredRanges never called;
- `uncovered` absent → getUncoveredRanges called; its rejection REJECTS the processor (admin semantics);
- onProgress reaches `(total, total)` at completion; return value `{processed, skipped, total}` matches the scenario;
- runner.dispose called on success AND when processChunk throws (and the error propagates).

Then the refactor. **Acceptance:** processor tests green; **all 38 wave-runner tests green with behavior assertions unchanged** (mocks may be re-plumbed through the shared fakes, assertions must not weaken); check:types + eslint clean; `grep -n "saveDayResults\|SeismicModelRunner" src/plugins/wave-runner/models/wave-runner-content.ts` → no hits.

Commit: "Extract seismic coverage processor from Wave Runner."

---

### Task 4: Day-classification helper (pure)

**Files:** Modify `shared/seismic/event-database.ts` + `event-database.test.ts`.

**Step 1 — failing tests** (append; `range` helper per existing test style; note `COVERAGE_EPOCH` is midnight UTC so day-aligned):

```typescript
import { classifyDayCoverage } from "./event-database";

describe("classifyDayCoverage", () => {
  const day0 = COVERAGE_EPOCH;
  const dayIdx = day0 / SECONDS_PER_DAY;
  const threeDays: TimeRange = { start: day0, end: day0 + 3 * SECONDS_PER_DAY };

  it("classifies all days covered when there are no gaps", () => {
    expect(classifyDayCoverage([], threeDays)).toEqual(new Map([
      [dayIdx, "covered"], [dayIdx + 1, "covered"], [dayIdx + 2, "covered"],
    ]));
  });

  it("classifies all days uncovered when one gap spans the range", () => {
    expect(classifyDayCoverage([threeDays], threeDays)).toEqual(new Map([
      [dayIdx, "uncovered"], [dayIdx + 1, "uncovered"], [dayIdx + 2, "uncovered"],
    ]));
  });

  it("classifies a day with a sub-day gap as partial", () => {
    const gaps: TimeRange[] = [{ start: day0 + 600, end: day0 + 1200 }];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "partial"], [dayIdx + 1, "covered"], [dayIdx + 2, "covered"],
    ]));
  });

  it("classifies a whole-day gap as uncovered", () => {
    const gaps: TimeRange[] = [{ start: day0 + SECONDS_PER_DAY, end: day0 + 2 * SECONDS_PER_DAY }];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "covered"], [dayIdx + 1, "uncovered"], [dayIdx + 2, "covered"],
    ]));
  });

  it("classifies a gap straddling a day boundary as partial on both days", () => {
    const gaps: TimeRange[] = [
      { start: day0 + SECONDS_PER_DAY - 600, end: day0 + SECONDS_PER_DAY + 600 },
    ];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "partial"], [dayIdx + 1, "partial"], [dayIdx + 2, "covered"],
    ]));
  });

  it("marks a day uncovered when a longer gap fully spans it and partial where it doesn't", () => {
    const gaps: TimeRange[] = [{ start: day0 + 600, end: day0 + 2 * SECONDS_PER_DAY }];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "partial"], [dayIdx + 1, "uncovered"], [dayIdx + 2, "covered"],
    ]));
  });
});
```

**Step 3 — implementation** (append; consolidate imports):

```typescript
export type DayCoverageState = "covered" | "partial" | "uncovered";

/**
 * Classify each UTC day index in [dayIndex(range.start), dayIndex(range.end - 1)]
 * against uncovered gaps (as returned by findUncoveredRanges): "uncovered" when a
 * gap fully spans the day, "covered" when no gap intersects it, else "partial".
 * Two gaps can never jointly span one day — findUncoveredRanges returns maximal
 * gaps separated by covered windows — so per-gap classification is sufficient.
 */
export function classifyDayCoverage(gaps: TimeRange[], range: TimeRange): Map<number, DayCoverageState> {
  const states = new Map<number, DayCoverageState>();
  for (let day = dayIndex(range.start); day <= dayIndex(range.end - 1); day++) {
    states.set(day, "covered");
  }
  for (const gap of gaps) {
    const start = Math.max(gap.start, range.start);
    const end = Math.min(gap.end, range.end);
    if (end <= start) continue;
    for (let day = dayIndex(start); day <= dayIndex(end - 1); day++) {
      const dayStart = day * SECONDS_PER_DAY;
      const wholeDay = start <= dayStart && end >= dayStart + SECONDS_PER_DAY;
      states.set(day, wholeDay ? "uncovered" : "partial");
    }
  }
  return states;
}
```

(`SECONDS_PER_DAY` is already imported in this module from Task 1 of step 1's follow-ups; verify.)

**Acceptance:** suite green (existing + 6 new); eslint + check:types.

Commit: "Add day coverage classification to seismic event database."

---

### Task 5: Admin Firebase bootstrap

**Files:** Create `src/seismic-admin/utils/admin-firebase.ts` + `.test.ts`; modify `src/seismic-admin/components/app.tsx`, `src/seismic-admin/seismic-admin-store.ts` (+ its test).

**Step 1 — failing tests:**

```typescript
// src/seismic-admin/utils/admin-firebase.test.ts
const mockSignInAnonymously = jest.fn();
jest.mock("firebase/app", () => ({
  auth: () => ({ signInAnonymously: mockSignInAnonymously }),
}));
const mockInitializeApp = jest.fn();
jest.mock("../../lib/firebase-config", () => ({
  initializeApp: () => mockInitializeApp(),
}));

import { initAdminFirebase } from "./admin-firebase";

describe("initAdminFirebase", () => {
  beforeEach(() => { mockInitializeApp.mockClear(); mockSignInAnonymously.mockReset(); });

  it("initializes the app and signs in anonymously", async () => {
    mockSignInAnonymously.mockResolvedValue({});
    await initAdminFirebase();
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("propagates sign-in failure", async () => {
    mockSignInAnonymously.mockRejectedValue(new Error("offline"));
    await expect(initAdminFirebase()).rejects.toThrow("offline");
  });
});
```

Store test (append to `seismic-admin-store.test.ts`, following its existing construction pattern):

```typescript
it("authReady defaults false and is set by setAuthReady", () => {
  const store = new SeismicAdminStore({ cache: fakeCache() /* per existing helpers */ });
  expect(store.authReady).toBe(false);
  store.setAuthReady();
  expect(store.authReady).toBe(true);
});
```

**Step 3 — implementation:**

```typescript
// src/seismic-admin/utils/admin-firebase.ts
import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import { initializeApp } from "../../lib/firebase-config";

/**
 * Initialize Firebase (shared config; firebaseEnv/firestore/auth emulator URL
 * params come along) and sign in anonymously. Resolves when auth is ready.
 * Anonymous users may read and contribute to the event database — see the
 * Decision in docs/seismic/event-database-design.md.
 */
export async function initAdminFirebase(): Promise<void> {
  initializeApp();
  await firebase.auth().signInAnonymously();
}
```

Store: add `authReady = false;` to the fields and

```typescript
setAuthReady() {
  this.authReady = true;
}
```

`app.tsx`: start auth in parallel with the catalog load; never block store creation on it:

```typescript
useEffect(() => {
  let cancelled = false;
  const authPromise = initAdminFirebase();
  void loadCatalog().then(catalog => {
    if (cancelled) return;
    const created = new SeismicAdminStore({ catalog });
    setStore(created);
    void created.refresh();
    authPromise
      .then(() => { if (!cancelled) created.setAuthReady(); })
      .catch(err => {
        console.warn("Seismic admin Firebase sign-in failed:", err);
        if (!cancelled) created.setFeedback("Event database unavailable (sign-in failed).");
      });
  });
  return () => { cancelled = true; };
}, []);
```

**Acceptance:** new tests green; admin suite green; check:types + eslint. (No app.tsx test — its existing coverage level is none; the store/util tests carry this task.)

Commit: "Add anonymous Firebase auth to the seismic admin page."

---

### Task 6: Model catalog + selection state

**Files:** Modify `src/seismic-admin/utils/load-catalog.ts` (+ `.test.ts`), `src/seismic-admin/utils/admin-persistence.ts` (+ `.test.ts`), `src/seismic-admin/seismic-admin-store.ts` (+ `.test.ts`), `src/seismic-admin/components/app.tsx`.

**Step 1 — failing tests.** load-catalog (follow the existing test file's mocking of `getUnitJson`/urlParams):

```typescript
it("modelsFromUnitConfig reads settings['wave-runner'].models from either settings location", () => {
  const models = [{ label: "Compact", metadataUrl: "https://x/m.json" }];
  expect(modelsFromUnitConfig({ config: { settings: { "wave-runner": { models } } } })).toEqual(models);
  expect(modelsFromUnitConfig({ settings: { "wave-runner": { models } } })).toEqual(models);
  expect(modelsFromUnitConfig({ config: { settings: {} } })).toBeUndefined();
  expect(modelsFromUnitConfig({ config: { settings: { "wave-runner": { models: "bogus" } } } })).toBeUndefined();
});

it("loadCatalog returns stations and models, degrading each independently to the base", async () => {
  // unit JSON with models but no stations → base stations, unit models (and vice versa)
});
```

admin-persistence: extend the round-trip test with `selectedModels: ["https://x/m.json"]` and a malformed-value case (non-string-array → undefined).

Store (extend existing suite; construct with `models` in deps):

```typescript
const twoModels = [
  { label: "Compact", metadataUrl: "https://x/compact.json" },
  { label: "Large", metadataUrl: "https://x/large.json" },
];

it("selects all models by default and toggles/persists selection", ...);
it("restores a saved model selection, pruning unknown urls, without re-selecting all", ...);
it("ensureModelMetadata fetches once per url, caches, and records errors", async () => {
  const fetchMetadata = jest.fn().mockResolvedValueOnce({ id: "compact-v1", ... });
  const store = new SeismicAdminStore({ ..., models: twoModels, fetchMetadata });
  await store.ensureModelMetadata(twoModels[0].metadataUrl);
  await store.ensureModelMetadata(twoModels[0].metadataUrl);
  expect(fetchMetadata).toHaveBeenCalledTimes(1);
  fetchMetadata.mockRejectedValueOnce(new Error("nope"));
  expect(await store.ensureModelMetadata(twoModels[1].metadataUrl)).toBeUndefined();
  expect(await store.ensureModelMetadata(twoModels[1].metadataUrl)).toBeUndefined(); // cached error, 2 calls total
  expect(fetchMetadata).toHaveBeenCalledTimes(2);
});
```

**Step 3 — implementation.**

load-catalog: add `modelsFromUnitConfig` (mirror of `stationsFromUnitConfig`), change the return shape:

```typescript
export interface AdminCatalog {
  stations: StationConfig[];
  models: ModelListEntry[];
}

export function modelsFromUnitConfig(unitJson: any): ModelListEntry[] | undefined {
  const settings = unitJson?.config?.settings ?? unitJson?.settings;
  const models = settings?.["wave-runner"]?.models;
  return Array.isArray(models) ? models as ModelListEntry[] : undefined;
}

export function defaultCatalog(): AdminCatalog {
  return {
    stations: stationsFromUnitConfig(appConfig) ?? [],
    models: modelsFromUnitConfig(appConfig) ?? [],
  };
}

export async function loadCatalog(): Promise<AdminCatalog> {
  const base = defaultCatalog();
  try {
    if (!urlParams.unit) return base;
    const curriculumConfig = CurriculumConfig.create(curriculumConfigJson, { urlParams });
    const unitJson = await getUnitJson(urlParams.unit, curriculumConfig);
    return {
      stations: stationsFromUnitConfig(unitJson) ?? base.stations,
      models: modelsFromUnitConfig(unitJson) ?? base.models,
    };
  } catch {
    return base;
  }
}
```

(Keep the existing doc comments, adjusted.) `app.tsx`: `loadCatalog().then(({ stations, models }) => { const created = new SeismicAdminStore({ catalog: stations, models }); ... })`.

admin-persistence: `AdminFilters` gains `selectedModels?: string[]`; `loadFilters` validates with the existing `isStringArray`; `saveFilters` passes it through.

Store:

```typescript
// deps additions
export interface SeismicAdminDeps {
  cache?: AdminCache;
  catalog?: StationConfig[];
  models?: ModelListEntry[];
  fetchMetadata?: (metadataUrl: string) => Promise<ModelMetadata>;
  downloadStation?: ...;  // unchanged
}

// fields
models = new Map<string, ModelListEntry>();       // keyed by metadataUrl
selectedModels = new Set<string>();               // same keys; persisted
modelMetadata = new Map<string, ModelMetadata | "error">();
private hasSavedModelSelection = false;

// constructor, after the existing filter restore:
(deps.models ?? []).forEach(m => this.models.set(m.metadataUrl, m));
if (saved.selectedModels) {
  this.selectedModels = new Set(saved.selectedModels.filter(url => this.models.has(url)));
  this.hasSavedModelSelection = true;
} else {
  for (const url of this.models.keys()) this.selectedModels.add(url);
}
// modelMetadata cache is not persisted or observable-relevant beyond reads; keep it observable (default).

// save() gains selectedModels: [...this.selectedModels]

toggleModel(url: string) {
  if (this.selectedModels.has(url)) {
    this.selectedModels.delete(url);
  } else {
    this.selectedModels.add(url);
  }
  this.hasSavedModelSelection = true;
  this.save();
  // Task 8 appends: void this.loadAllCoverageStats();
}

get selectedModelList(): ModelListEntry[] {
  const list: ModelListEntry[] = [];
  this.selectedModels.forEach(url => {
    const model = this.models.get(url);
    if (model) list.push(model);
  });
  return list;
}

/** Resolve (and cache) a model's metadata; undefined when it failed to load. */
async ensureModelMetadata(url: string): Promise<ModelMetadata | undefined> {
  const cached = this.modelMetadata.get(url);
  if (cached === "error") return undefined;
  if (cached) return cached;
  try {
    const fetcher = this.deps.fetchMetadata ?? fetchModelMetadata;
    const metadata = await fetcher(url);
    runInAction(() => this.modelMetadata.set(url, metadata));
    return metadata;
  } catch (err) {
    console.warn("Failed to load model metadata:", url, err);
    runInAction(() => this.modelMetadata.set(url, "error"));
    return undefined;
  }
}
```

**Acceptance:** all three test files green (plus existing suites); check:types + eslint.

Commit: "Add model catalog and selection to seismic admin store."

---

### Task 7: Model selection UI

**Files:** Modify `src/seismic-admin/components/admin-header.tsx` (+ `.scss` if needed, + `.test.tsx`).

A "Models" option-area after "Stations", mirroring the station block:

```tsx
<div className="option-area">
  <div className="option-header">Models</div>
  <div className="models">
    {[...store.models].map(([url, model]) => (
      <label className="model-checkbox" key={url}>
        <input
          type="checkbox"
          checked={store.selectedModels.has(url)}
          onChange={() => store.toggleModel(url)}
        />
        {model.label}
      </label>
    ))}
  </div>
</div>
```

Note: NO disabled-when-last-checked rule (unlike stations) — zero selected models is legal and simply disables Update. Style `.models`/`.model-checkbox` in the existing scss alongside `.stations`.

**TDD (component test, following admin-header.test.tsx's existing render/store-context pattern):** renders a checkbox per model with the label text; checked reflects `selectedModels`; clicking calls `toggleModel` with the url; unchecking the last model is NOT disabled.

**Acceptance:** header tests green; eslint (classnames rule!) + check:types.

Commit: "Add model selection to seismic admin header."

---

### Task 8: Coverage stats in the store

**Files:** Modify `seismic-admin-store.ts` (+ `.test.ts`).

**Step 1 — failing tests** (all with an injected `eventService` + `fetchMetadata`; follow the suite's fake-deps pattern):

```typescript
const eventService = {
  getUncoveredRanges: jest.fn(async () => [] as TimeRange[]),
  loadEvents: jest.fn(async () => [] as SeismicEvent[]),
};
// station fixture with a known key; metadata { id: "compact-v1", ... }

it("loadCoverageStats stores loaded dayStates and eventCount under stationKey|modelUrl", ...);
it("passes the endDate-inclusive range to the event service", async () => {
  // startDate "2026-01-01", endDate "2026-01-03" →
  // expect getUncoveredRanges called with { start: utc(2026-01-01), end: utc(2026-01-04) }
});
it("records an error state when the event service rejects", ...);
it("records an error state when metadata fails to load", ...);
it("does nothing before authReady", ...);
it("setAuthReady triggers a coverage load for selected station × model pairs", ...);
it("coverageFor returns pending for unknown keys", ...);

describe("isFullyCovered", () => {
  it("is true when every selected pair is loaded with all days covered", ...);
  it("is false when any pair is partial, pending, or error", ...);
  it("is false when no models are selected", ...);
  it("scopes to one station when a key is given", ...);
});

it("modelAggregate sums event counts and covered days across selected stations", ...);
```

**Step 3 — implementation:**

```typescript
export type CoverageLoadState = "pending" | "loaded" | "error";

export interface CoverageStats {
  state: CoverageLoadState;
  dayStates?: Map<number, DayCoverageState>;
  eventCount?: number;
}

export function coverageKey(stationKey: string, modelUrl: string) {
  return `${stationKey}|${modelUrl}`;
}

// deps addition
eventService?: {
  getUncoveredRanges: (s: StationData, model: string, range: TimeRange) => Promise<TimeRange[]>;
  loadEvents: (s: StationData, model: string, range: TimeRange) => Promise<SeismicEvent[]>;
};

// field
coverage = new Map<string, CoverageStats>();

/** endDate is inclusive: the range extends through the end of that UTC day (matches Wave Runner). */
private get rangeSec(): TimeRange | undefined {
  const { firstSec, lastSec } = this;
  if (firstSec === undefined || lastSec === undefined) return;
  return { start: firstSec, end: lastSec + SECONDS_PER_DAY };
}

async loadCoverageStats(station: StationConfig, modelUrl: string) {
  const key = coverageKey(getStationChannelPrefix(station), modelUrl);
  const range = this.rangeSec;
  if (!this.authReady || !range) return;
  runInAction(() => this.coverage.set(key, { state: "pending" }));

  const metadata = await this.ensureModelMetadata(modelUrl);
  if (!metadata) {
    runInAction(() => this.coverage.set(key, { state: "error" }));
    return;
  }
  try {
    const svc = this.deps.eventService ?? { getUncoveredRanges, loadEvents };
    const gaps = await svc.getUncoveredRanges(station, metadata.id, range);
    const events = await svc.loadEvents(station, metadata.id, range);
    runInAction(() => this.coverage.set(key, {
      state: "loaded",
      dayStates: classifyDayCoverage(gaps, range),
      eventCount: events.length,
    }));
  } catch (err) {
    console.warn("Failed to load coverage stats:", err);
    runInAction(() => this.coverage.set(key, { state: "error" }));
  }
}

/** Sequential on purpose: avoids a request stampede across stations × models. */
async loadAllCoverageStats() {
  for (const station of this.selectedStations) {
    for (const url of this.selectedModels) {
      await this.loadCoverageStats(station, url);
    }
  }
}

coverageFor(stationKey: string, modelUrl: string): CoverageStats {
  return this.coverage.get(coverageKey(stationKey, modelUrl)) ?? { state: "pending" };
}

private pairFullyCovered(stats: CoverageStats | undefined): boolean {
  return stats?.state === "loaded" && !!stats.dayStates &&
    [...stats.dayStates.values()].every(s => s === "covered");
}

/** Pending or errored stats are NOT fully covered — unknown ≠ covered. */
isFullyCovered(stationKey?: string): boolean {
  if (this.selectedModels.size === 0) return false;
  const stationKeys = stationKey ? [stationKey] : [...this.selected];
  if (stationKeys.length === 0) return false;
  return stationKeys.every(sk =>
    [...this.selectedModels].every(url => this.pairFullyCovered(this.coverage.get(coverageKey(sk, url)))));
}

modelAggregate(modelUrl: string): { eventCount: number; coveredDays: number; totalDays: number } {
  let eventCount = 0;
  let coveredDays = 0;
  let totalDays = 0;
  const { firstDay, lastDay } = this;
  const rangeDays = firstDay !== undefined && lastDay !== undefined ? lastDay - firstDay + 1 : 0;
  this.selected.forEach(sk => {
    totalDays += rangeDays;
    const stats = this.coverage.get(coverageKey(sk, modelUrl));
    if (stats?.state !== "loaded") return;
    eventCount += stats.eventCount ?? 0;
    stats.dayStates?.forEach(state => { if (state === "covered") coveredDays++; });
  });
  return { eventCount, coveredDays, totalDays };
}
```

Reload triggers (append to existing actions — keep them fire-and-forget `void` calls):
- `setRange(...)` → after `loadAllStats()`, `void this.loadAllCoverageStats();`
- `toggle(key)` (station) and `toggleModel(url)` → `void this.loadAllCoverageStats();`
- `setAuthReady()` → `void this.loadAllCoverageStats();`
- `refresh()` → after `loadAllStats()`, `await this.loadAllCoverageStats();`

**Acceptance:** store suite green; check:types + eslint.

Commit: "Load event coverage stats in seismic admin store."

---

### Task 9: Coverage rows UI

**Files:** Modify `raw-timeline.tsx` (+ `.scss`, + `.test.tsx`), `seismic-admin-utils.ts` (+ `.test.ts`), `station-section.tsx` (+ `.scss`, + `.test.tsx`).

**Timeline extension.** `RawTimeline` gains optional `partialDays?: Set<number>`; segments become runs of equal state. Extend the pure helper first (in seismic-admin-utils, next to `coverageSegments`):

```typescript
export type TimelineState = "filled" | "partial" | "empty";

/** Runs of equal state over [firstDay, lastDay]: filled ⊃ highlighted, partial ⊃ partialDays, else empty. */
export function timelineSegments(
  highlighted: Set<number>, partialDays: Set<number>, firstDay: number, lastDay: number
): Array<{ startDay: number; endDay: number; state: TimelineState }>
```

(`coverageSegments` can be reimplemented as `timelineSegments(highlighted, new Set(), ...)` mapped back, or left alone — implementer's call; don't break its callers.) `RawTimeline` renders `classNames("segment", seg.state)` — scss gains a `.partial` rule (visually between `.filled` and `.empty`; e.g. the filled color at reduced opacity). Default `partialDays` to an empty set so existing callers are untouched.

**Station section.** Under the Local Raw Data `data-section`, one `data-section coverage` block per `store.selectedModelList` entry. Data per row (single-station case): `stats = store.coverageFor(stationKey, model.metadataUrl)`; days from `stats.dayStates`: `highlighted` = days with `"covered"`, `partialDays` = days with `"partial"`. Header text:

- loaded: `` `${model.label} · ${stats.eventCount} events · ${coveredCount}/${totalDays} days covered` ``
- pending: `` `${model.label} · …` ``
- error: `` `${model.label} — coverage unavailable` ``

All-stations section: per model, one text line from `store.modelAggregate(model.metadataUrl)`: `` `${model.label} · ${eventCount} events · ${coveredDays}/${totalDays} station-days covered` `` — no bar.

**TDD (component tests first, using each file's existing patterns):**
- timelineSegments: pure cases — all filled, mixed runs, partial runs, adjacent same-state days merge into one segment.
- RawTimeline: renders `.partial` class segments when partialDays given; existing binary behavior unchanged without it.
- StationSection: one coverage row per selected model; the three header variants (loaded/pending/error); all-station aggregate lines present, no timeline in aggregate rows.

**Acceptance:** component + util suites green; eslint (classnames rule) + check:types.

Commit: "Show event coverage timelines in seismic admin."

---

### Task 10: Update button

**Files:** Modify `seismic-admin-store.ts` (+ `.test.ts`), `station-section.tsx` (+ `.test.tsx`).

**Step 1 — failing store tests** (inject `processCoverage`, `downloadStation`, `eventService`, `fetchMetadata` fakes):

```typescript
it("updateStation downloads the whole range first, then processes each selected model in order", async () => {
  const calls: string[] = [];
  const downloadStation = jest.fn(async () => { calls.push("download"); });
  const processCoverage = jest.fn(async ({ metadata }) => { calls.push(`process:${metadata.id}`); ... });
  // two selected models → ["download", "process:compact-v1", "process:large-v1"]
});
it("passes the endDate-inclusive range and the station to processCoverage", ...);
it("reloads that pair's coverage stats after each model", ...);
it("skips a model whose metadata fails, notes it in feedback, and continues", ...);
it("continues past a processCoverage rejection and reports the failure", ...);
it("updateAllSelected updates stations sequentially with 'Station i of n' prefixes and a summary", ...);
it("summary counts failed stations", ...);
```

**Step 3 — implementation:**

```typescript
// deps addition
processCoverage?: (options: ProcessCoverageOptions) => Promise<{ processed: number; skipped: number; total: number }>;

async updateStation(key: string) {
  const s = this.stations.get(key);
  if (!s) return;
  await this.updateOne(key);
  this.setFeedback(`Finished updating ${stationLabel(s)}.`);
}

async updateAllSelected() {
  const stationKeys = [...this.selected];
  let failures = 0;
  for (let i = 0; i < stationKeys.length; i++) {
    const ok = await this.updateOne(stationKeys[i], `Station ${i + 1} of ${stationKeys.length} — `);
    if (!ok) failures++;
  }
  const n = stationKeys.length;
  this.setFeedback(failures
    ? `Finished updating ${n} station${n === 1 ? "" : "s"}; ${failures} had failures.`
    : `Finished updating ${n} station${n === 1 ? "" : "s"}.`);
}

/** Download the whole range, then generate events for each selected model's
 *  uncovered days. Returns false if any model failed. */
private async updateOne(key: string, prefix = ""): Promise<boolean> {
  const s = this.stations.get(key);
  const range = this.rangeSec;
  if (!s || !range || !this.authReady) return false;

  // 1) Raw data for the whole range (existing flow, reports its own feedback).
  await this.download(s, prefix);

  // 2) Events for uncovered days, model by model.
  let ok = true;
  for (const url of this.selectedModels) {
    const label = this.models.get(url)?.label ?? url;
    const metadata = await this.ensureModelMetadata(url);
    if (!metadata) {
      this.setFeedback(`${prefix}Skipping ${label}: model metadata unavailable.`);
      ok = false;
      continue;
    }
    try {
      const run = this.deps.processCoverage ?? processUncoveredRanges;
      await run({
        stationData: s, metadata, range,
        onProgress: (progress, total) => this.setFeedback(
          `${prefix}${stationLabel(s)} — ${label}: day ${progress} of ${total}`),
      });
    } catch (err) {
      console.warn("Update failed:", err);
      this.setFeedback(`${prefix}Update failed for ${stationLabel(s)} — ${label}.`);
      ok = false;
    }
    await this.loadCoverageStats(s, url);
  }
  return ok;
}
```

**Station section:** third button between Download and Delete:

```tsx
const updateDisabled = !store.authReady || store.selectedModels.size === 0
  || store.isFullyCovered(allStations ? undefined : stationKey);
const updateLabel = `Update ${allStations ? "all " : ""}events`;
const update = () => {
  if (allStations) {
    void store.updateAllSelected();
  } else {
    void store.updateStation(stationKey);
  }
};
// ...
<button disabled={updateDisabled} onClick={update}>{updateLabel}</button>
```

**Component tests:** disabled truth table — unauthenticated / zero models / fully covered (mock `isFullyCovered` state via store data) / enabled otherwise; click dispatches `updateStation(key)` vs `updateAllSelected()`.

**Acceptance:** store + component suites green; check:types + eslint.

Commit: "Add Update button generating events for uncovered ranges."

---

### Task 11: Final verification

1. `npm test -- --no-watchman` (full suite), `npm run check:types`, `npm run lint:build` (0 errors; only the pre-existing cypress warnings).
2. Reconcile against the design doc, bullet by bullet (Goals + Update-disable rules); flag any delta explicitly.
3. Manual smoke path (document what was/wasn't done in the report): Firestore emulator running (`./functions-v2/node_modules/.bin/firebase emulators:start --only firestore --project production` from the repo root), `npm start`, open the admin page with `?firestore=emulator` (+ `unit` param naming a unit with wave-runner models) — coverage rows populate; Update on a small range downloads, processes, and flips the rows to covered; a re-run's Update button is disabled.
4. Report honestly (including anything not run), then superpowers:verification-before-completion → superpowers:finishing-a-development-branch.
