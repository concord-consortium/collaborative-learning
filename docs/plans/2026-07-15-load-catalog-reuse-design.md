# Design: load-catalog.ts reuses main-app unit loading

## Problem

`src/seismic-admin/utils/load-catalog.ts` duplicates unit-URL analysis that the
main CLUE app already implements:

- `unitContentUrl` re-implements `CurriculumConfig.getUnitUrl`
  (`src/models/stores/curriculum-config.ts`), but without `curriculumBranch`
  support (it hard-codes `branch/main`).
- `loadCatalog` uses a raw `fetch`, while the main app goes through
  `getUnitJson` → `getContent`, which also handles the `authoringBranch`
  param rewrite.

## Design

All changes are in `load-catalog.ts` (and its test); no main-app code changes.

1. **Delete `unitContentUrl`.** `loadCatalog` instead creates the real model,
   the same way `stores.ts` does:

   ```ts
   const curriculumConfig = CurriculumConfig.create(curriculumConfigJson, { urlParams });
   ```

   Created fresh inside `loadCatalog` — cheap, and avoids stale-view issues if
   params change between calls in tests.

2. **Replace the raw `fetch`** with `getUnitJson(unitParam, curriculumConfig)`
   from `src/models/curriculum/unit-utils.ts` — the exact function the main
   app uses.

3. **Read the unit param from the global `urlParams`**
   (`src/utilities/url-params.ts`) instead of parsing a `search` string, so
   `unit`, `curriculumBranch`, and `authoringBranch` all come from the same
   place they do in the main app. The `search` parameter on `loadCatalog` goes
   away.

4. **Keep** `stationsFromUnitConfig` / `defaultCatalog` / `stationsFromSettings`
   as-is — the only main-app equivalent is the full `ConfigurationManager`
   settings merge, which is overkill here.

## Behavior

- No `unit` param → early return of the base catalog *before* calling
  `getUnitJson`. This matters: `getUnitSpec` falls back to
  `defaultUnit: "sas"`, which the admin page does not want.
- Failure handling unchanged: `getUnitJson` throws on network/5xx errors
  (caught → base catalog) and returns the raw `Response` on 404
  (`stationsFromUnitConfig` yields `undefined` → base catalog).
- New behavior gained: `?curriculumBranch=` and `?authoringBranch=` now work
  on the admin page, matching the main app.

## Tests

- `unitContentUrl` tests are deleted.
- `loadCatalog` tests set the URL via `window.history.replaceState(...)` plus
  `reprocessUrlParams()` instead of passing a `search` string; the fetch mocks
  stay.

## Trade-off accepted

The seismic-admin bundle picks up MST and url-params. It already pulls in
`SeismicDownloadService` from `src/models`, so this is not a new kind of
dependency.
