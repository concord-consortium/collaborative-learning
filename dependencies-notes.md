# Dependencies Notes

Notes on dependencies, particularly reasons for not updating to their latest versions.

## Development Dependencies

|Dependency                  |Current Version|Latest Version|Notes                                                                        |
|----------------------------|---------------|--------------|-----------------------------------------------------------------------------|
|@testing-library/react      |12.1.5         |13.3.0        |React 18                                                                     |
|@testing-library/user-event |13.5.0         |14.4.3        |Version 14 broke tests; did not investigate further.                         |
|@types/react                |17.0.48        |18.0.17       |React 18                                                                     |
|@types/react-dom            |17.0.17        |18.0.6        |React 18                                                                     |
|@types/react-tabs           |2.3.4          |5.0.5         |Versions 3 and 4 were never published(?); Version 5 requires React 18        |
|@types/slate-react          |0.22.9         |0.50.1        |Requires slate-editor library update to latest slate                         |
|cypress                     |9.7.0          |10.6.0        |Cypress 10 requires non-trivial migration.                                   |
|cypress-commands            |2.0.1          |3.0.0         |Cypress 10                                                                   |
|cypress-terminal-report     |3.5.2          |4.1.2         |Cypress 10                                                                   |

## Runtime Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                                |
|--------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|@concord-consortium/jsxgraph|0.99.8-cc.1|1.4.4     |We have our own fork that (unfortunately) hasn't been updated for a long time.       |
|@concord-consortium/react-hook-form|3.0.0-cc.1|3.0.0|Had to create our own fork to update React `peerDependencies` for npm 8.11. Original appears to have been abandoned.|
|@chakra-ui/react    |1.8.9          |2.5.5         |Brought in with CODAP's Graph component. CODAP uses v2 but v2 requires React 18      |
|chart.js            |2.9.4          |3.9.1         |Major version not attempted; only used by Dataflow tile, which doesn't really use it.|
|firebase            |8.10.1         |9.9.3         |Version 9 requires substantial migration; attempted update with `compat` imports failed.|
|immutable           |3.8.2          |4.1.0         |Major version update not attempted; only required by legacy slate versions.          |
|mob-state-tree      |5.1.5-cc.1     |5.1.6         |We are using a concord fork which fixes a bug. Additionally latest version changes TS types for arrays which broke a number of our models.|
|nanoid              |3.3.4          |4.0.0         |v4 switched to ESM and dependencies such as postcss break with v4                    |
|netlify-cms-app     |2.15.72        |2.15.72       |Requires React 16 or 17. Blocks upgrade to React 18.                                 |
|react               |17.0.2         |18.2.0        |React 18                                                                             |
|react-chartjs-2     |2.11.2         |4.3.1         |Major version update not attempted; may not be used any more (was used by Dataflow)  |
|react-data-grid     |7.0.0-canary.46|7.0.0-beta.16 |Canary.47 changed the RowFormatter props requiring some additional refactoring. Note that `beta` versions come after `canary` versions. We are patching react-data-grid and our patch only applies to 7.0.0-canary.46|
|react-dom           |17.0.2         |18.2.0        |React 18                                                                             |
|react-tabs          |3.2.3          |5.1.0         |Version 4 not attempted; Version 5 requires React 18                                 |
