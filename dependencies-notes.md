# Dependencies Notes

Notes on dependencies and in particular on what's keeping particular dependencies from being updated to their latest versions.

## Development Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                              |
|--------------------|---------------|--------------|-----------------------------------------------------------------------------------|
|@svgr/webpack       |5.5.0          |6.1.0         |v6 generated errors which I did not pursue                                         |
|@types/d3-format    |2.0.2          |3.0.1         |[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|@types/react        |16.14.21       |17.0.35       |React 17/Library dependencies: slate-editor, blueprintjs                           |
|@types/react-dom    |16.9.14        |17.0.11       |React 17/Library dependencies: slate-editor, blueprintjs                           |
|firebase-admin      |9.12.0         |10.0.0        |Major version update not attempted                                                 |

## Runtime Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                              |
|--------------------|---------------|--------------|-----------------------------------------------------------------------------------|
|d3-format           |2.0.0          |3.0.1         |[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|escape-string-regexp|4.0.0          |5.0.0         |[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|firebase            |8.10.0         |9.5.0         |v9 contains substantial API changes                                                |
|immutable           |3.8.2          |4.0.0         |Major version update not attempted                                                 |
|react               |16.14.0        |17.0.2        |React 17/Library dependencies: slate-editor, blueprintjs                           |
|react-data-grid     |7.0.0-canary.46|7.0.0-beta.7  |Canary.47 changed the RowFormatter props requiring some additional refactoring.    |
|react-dom           |16.14.0        |17.0.2        |React 17/Library dependencies: slate-editor, blueprintjs                           |
