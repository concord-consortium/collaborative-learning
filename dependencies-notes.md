# Dependencies Notes

Notes on dependencies and in particular on what's keeping particular dependencies from being updated to their latest versions.

## Development Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                                |
|--------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|@types/react        |16.14.21       |17.0.39       |React 17/Library dependencies: slate-editor, blueprintjs                             |
|@types/react-dom    |16.9.14        |17.0.11       |React 17/Library dependencies: slate-editor, blueprintjs                             |

## Runtime Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                                |
|--------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|firebase            |8.10.0         |9.5.0         |v9 contains substantial API changes                                                  |
|immutable           |3.8.2          |4.0.0         |Major version update not attempted                                                   |
|jsxgraph            |0.99.8-cc.1    |1.4.2         |We have our own fork that (unfortunately) hasn't been updated for a long time.       |
|react               |16.14.0        |17.0.2        |React 17/Library dependencies: slate-editor, blueprintjs                             |
|react-data-grid     |7.0.0-canary.46|7.0.0-beta.7  |Canary.47 changed the RowFormatter props requiring some additional refactoring.      |
|react-dom           |16.14.0        |17.0.2        |React 17/Library dependencies: slate-editor, blueprintjs                             |
