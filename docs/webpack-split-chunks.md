# CLUE's usage of webpack's SplitChunksPlugin

The first thing to know is that even with splitChunks disabled, webpack will generate multiple chunks based on the current CLUE code. This is because CLUE uses dynamic imports for the Tiles and SharedModels, see [register-tools.ts](../src/register-tools.ts). 

However with splitChunks disabled (`splitChunks: false`), these resulting chunks will have duplicate code in them. This is because webpack will bundle every dependency with these dynamic chunks that doesn't already exist in the main bundle. So for example react-tippy and popper are used by the tiles but not the main CLUE code, so they will be duplicated in every tile's chunk.

The [Webpack: An in-depth introduction to SplitChunksPlugin](https://indepth.dev/posts/1490/webpack-an-in-depth-introduction-to-splitchunksplugin) article is a very good place to learn about the details of using SplitChunksPlugin. It is very detailed, but it has to be in order to explain this. Unless you are changing the configuration you might not need to read it.

Without any configuration, webpack has splitChunks enabled with a default configuration. This default configuration is documented in the [SplitChunks Plugin official page](https://webpack.js.org/plugins/split-chunks-plugin/). This official documentation is very confusing. The article above is much better.

We customize this default configuration to change the file names and reduce the number of files to make them easier to track. The list of output javascript files currently looks like:
| size | name    |
| ---- | ------- |
| 2.1M | vendor-main.0d5d7291.js |
| 886K | Geometry.b6757911.js |
| 765K | Dataflow.a1d8573c.js |
| 467K | common-Diagram-SharedVariables.f9c52179.js |
| 389K | index.d5fa927a11b89dcbd16c.js |
|  84K | SharedVariables.b4653a3e.js |
|  82K | Table.669b2f19.js |
|  51K | common-DataCard-SharedVariables-Drawing-Geometry-Image-Table-Text.1c62df70.js |
|  33K | common-SharedVariables-Drawing.dff01f72.js |
|  26K | common-Dataflow-Geometry.0bd31c83.js |
|  23K | Drawing.4306850b.js |
|  16K | Text.c6d6d422.js |
|  16K | DataCard.17a9279c.js |
|  15K | Image.82881f51.js |
| 4.3K | Diagram.ad8a13bc.js |
| 1.2K | Starter.b26bfa75.js |
| 254B | SharedDataSet.98119794.js |

This output is the result of several things in different places:
1. in `register-tools.ts` the chunk name is specified for each of the imports. This is where the names like Image, Drawing, and Text come from.
2. in `webpack.config.js` there is an  `output.chunkName: '[name].[contenthash:8].js'` setting. This is where the names like `Starter.b26bfa75.js` come from. Without this setting the initial chunks would have names based on the top level `output.name` configuration. So they would all be named `index.[hash].js`.
3. in `webpack.config.js` there is an `optimization.splitChunks.filename` function that uses metadata provided by webpack to customize the names of the chunks generated by SplitChunks. This is where the names like `common-Dataflow-Geometry.0bd31c83.js` come from. Without this setting that file name would be `935.0bd31c83.js`. This is because the `output.chunkName: '[name].[contenthash:8].js'` setting would be used, and the `[name]` is a numeric id of the generated chunk.
4. in `webpack.config.js` there is an `optimization.splitChunks.minChunks: 2` setting which says to only put a module in a new chunk if the module is used by by at least two chunks. Without this setting webpack would split several files into two. For example `Dataflow.a1d8573c.js(765K)` would be split into `common-Dataflow.a5319196.js(525K)` and `Dataflow.7bdb8e82.js(240K)`. This splitting in two might be better because the download can be done in parallel, however having multiple files makes it harder to keep track of the size of each tile's code.
5. in `webpack.config.js` there is an `optimization.splitChunks.cacheGroups` with:
    ```
    initialVendors: {
      chunks: 'initial',
      test: /[\\/]node_modules[\\/]/,
      minChunks: 1,
      reuseExistingChunk: true,
      filename: 'vendor-main.[chunkhash:8].js',
    },
    ```
    This is where the `vendor-main.0d5d7291.js` comes from. It says: for any module from the initial chunk, that is in node_modules, put it in a new chunk.

### CSS
The CSS files are not split. There is one css file for each top level hunk. They currently look like:
| size | name |
| ---- | ---- |
| 161K | main.248731f6.css |
|  44K | Dataflow.2561d50e.css |
|  10K | Table.1c1ff3a6.css |
|  10K | Geometry.4df8daa2.css |
| 8.8K | DataCard.3c12d9a8.css |
| 8.7K | Diagram.c4a51990.css |
| 6.3K | Image.f79c4f48.css |
| 4.7K | Drawing.c8722e28.css |
| 4.5K | Text.543aaecc.css |
| 696B | SharedVariables.b0ce62b2.css |
| 207B | Starter.fdf39778.css |

The SplitChunksPlugin configuration is not doing anything special to make this happen. Their filename format is coming from the `MiniCssExtractPlugin`.

## Inspecting the chunks

When changing the configuration or trying to understand why a chunk changed, it is useful to inspect what is in each chunk. There is a nice visualization tool that helps with this. You can run it with

```
> npm run stats
> npx webpack-bundle-analyzer stats.json dist
```

If you want to generate a markdown table like the one above of the javascript chunks you can use this command: `ls -lhS dist/*.js | awk '{print "|", $5, "|", $9, "|"}'`

If you are changing the webpack configuration, it is useful to check the generated index.html after a build. This will show which chunks webpack has decided need to be loaded when the page loads. If a chunk isn't listed there, then it should be dynamically loaded when the tile is loaded.

## `splitChunks.cacheGroups` and `splitChunks.cacheGroups.[group].name` config

One of the most confusing things about splitChunks are the cacheGroups and the name property. Read the [Webpack: An in-depth introduction to SplitChunksPlugin](https://indepth.dev/posts/1490/webpack-an-in-depth-introduction-to-splitchunksplugin) article to understand cacheGroups.

Briefly, cacheGroups are a way to customize the splitChunks config on a per module basis. If the module matches the conditions in cacheGroup such as `test`, `minChunks`, or `chunks`, then the cacheGroup might generate a new chunk for that module. Whether it generates a new chunk depends on which other cacheGroups match and whether there is already a chunk that the module could go into. SplitChunks provides two default groups which we are not customizing. See below for more info about these default groups.

We are not configuring the name is property, but we used to.

The `name` property determines the name of the generated chunk the module will go into. If you use a fixed string like `name: 'common'` then every module will go into a single bundle/chunk called "common". In other words this name is not just the name of the output file, it actually determines how the chunks are split. In our case, we want webpack to figure out the best place to put each of the modules. This allows webpack to avoid duplicates and optimize sizes.

## The filename function

The filename function currently being used is
```
filename: (pathData) => {
  const groupsNames = [...pathData.chunk._groups].map(group => group.options?.name);
  return `common-${groupsNames.join('-')}.[chunkhash:8].js`;
},
```

This function was created by inspecting the `pathData`. This `pathData` is not documented by webpack as far as I found. I inspected it by adding console logs inside of the filename function like: `console.log("filename", pathData)`. Note that you need to run `npm run webpack:build` and not `npm run stats` because stats will eat the console log and put it in the `stats.json` file.  Node will only print a few levels of an object with a console log like that. So to dig further you need to reference parts of it directly. For example:

```
console.log("vendor filename", pathData.chunk.id, 
    [...pathData.chunk._groups].map(group => group.options?.name), 
    [...pathData.chunk._groups].map(group => group.chunks));
```

Note: some of the documentation implies the default filename will include several parts that looks similar to what our current filename function creates. However I could not find a way to get webpack to use that default filename.

## Default cacheGroups

The SplitChunksPlugin provides 2 default cache groups. This is how they are defined:
```
defaultVendors: {
  test: /[\\/]node_modules[\\/]/,
  priority: -10,
  reuseExistingChunk: true,
},
default: {
  minChunks: 2,
  priority: -20,
  reuseExistingChunk: true,
},
```

The webpack documentation implies that you can override some parts of the default cacheGroups. This is not really true. If you specify properties at the `splitChunks` top level these properties will be applied to the default cacheGroups, only if these groups do not define these properties themselves. These top level properties will also apply to any cacheGroups you make such as the `initialVendors` we are using. Also SplitChunksPlugin will not merge the properties of its default cacheGroup with your overridden cacheGroup. In other words if you define `default: {}` you will be clearing out all of the properties of the default group. If you want to modify just the default cacheGroups you need to redefine all of their properties and then modify those properties. 

# Chunk Groups
Some of the documentation references chunk groups. These should not be confused with the cache groups in the SplitChunks configuration. The [Code Splitting blog post](https://medium.com/webpack/webpack-4-code-splitting-chunk-graph-and-the-splitchunks-optimization-be739a861366) describes these chunk groups. Every entry point is a chunk group that starts with one chunk. And every async import starts a new chunk group with one chunk. Then it is the roll of the SplitChunks plugin to decide if it should add more chunks to each of these groups. Multiple groups can have the same chunk, this happens when there is shared code. Each chunk group is loaded in parallel. And parent-child dependency relationships are based at the chunk group level not the chunk level.

# Algorithm for cacheGroups
The way the cacheGroups configuration changes the output files is very complex. This process is not documented concisely anywhere as far as I can tell. The [Webpack: An in-depth introduction to SplitChunksPlugin](https://indepth.dev/posts/1490/webpack-an-in-depth-introduction-to-splitchunksplugin) article helps understanding it, but it will probably take you a lot of experimentation and possibly reading the code to fully grok it.

The key confusion that I had was understanding which properties of a cacheGroup are criteria for selecting a module, and which properties configure what happens when the criteria matches.

Here is a list of common criteria properties
- `chunks`: which type of chunk the module is part of `initial`, `async`, `all` or a custom function.
- `test`: which module should be included. It can be a regex of the module path or function.
- `minChunks`: how many chunks (of type `chunks`) is this module used by.
- `priority`: this is applied after all modules are placed into one or more cacheGroup instances. The cacheGroup instance with the highest priority is given preference. That cacheGroup instance is used to create a chunk. In the webpack code this "cacheGroup instance" is a called an `info`.

Configuration properties:
- `minSize`: how big the resulting set of modules has to be before a chunk is created
- `reuseExistingChunk`: if the module is already part of an existing chunk don't duplicate this module in a new chunk.
