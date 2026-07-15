# load-catalog Reuse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `src/seismic-admin/utils/load-catalog.ts` to reuse the main CLUE app's unit-URL resolution (`CurriculumConfig`), unit fetching (`getUnitJson`), and URL-param parsing (`urlParams`), deleting the duplicated `unitContentUrl`.

**Architecture:** `loadCatalog` creates a throwaway `CurriculumConfig` MST instance (same one-liner as `stores.ts:127`) and fetches the unit JSON through `getUnitJson` → `getContent`. The unit param comes from the global `urlParams` instead of a `search` string argument. The stations-extraction helpers stay local. Design doc: `docs/plans/2026-07-15-load-catalog-reuse-design.md`.

**Tech Stack:** TypeScript, MobX State Tree (Concord fork), Jest (jsdom).

---

## Context for the implementer

- Repo root: `/Users/tealefristoe/concord/collaborative-learning`. Work on branch `clue-555-seismic-admin`.
- Run Jest with `--no-watchman` on this machine.
- Key reused code (read these before starting):
  - `src/models/stores/curriculum-config.ts` — `CurriculumConfig.getUnitUrl` resolves a unit param (full URL, `./`-relative path, or bare unit code via `unitCodeMap`) against `curriculumSiteUrl` + `branch/<curriculumBranch ?? main>`. The `curriculumBranch` URL param arrives via the MST env: `CurriculumConfig.create(json, { urlParams })`.
  - `src/models/curriculum/unit-utils.ts` — `getUnitJson(unitId, curriculumConfig)` resolves via `getUnitSpec` and fetches through `getContent` (which handles the `authoringBranch` param rewrite). On HTTP 404 it resolves to the raw `Response` object; on network error or other non-ok statuses it **throws**.
  - `src/utilities/url-params.ts` — module-level `urlParams` parsed from `location.search` at import time; `reprocessUrlParams()` re-parses and mutates the same exported object in place (tests rely on this).
- Behavioral trap: `curriculum-config.json` has `defaultUnit: "sas"`, and `getUnitSpec(undefined)` falls back to it. `loadCatalog` must return the base catalog **before** calling `getUnitJson` when there is no `unit` param.
- Jest is configured for jsdom, so `window.history.replaceState({}, "", "/?unit=x")` updates `location.search`.

### Task 1: Update the tests to the new API

**Files:**
- Modify: `src/seismic-admin/utils/load-catalog.test.ts`

**Step 1: Rewrite the test file**

Replace the entire contents of `src/seismic-admin/utils/load-catalog.test.ts` with:

```ts
import { defaultCatalog, loadCatalog, stationsFromUnitConfig } from "./load-catalog";
import { reprocessUrlParams } from "../../utilities/url-params";

const stations = [{ network: "AK", station: "K204", channel: "HNZ", location: "--", label: "Anchorage" }];

// Point the global urlParams (shared with CurriculumConfig and getContent) at a new search string.
const setSearch = (search: string) => {
  window.history.replaceState({}, "", `/${search}`);
  reprocessUrlParams();
};

describe("stationsFromUnitConfig", () => {
  it("extracts wave-runner stations from config.settings", () => {
    const json = { config: { settings: { "wave-runner": { stations } } } };
    expect(stationsFromUnitConfig(json)).toEqual(stations);
  });

  it("supports deprecated top-level settings", () => {
    const json = { settings: { "wave-runner": { stations } } };
    expect(stationsFromUnitConfig(json)).toEqual(stations);
  });

  it("returns undefined when the unit declares no stations", () => {
    expect(stationsFromUnitConfig({})).toBeUndefined();
    expect(stationsFromUnitConfig({ config: { settings: {} } })).toBeUndefined();
  });
});

describe("defaultCatalog", () => {
  it("reads the wave-runner stations from the base app config", () => {
    const base = defaultCatalog();
    expect(base.length).toBeGreaterThan(0);
    expect(base.map(s => s.station)).toContain("RC01");
  });
});

describe("loadCatalog", () => {
  afterEach(() => {
    delete (global as any).fetch;
    setSearch("");
  });

  it("returns the base catalog when there is no unit param", async () => {
    setSearch("");
    expect(await loadCatalog()).toEqual(defaultCatalog());
  });

  it("falls back to the base catalog when the unit declares no stations", async () => {
    setSearch("?unit=seismic");
    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ config: { settings: {} } }) }));
    expect(await loadCatalog()).toEqual(defaultCatalog());
  });

  it("fetches the unit URL and returns its stations", async () => {
    setSearch("?unit=https%3A%2F%2Fexample.org%2Funits%2Fqa%2Fcontent.json");
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ config: { settings: { "wave-runner": { stations } } } }),
    }));
    const result = await loadCatalog();
    expect(result).toEqual(stations);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("https://example.org/units/qa/content.json");
  });

  it("resolves a bare unit code against the curriculum site and branch", async () => {
    setSearch("?unit=seismic&curriculumBranch=my-branch");
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ config: { settings: { "wave-runner": { stations } } } }),
    }));
    await loadCatalog();
    expect((global.fetch as jest.Mock).mock.calls[0][0])
      .toBe("https://models-resources.concord.org/clue-curriculum/branch/my-branch/seismic/content.json");
  });

  it("falls back to the base catalog on fetch failure", async () => {
    setSearch("?unit=https%3A%2F%2Fexample.org%2Fcontent.json");
    (global as any).fetch = jest.fn(async () => { throw new Error("network"); });
    expect(await loadCatalog()).toEqual(defaultCatalog());
  });
});
```

Notes on intent:
- `unitContentUrl` tests are gone (the function is deleted; the equivalent logic is already covered by `src/models/stores/curriculum-config.test.ts`). The new "bare unit code" test instead pins the *integration*: bare code + `curriculumBranch` resolve through the real `CurriculumConfig`.
- The full-URL unit values are URL-encoded in the search string because `query-string`'s `parse` decodes them (the old test bypassed parsing quirks by using `URLSearchParams`).
- The fetch-URL assertions use `.mock.calls[0][0]` because `getContent` calls `fetch(input, init)` with an `undefined` second arg.

**Step 2: Run the tests to verify they fail for the right reason**

Run:
```bash
cd /Users/tealefristoe/concord/collaborative-learning && npx jest src/seismic-admin/utils/load-catalog.test.ts --no-watchman
```
Expected: FAIL — the `loadCatalog` describe block fails (old implementation ignores `urlParams` and expects a `search` argument; e.g. "fetches the unit URL" gets the base catalog instead of `stations`). The `stationsFromUnitConfig` / `defaultCatalog` tests still pass.

Do NOT commit yet — the suite is red.

### Task 2: Rewrite loadCatalog to reuse the main-app code

**Files:**
- Modify: `src/seismic-admin/utils/load-catalog.ts`

**Step 1: Replace the implementation**

Replace the entire contents of `src/seismic-admin/utils/load-catalog.ts` with:

```ts
import appConfig from "../../clue/app-config.json";
import curriculumConfigJson from "../../clue/curriculum-config.json";
import { StationConfig } from "../../../shared/seismic/seismic-types";
import { getUnitJson } from "../../models/curriculum/unit-utils";
import { CurriculumConfig } from "../../models/stores/curriculum-config";
import { urlParams } from "../../utilities/url-params";

function stationsFromSettings(settings: any): StationConfig[] | undefined {
  const stations = settings?.["wave-runner"]?.stations;
  return Array.isArray(stations) ? stations as StationConfig[] : undefined;
}

/**
 * Pull the wave-runner station catalog out of a (fetched) unit config JSON.
 * Stations live under `config.settings["wave-runner"].stations`; older units keep
 * `settings` at the top level. Returns undefined when the unit declares no stations,
 * so the caller can fall back to the base catalog.
 */
export function stationsFromUnitConfig(unitJson: any): StationConfig[] | undefined {
  return stationsFromSettings(unitJson?.config?.settings ?? unitJson?.settings);
}

/** The base station catalog from the default app config, used when a unit declares none. */
export function defaultCatalog(): StationConfig[] {
  return stationsFromSettings((appConfig as any).config?.settings) ?? [];
}

/**
 * The station catalog for the page: the app-config defaults, overridden by the
 * `?unit=` unit's stations when it declares any. The unit param is resolved and
 * fetched with the same code the main app uses (CurriculumConfig.getUnitUrl and
 * getUnitJson), so `curriculumBranch` and `authoringBranch` params work here too.
 * Any failure (network error, bad JSON, 404) degrades to the base catalog.
 *
 * Settings merge two levels deep (see ConfigurationManager.settings), so a unit's
 * `wave-runner.stations` array replaces the base list rather than extending it.
 */
export async function loadCatalog(): Promise<StationConfig[]> {
  const base = defaultCatalog();
  try {
    // Bail out before getUnitJson: getUnitSpec would otherwise fall back to the
    // main app's defaultUnit, which shouldn't affect the admin page.
    if (!urlParams.unit) return base;

    const curriculumConfig = CurriculumConfig.create(curriculumConfigJson, { urlParams });
    return stationsFromUnitConfig(await getUnitJson(urlParams.unit, curriculumConfig)) ?? base;
  } catch {
    return base;
  }
}
```

Notes:
- `CurriculumConfig` is created fresh per call (same snapshot+env one-liner as `src/models/stores/stores.ts:127`); MST views compute over the non-observable `urlParams` env, so a long-lived instance could serve stale values after `reprocessUrlParams()`.
- On a 404, `getUnitJson` resolves to the raw `Response`; `stationsFromUnitConfig` returns `undefined` for it, landing on the base-catalog fallback without special-casing.

**Step 2: Update the caller**

`src/seismic-admin/components/app.tsx:17` calls `loadCatalog()` with no arguments already — verify with:
```bash
grep -rn "loadCatalog\|unitContentUrl" src --include="*.ts" --include="*.tsx" | grep -v load-catalog.
```
Expected: only the `app.tsx` call site; no `unitContentUrl` imports remain. No edits needed unless this grep shows otherwise.

**Step 3: Run the tests to verify they pass**

Run:
```bash
cd /Users/tealefristoe/concord/collaborative-learning && npx jest src/seismic-admin/utils/load-catalog.test.ts --no-watchman
```
Expected: PASS (all tests).

**Step 4: Type-check and lint**

Run:
```bash
cd /Users/tealefristoe/concord/collaborative-learning && npm run check:types && npm run lint:build
```
Expected: both clean.

**Step 5: Run the wider seismic-admin suite to catch fallout**

Run:
```bash
cd /Users/tealefristoe/concord/collaborative-learning && npx jest src/seismic-admin --no-watchman
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/seismic-admin/utils/load-catalog.ts src/seismic-admin/utils/load-catalog.test.ts
git commit -m "Reuse main-app unit loading in seismic-admin load-catalog.

Replaces the duplicated unitContentUrl with CurriculumConfig.getUnitUrl and
the raw fetch with getUnitJson/getContent, gaining curriculumBranch and
authoringBranch support on the admin page.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Verify in the running app

**Step 1: Manual smoke test**

Start the dev server (`npm start`) and load the seismic-admin page (`/seismic-admin/`) with:
- no `unit` param → base catalog stations appear;
- `?unit=seismic` → that unit's stations (or base catalog if it declares none);
- `?unit=<bogus>` → base catalog (fallback path).

Expected: the station list renders in all three cases; no console errors from `loadCatalog`.
