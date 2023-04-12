/* eslint-env node */
'use strict';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const packageJson = require('./package.json');
const fs = require('fs');
const path = require('path');
const rollbarSnippetPath = './node_modules/rollbar/dist/rollbar.snippet.js';
const rollbarSnippet = fs.readFileSync(path.join(__dirname, rollbarSnippetPath), { encoding: 'utf8' }).trim();

// DEPLOY_PATH is set by the s3-deploy-action its value will be:
// `branch/[branch-name]/` or `version/[tag-name]/`
// See the following documentation for more detail:
//   https://github.com/concord-consortium/s3-deploy-action/blob/main/README.md#top-branch-example
const DEPLOY_PATH = process.env.DEPLOY_PATH;

const baseHtmlPluginConfig = {
  template: 'src/index.html',
  favicon: 'src/public/favicon.ico',
  templateParameters: {
    rollbarSnippet,
    ...packageJson.config
  }
};

module.exports = (env, argv) => {
  const devMode = argv.mode !== 'production';

  return {
    context: __dirname, // to automatically find tsconfig.json
    // https://survivejs.com/webpack/building/source-maps/
    devtool: devMode ? 'eval-cheap-module-source-map' : 'source-map',
    entry: {
      index: './src/index.tsx',
      // admin: './src/admin.tsx',
      // 'doc-editor': './src/doc-editor.tsx'
    },
    mode: devMode ? 'development' : 'production',
    output: {
      clean: true,
      filename: '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash:8].js'
    },
    performance: { hints: false },
    externals: {
      // ignore optional dependency of JSXGraph
      'canvas': 'canvas'
    },
    module: {
      rules: [
        {
          test: /react-data-grid\/lib\/bundle\.js$/,
          loader: require.resolve('string-replace-loader'),
          options: {
            multiple: [
              { // react-data-grid doesn't currently provide a means of clearing cell selection
                search: /if \(!isCellWithinBounds\(position\)\) return;/g,
                replace:
                  "// [CC] (string-replace-loader) allow clearing the selection\n" +
                  "    if (!(position.idx === -1 && position.rowIdx === -1) && !isCellWithinBounds(position)) return;",
                strict: true  // fail build if replacement not performed
              }
            ]
          }
        },
        // TODO: Remove the block below if it's definitely not needed
        // {
        //   test: /popper\.js$/,
        //   loader: require.resolve('string-replace-loader'),
        //   options: {
        //     multiple: [
        //       { // I couldn't get react-tippy's popperOptions to have the desired effect, so we
        //         // just use the string-replace trick to change the popper.js library defaults.
        //         search: /padding: 5,/g,
        //         replace: "padding: 0, // [CC] override (string-replace-loader)",
        //         strict: true  // fail build if replacement not performed
        //       }
        //     ]
        //   }
        // },
        {
          test: /\.[tj]sx?$/i,
          loader: 'ts-loader',
          exclude: /node_modules/
        },
        // This code coverage instrumentation should only be added when needed. It makes
        // the code larger and slower
        process.env.CODE_COVERAGE ? {
          test: /\.[tj]sx?$/,
          loader: '@jsdevtools/coverage-istanbul-loader',
          options: { esModules: true },
          enforce: 'post',
          exclude: path.join(__dirname, 'node_modules'),
        } : {},
        { // disable svgo optimization for files ending in .nosvgo.svg
          test: /\.nosvgo\.svg$/i,
          loader: "@svgr/webpack",
          options: {
            svgo: false
          }
        },
        {
          test: /\.svg$/i,
          exclude: /\.nosvgo\.svg$/i,
          oneOf: [
            {
              issuer: /\.[tj]sx?$/i,
              loader: "@svgr/webpack",
              options: {
                svgoConfig: {
                  plugins: [
                    {
                      // cf. https://github.com/svg/svgo/releases/tag/v2.4.0
                      name: "preset-default",
                      params: {
                        overrides: {
                          // leave <line>s, <rect>s and <circle>s alone
                          // https://github.com/svg/svgo/blob/master/plugins/convertShapeToPath.js
                          convertShapeToPath: false,
                          // leave "class"es and "id"s alone
                          // https://github.com/svg/svgo/blob/master/plugins/prefixIds.js
                          prefixIds: false,
                          // leave "stroke"s and "fill"s alone
                          // https://github.com/svg/svgo/blob/master/plugins/removeUnknownsAndDefaults.js
                          removeUnknownsAndDefaults: { defaultAttrs: false }
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              // Do not apply SVGR import in CSS files.
              issuer: /\.(sa|sc|le|c)ss$/i,
              type: 'asset',
              generator: {
                filename: 'assets/images/[name].[contenthash:6][ext]'
              }
            }
          ]
        },
        {
          test: /\.(sa|sc|le|c)ss$/i,
          use: [
            devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                modules: {
                  // required for :import from scss files
                  // cf. https://github.com/webpack-contrib/css-loader#separating-interoperable-css-only-and-css-module-features
                  // v6 changed from `compileType` to `mode`
                  mode: 'icss'
                }
              }
            },
            'postcss-loader',
            'sass-loader'
          ]
        },
        {
          test: /\.(woff|woff2|eot|ttf)$/i,
          type: 'asset',
          generator: {
            filename: 'assets/fonts/[name].[contenthash:6][ext]'
          }
        },
        {
          // store placeholder image as file not data URI
          test: /image_placeholder\.png$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name][ext]'
          }
        },
        {
          test: /\.png$/i,
          // don't convert placeholder image to a data URI
          exclude: /image_placeholder\.png$/,
          type: 'asset',
          generator: {
            filename: 'assets/images/[name].[contenthash:6][ext]'
          }
        }
      ]
    },
    optimization: {
      moduleIds: "deterministic",
      splitChunks: {
        chunks: 'all',
        // In general only split modules out of chunks when the module is used
        // in 2 or more chunks
        minChunks: 2,
        filename: (pathData) => {
          // console.log("vendor filename", pathData.chunk.id,
          //   [...pathData.chunk._groups].map(group => group.options?.name),
          //   [...pathData.chunk._groups].map(group => group.chunks));
          const groupsNames = [...pathData.chunk._groups].map(group => group.options?.name);
          return `common-${groupsNames.join('-')}.[chunkhash:8].js`;
        },
        cacheGroups: {
          // For the initial chunk, split modules from node_modules out even if
          // they are only used by one initial chunk. Because we have multiple
          // entry points this will result in a few different vendor files.
          // The entry points share code, so some of the vendor files are used by
          // multiple entry points.
          initialVendors: {
            chunks: 'initial',
            test: /[\\/]node_modules[\\/]/,
            minChunks: 1,
            reuseExistingChunk: true,
            filename: (pathData) => {
              // console.log("vendor filename", pathData.chunk.id,
              //   [...pathData.chunk._groups].map(group => group.options?.name),
              //   [...pathData.chunk._groups].map(group => group.chunks));
              const groupsNames = [...pathData.chunk._groups].map(group => group.options?.name);
              return `vendor-${groupsNames.join('-')}.[chunkhash:8].js`;
            },
          },
        }
      }
    },
    resolve: {
      alias: {
        'mobx-state-tree': '@concord-consortium/mobx-state-tree',
        // cf. https://github.com/facebook/react/issues/20235#issuecomment-732205073
        'react/jsx-runtime': require.resolve('react/jsx-runtime'),
        'react-modal-hook': '@concord-consortium/react-modal-hook',
        'rete-react-render-plugin': '@concord-consortium/rete-react-render-plugin'
      },
      fallback: { crypto: false },
      extensions: [ '.ts', '.tsx', '.js', '.jsx' ]
    },
    ignoreWarnings: [/export .* was not found in/],
    plugins: [
      new ESLintPlugin(),
      new MiniCssExtractPlugin({
        filename: devMode ? '[name].css' : '[name].[chunkhash:8].css',
        ignoreOrder: true
      }),
      new HtmlWebpackPlugin({
        ...baseHtmlPluginConfig,
        chunks: ['index'],
        filename: 'index.html',
        publicPath: '.',
      }),
      new HtmlWebpackPlugin({
        ...baseHtmlPluginConfig,
        chunks: ['admin'],
        filename: 'admin.html',
        publicPath: '.',
        template: 'src/admin.html'
      }),
      ...(DEPLOY_PATH ? [new HtmlWebpackPlugin({
        ...baseHtmlPluginConfig,
        chunks: ['index'],
        filename: 'index-top.html',
        publicPath: DEPLOY_PATH,
      })] : []),
      new HtmlWebpackPlugin({
        ...baseHtmlPluginConfig,
        chunks: ['doc-editor'],
        filename: 'doc-editor.html',
        publicPath: '.',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {from: 'src/public'}
        ]
      })
    ]
  };
};
