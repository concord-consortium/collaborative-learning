# Dependencies Notes

Notes on dependencies, particularly reasons for not updating to their latest versions.

## Node / npm Engine Spec

`package.json` declares `"node": "^20.19.0 || ^22.13.0 || >=24"`. Combined with `engine-strict=true` in `.npmrc`, contributors on older Node versions will get a hard `npm install` failure. The constraint is driven by transitive dev dependencies pulled in by the TypeScript 5 / typescript-eslint 8 upgrade — notably `eslint-plugin-jest@29` (requires `^20.12.0 || ^22.0.0 || >=24.0.0`) and `eslint-visitor-keys@5` (requires `^20.19.0 || ^22.13.0 || >=24`). When updating these or related ESLint packages, re-check their `engines` fields and bump this spec to match the strictest transitive requirement.

## React 18 Blockers

The following packages prevent installing React 18 because their declared React
peer/runtime dependencies don't allow it. Each must be updated (or replaced)
before `react`/`react-dom` can move to 18.

|Package                                |Current        |Why it blocks 18                                                                 |Path forward                                                                                |
|---------------------------------------|---------------|---------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
|@concord-consortium/codap-formulas-react17|1.1.0       |Hard-depends on `react: ^17.0.2`. The `-react17` suffix is by design — it's the React 17 build.|Publish a non-react17 sibling and switch the import. Tracked in [CODAP-1291](https://concord-consortium.atlassian.net/browse/CODAP-1291) ([codap#2553](https://github.com/concord-consortium/codap/pull/2553)).|
|@concord-consortium/diagram-view       |1.0.2          |peerDep `react: ^17.0.2`. Latest published is also 1.0.2.                        |Finish the existing open PR and cut a new release. Tracked in [QPG-1](https://concord-consortium.atlassian.net/browse/QPG-1) ([quantity-playground#91](https://github.com/concord-consortium/quantity-playground/pull/91)).|
|react-data-grid                        |7.0.0-canary.46|peerDep `^16.14 \|\| ^17.0`. Our local patch also targets canary.46 only.        |Bump to `7.0.0-beta.44` to align with CODAPv3 and adopt their patch. See plan below.|

The remaining React-tied rows in the table below need to be updated as part of
the React 18 work, but they don't block installation: they each support React
18 already at a newer version.

### Plan for `react-data-grid`

Bump CLUE to **`7.0.0-beta.44`** to align with CODAPv3, replace our patch with
their patch (a richer superset of ours), and refactor three CLUE files to
switch from the "return true from `onColumnResize`" protocol to the
`columnWidths` controlled prop that CODAP's patch introduces. Both protocols
exist to give the consumer authority over column widths; the controlled-prop
form is cleaner and the one we'll inherit.

Code changes (~15 lines, 3 files):

- [`src/components/tiles/table/use-column-resize.ts`](src/components/tiles/table/use-column-resize.ts)
  — drop `return true;` (the existing complete/refs/model logic stays).
- [`src/components/tiles/table/use-data-set.ts`](src/components/tiles/table/use-data-set.ts)
  — drop the `returnVal` capture/return; signature becomes `(idx, width, complete) => void`.
- [`src/components/tiles/table/table-tile.tsx`](src/components/tiles/table/table-tile.tsx)
  — build a `columnWidths: Map<string, number>` from `measureColumnWidth` and
  pass it to `<ReactDataGrid>` as the new `columnWidths` prop. The existing
  `triggerColumnChange` / `triggerRowChange` already cause the recompute.

Other changes:

- Replace `patches/react-data-grid+7.0.0-canary.46.patch` with the equivalent
  of CODAPv3's `v3/patches/react-data-grid+7.0.0-beta.44.patch`.
- Bump `patch-package` from `^6.4.7` to `^8.0.1` to match CODAPv3.

Beyond the column-width controlled prop, CODAP's patch also brings several
fixes CLUE doesn't have: defensive `nextColumn?.parent` null-checks, header
row keyboard handling for negative `rowIdx`, a `selectedCellIsWithinSelection
Bounds` guard, `rowKeyGetter`-based stale-row detection in the editor, and
exporting `textEditorClassname`.

Test surface: column resize during drag, persistence on release, persistence
after reload, programmatic width changes via MST snapshot patches and
undo-redo, double-click auto-resize, the Cypress table tests.

## Development Dependencies

|Dependency                  |Current Version|Latest Version|Notes                                                                        |
|----------------------------|---------------|--------------|-----------------------------------------------------------------------------|
|@testing-library/react      |12.1.5         |16.3.2        |Requires React 18+                                                           |
|@types/react                |17.0.48        |19.2.14       |Requires matching React 18 or 19                                             |
|@types/react-dom            |17.0.17        |19.2.3        |Requires matching React 18 or 19                                             |
|@types/react-tabs           |2.3.4          |5.0.5         |Versions 3 and 4 were never published(?); Version 5 requires React 18        |
|@types/slate-react          |0.22.9         |0.50.1        |Requires `@concord-consortium/slate-editor` update (see below).              |
|ts-json-schema-generator    |2.4.0          |2.9.0         |v2.5+ requires Node >= 22; CI runs Node 20.                                  |

## Runtime Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                                |
|--------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|@chakra-ui/react    |1.8.9          |3.35.0        |Brought in with CODAP's Graph component. CODAP uses v2; v2+ requires React 18.       |
|@concord-consortium/slate-editor|0.10.1|0.12.0        |v0.12.0 requires React >= 18. Updating also brings newer slate/slate-react, which would unblock `@types/slate-react`.|
|chart.js            |2.9.4          |4.5.1         |Major version not attempted; only used by Dataflow tile, which doesn't really use it.|
|firebase            |8.10.1         |12.12.1       |Version 9 requires substantial migration; attempted update with `compat` imports failed. Latest is now v12.|
|immutable           |4.3.0          |5.1.5         |v5 not attempted; only required by legacy slate versions.                            |
|mobx-state-tree     |6.0.0-cc.1     |7.2.0         |We are using a concord fork which fixes a bug. Latest version changes TS types for arrays which broke a number of our models.|
|nanoid              |3.3.4          |5.1.11        |v4+ switched to ESM and dependencies such as postcss break with v4.                  |
|react               |17.0.2         |19.2.5        |Major upgrade; will require updates across many of the React-tied rows in this table.|
|react-chartjs-2     |2.11.2         |5.3.1         |Major version update not attempted; may not be used any more (was used by Dataflow). |
|react-data-grid     |7.0.0-canary.46|7.0.0-beta.59 |We patch react-data-grid; our patch is canary.46-only. Plan is to bump to `7.0.0-beta.44` to align with CODAPv3 — see the React 18 blockers section above. Note that `beta` versions come after `canary` versions.|
|react-dom           |17.0.2         |19.2.5        |Tied to `react` upgrade above.                                                       |
|react-tabs          |3.2.3          |6.1.1         |Version 4 not attempted; v5+ requires React 18+.                                     |
|react-tippy         |1.4.0          |1.4.0         |Unmaintained since May 2020. Migration target if we move off it is [Floating UI](https://floating-ui.com/) (`@floating-ui/react`).|
