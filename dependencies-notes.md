# Dependencies Notes

Notes on dependencies and in particular on what's keeping particular dependencies from being updated to their latest versions.

## npm 6

Updating to `npm 7` worked locally but failed in CI due to GitHub actions still using `npm 6` so for now we're sticking with `npm 6` and lockfile version 1.

## Development Dependencies

|Dependency|Current Version|Latest Version|Notes|
|----------|---------------|--------------|-----|
|@types/d3-format|2.0.1|3.0.0|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|@types/react|16.14.8|17.0.11|React 17/Enzyme tests|
|@types/react-dom|16.9.13|17.0.8|React 17/Enzyme tests|
|copy-webpack-plugin|6.4.1|9.0.1|Webpack 5|
|html-webpack-plugin|4.5.2|5.3.2|Webpack 5|
|mini-css-extract-plugin|1.6.2|2.0.0|Webpack 5|
|postcss-loader|4.3.0|6.1.0|Webpack 5|
|sass-loader|10.2.0|12.1.0|Webpack 5|
|string-replace-loader|2.3.0|3.0.3|Webpack 5|
|style-loader|2.0.0|3.0.0|Webpack 5|
|ts-loader|8.3|9.2.3|Webpack 5|
|webpack|4.46.0|5.41.1|Webpack 5 ([migration guide](https://webpack.js.org/migrate/5/#upgrade-webpack-4-to-the-latest-available-version))|
|webpack-cli|3.3.12|4.7.2|Webpack 5 (claims to support Webpack 4 but I got an error on `npm start` when I tried.)|

## Runtime Dependencies

|Dependency|Current Version|Latest Version|Notes|
|----------|---------------|--------------|-----|
|d3-format|2.0.0|3.0.0|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|escape-string-regexp|4.0.0|5.0.0|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|mobx|5.15.7|6.3.2|MobX 6 ([migration guide](https://mobx.js.org/migrating-from-4-or-5.html))|
|mobx-react|6.3.1|7.2.0|MobX 6|
|mobx-state-tree|3.17.3|5.0.2|MobX 6|
|react|16.14.0|17.0.2|React 17/Enzyme tests|
|react-data-grid|7.0.0-canary.34|7.0.0-canary.49|Canary.35 changed the styling implementation so that some of our CSS overrides no longer work. Need to figure out how to achieve the same results in the new system, e.g. inline editing styles.|
|react-dom|16.14.0|17.0.2|React 17/Enzyme tests|
