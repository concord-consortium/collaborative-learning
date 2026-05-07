# Dependencies Notes

Notes on dependencies, particularly reasons for not updating to their latest versions.

## Node / npm Engine Spec

`package.json` declares `"node": "^20.19.0 || ^22.13.0 || >=24"`. Combined with `engine-strict=true` in `.npmrc`, contributors on older Node versions will get a hard `npm install` failure. The constraint is driven by transitive dev dependencies pulled in by the TypeScript 5 / typescript-eslint 8 upgrade — notably `eslint-plugin-jest@29` (requires `^20.12.0 || ^22.0.0 || >=24.0.0`) and `eslint-visitor-keys@5` (requires `^20.19.0 || ^22.13.0 || >=24`). When updating these or related ESLint packages, re-check their `engines` fields and bump this spec to match the strictest transitive requirement.

## Development Dependencies

|Dependency                  |Current Version|Latest Version|Notes                                                                        |
|----------------------------|---------------|--------------|-----------------------------------------------------------------------------|
|@testing-library/react      |12.1.5         |13.3.0        |React 18                                                                     |
|@testing-library/user-event |13.5.0         |14.4.3        |Version 14 broke tests; did not investigate further.                         |
|@types/react                |17.0.48        |18.0.17       |React 18                                                                     |
|@types/react-dom            |17.0.17        |18.0.6        |React 18                                                                     |
|@types/react-tabs           |2.3.4          |5.0.5         |Versions 3 and 4 were never published(?); Version 5 requires React 18        |
|@types/slate-react          |0.22.9         |0.50.1        |Requires slate-editor library update to latest slate                         |
|ts-json-schema-generator    |2.4.0          |2.9.0         |v2.5+ requires Node >= 22; CI runs Node 20.                                  |

## Runtime Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                                |
|--------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|@concord-consortium/react-hook-form|3.0.0-cc.1|3.0.0|Had to create our own fork to update React `peerDependencies` for npm 8.11. Original appears to have been abandoned.|
|@chakra-ui/react    |1.8.9          |2.5.5         |Brought in with CODAP's Graph component. CODAP uses v2 but v2 requires React 18      |
|chart.js            |2.9.4          |3.9.1         |Major version not attempted; only used by Dataflow tile, which doesn't really use it.|
|firebase            |8.10.1         |9.9.3         |Version 9 requires substantial migration; attempted update with `compat` imports failed.|
|immutable           |3.8.2          |4.1.0         |Major version update not attempted; only required by legacy slate versions.          |
|mob-state-tree      |5.1.5-cc.1     |5.1.6         |We are using a concord fork which fixes a bug. Additionally latest version changes TS types for arrays which broke a number of our models.|
|nanoid              |3.3.4          |4.0.0         |v4 switched to ESM and dependencies such as postcss break with v4                    |
|react               |17.0.2         |18.2.0        |React 18                                                                             |
|react-chartjs-2     |2.11.2         |4.3.1         |Major version update not attempted; may not be used any more (was used by Dataflow)  |
|react-data-grid     |7.0.0-canary.46|7.0.0-beta.16 |Canary.47 changed the RowFormatter props requiring some additional refactoring. Note that `beta` versions come after `canary` versions. We are patching react-data-grid and our patch only applies to 7.0.0-canary.46|
|react-dom           |17.0.2         |18.2.0        |React 18                                                                             |
|react-tabs          |3.2.3          |5.1.0         |Version 4 not attempted; Version 5 requires React 18                                 |
