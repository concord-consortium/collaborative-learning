# Dependencies Notes

Notes on dependencies and in particular on what's keeping particular dependencies from being updated to their latest versions.

## Development Dependencies

|Dependency|Current Version|Latest Version|Notes|
|----------|---------------|--------------|-----|
|@types/d3-format|2.0.2|3.0.1|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|@types/react|16.14.21|17.0.35|React 17/Library dependencies: slate-editor, blueprintjs|
|@types/react-dom|16.9.14|17.0.11|React 17/Library dependencies: slate-editor, blueprintjs|
|copy-webpack-plugin|6.4.1|9.1.0|Webpack 5|
|css-loader|5.2.7|6.5.1|Webpack 5|
|eslint-webpack-plugin|2.6.0|3.1.1|Webpack 5|
|firebase-admin|9.12.0|10.0.0|Major version update not attempted|
|html-webpack-plugin|4.5.2|5.5.0|Webpack 5|
|mini-css-extract-plugin|1.6.2|2.4.4|Webpack 5|
|postcss-loader|4.3.0|6.2.0|Webpack 5|
|sass-loader|10.2.0|12.3.0|Webpack 5|
|string-replace-loader|2.3.0|3.0.3|Webpack 5|
|style-loader|2.0.0|3.3.1|Webpack 5|
|ts-loader|8.3|9.2.6|Webpack 5|
|webpack|4.46.0|5.64.1|Webpack 5 ([migration guide](https://webpack.js.org/migrate/5/#upgrade-webpack-4-to-the-latest-available-version))|
|webpack-cli|3.3.12|4.9.1|Webpack 5 (claims to support Webpack 4 but I got an error on `npm start` when I tried.)|
|webpack-dev-server|3.11.3|4.5.0|Webpack 5|

## Runtime Dependencies

|Dependency|Current Version|Latest Version|Notes|
|----------|---------------|--------------|-----|
|d3-format|2.0.0|3.0.1|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|escape-string-regexp|4.0.0|5.0.0|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|firebase|8.10.0|9.4.1|v9 contains substantial API changes|
|immutable|3.8.2|4.0.0|Major version update not attempted|
|react|16.14.0|17.0.2|React 17/Library dependencies: slate-editor, blueprintjs|
|react-data-grid|7.0.0-canary.46|7.0.0-beta.7|Canary.47 changed the RowFormatter props requiring some additional refactoring.|
|react-dom|16.14.0|17.0.2|React 17/Library dependencies: slate-editor, blueprintjs|
