# Dependencies Notes

Notes on dependencies and in particular on what's keeping particular dependencies from being updated to their latest versions.

## npm 6

Updating to `npm 7` worked locally but failed in CI due to GitHub actions still using `npm 6` so for now we're sticking with `npm 6` and lockfile version 1.

## Development Dependencies

|Dependency|Current Version|Latest Version|Notes|
|----------|---------------|--------------|-----|
|@types/d3-format|2.0.2|3.0.1|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|@types/react|16.14.17|17.0.30|React 17/Enzyme tests|
|@types/react-dom|16.9.14|17.0.10|React 17/Enzyme tests|
|copy-webpack-plugin|6.4.1|9.0.1|Webpack 5|
|css-loader|5.2.7|6.4.0|Webpack 5|
|cypress|8.2.0|8.6.0|Updating to 8.3 broke the cypress tests.|
|cypress-commands|1.1.0|2.0.1|Updating to cypress 8.3 broke the cypress tests.|
|eslint|7.32.0|8.0.1|Not all plugins (e.g. eslint-plugin-react-hooks) have been updated to support v8.|
|eslint-webpack-plugin|2.5.4|3.0.1|Webpack 5|
|firebase-admin|9.12.0|10.0.0|Major version update not attempted|
|html-webpack-plugin|4.5.2|5.4.0|Webpack 5|
|mini-css-extract-plugin|1.6.2|2.4.2|Webpack 5|
|postcss-loader|4.3.0|6.2.0|Webpack 5|
|sass-loader|10.2.0|12.2.0|Webpack 5|
|string-replace-loader|2.3.0|3.0.3|Webpack 5|
|style-loader|2.0.0|3.3.0|Webpack 5|
|ts-loader|8.3|9.2.6|Webpack 5|
|webpack|4.46.0|5.59.1|Webpack 5 ([migration guide](https://webpack.js.org/migrate/5/#upgrade-webpack-4-to-the-latest-available-version))|
|webpack-cli|3.3.12|4.9.1|Webpack 5 (claims to support Webpack 4 but I got an error on `npm start` when I tried.)|
|webpack-dev-server|3.11.2|4.3.1|Webpack 5|

## Runtime Dependencies

|Dependency|Current Version|Latest Version|Notes|
|----------|---------------|--------------|-----|
|d3-format|2.0.0|3.0.1|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|escape-string-regexp|4.0.0|5.0.0|[ESM Module](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)|
|firebase|8.10.0|9.1.3|v9 contains substantial API changes|
|immutable|3.8.2|4.0.0|Major version update not attempted|
|mobx|5.15.7|6.3.5|MobX 6 ([migration guide](https://mobx.js.org/migrating-from-4-or-5.html))|
|mobx-react|6.3.1|7.2.1|MobX 6|
|mobx-state-tree|3.17.3|5.0.3|MobX 6|
|react|16.14.0|17.0.2|React 17/Enzyme tests|
|react-data-grid|7.0.0-canary.34|7.0.0-canary.49|Canary.35 changed the styling implementation so that some of our CSS overrides no longer work. Need to figure out how to achieve the same results in the new system, e.g. inline editing styles.|
|react-dom|16.14.0|17.0.2|React 17/Enzyme tests|
