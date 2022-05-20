# Dependencies Notes

Notes on dependencies and in particular on what's keeping particular dependencies from being updated to their latest versions.

## Development Dependencies

|Dependency                  |Current Version|Latest Version|Notes                                                                                |
|----------------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|@testing-library/react      |12.1.5         |13.2.0        |React 18                                                                             |
|@testing-library/user-event |13.5.0         |14.2.0        |Version 14 broke tests; did not investigate further.                                 |
|@types/react                |17.0.45        |18.0.9        |React 18                                                                             |
|@types/react-dom            |17.0.17        |18.0.4        |React 18                                                                             |
|@types/react-tabs           |2.3.4          |5.0.5         |Versions 3 and 4 were never published(?); Version 5 requires React 18                |
|@types/slate-react          |0.22.9         |0.50.1        |Requires slate-editor library update to latest slate                                 |

## Runtime Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                                |
|--------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|@blueprintjs/core   |3.54.0         |4.3.2         |Version 4 not attempted; we'll probably remove the dependency rather than update it. |
|firebase            |8.10.1         |9.8.1         |v9 contains substantial API changes; attempted update with `compat` imports failed.  |
|immutable           |3.8.2          |4.0.0         |Major version update not attempted; only required by legacy slate versions.          |
|jsxgraph            |0.99.8-cc.1    |1.4.2         |We have our own fork that (unfortunately) hasn't been updated for a long time.       |
|react               |17.0.2         |18.1.0        |React 18                                                                             |
|react-data-grid     |7.0.0-canary.46|7.0.0-beta.13 |Canary.47 changed the RowFormatter props requiring some additional refactoring.      |
|react-dom           |17.0.2         |18.1.0        |React 18                                                                             |
|react-tabs          |3.2.3          |5.1.0         |Version 4 not attempted; Version 5 requires React 18                                 |
