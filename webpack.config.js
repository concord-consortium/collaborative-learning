/* eslint-env node */
'use strict';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const packageJson = require('./package.json');
const fs = require('fs');
const path = require('path');
const rollbarSnippetPath = './node_modules/rollbar/dist/rollbar.snippet.js';
const rollbarSnippet = fs.readFileSync(path.join(__dirname, rollbarSnippetPath), { encoding: 'utf8' }).trim();

module.exports = (env, argv) => {
  const devMode = argv.mode !== 'production';

  return {
    context: __dirname, // to automatically find tsconfig.json
    // https://survivejs.com/webpack/building/source-maps/
    devtool: devMode ? 'cheap-module-eval-source-map' : 'source-map',
    entry: ['whatwg-fetch', './src/index.tsx'],
    mode: devMode ? 'development' : 'production',
    output: {
      filename: 'index.[hash].js'
    },
    performance: { hints: false },
    externals: {
      // ignore optional dependency of JSXGraph
      'canvas': 'canvas'
    },
    module: {
      rules: [
        {
          test: /\.(js|json|jsx|tsx?)$/i,
          exclude: /node_modules/,
          enforce: 'pre',
          loader: 'eslint-loader',
        },
        {
          test: /\.[tj]sx?$/i,
          loader: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.svg$/i,
          oneOf: [
            {
              issuer: /\.[tj]sx?$/i,
              loader: "@svgr/webpack"
            },
            {
              // Do not apply SVGR import in CSS files.
              issuer: /\.(sa|sc|le|c)ss$/i,
              loader: 'url-loader',
              options: {
                limit: 8192,
                name: 'assets/images/[name].[hash:6].[ext]',
                esModule: false
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
                esModule: false,
                modules: {
                  // required for :import from scss files
                  // cf. https://github.com/webpack-contrib/css-loader#separating-interoperable-css-only-and-css-module-features
                  compileType: 'icss'
                }
              }
            },
            'postcss-loader',
            'sass-loader'
          ]
        },
        {
          test: /\.(woff|woff2|eot|ttf)$/i,
          loader: 'url-loader',
          options: {
            limit: 8192,
            name: 'assets/fonts/[name].[hash:6].[ext]',
            esModule: false
          }
        },
        {
          test: /\.png$/i,
          loader: 'url-loader',
          options: {
            limit: 8192,
            name: 'assets/images/[name].[hash:6].[ext]',
            esModule: false
          }
        }
      ]
    },
    resolve: {
      extensions: [ '.ts', '.tsx', '.js', '.jsx' ]
    },
    stats: {
      // suppress "export not found" warnings about re-exported types
      warningsFilter: /export .* was not found in/
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: devMode ? 'index.css' : 'index.[hash].css'
      }),
      new HtmlWebpackPlugin({
        filename: 'index.html',
        template: 'src/index.html',
        templateParameters: {
          rollbarSnippet,
          ...packageJson.config
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          {from: 'src/public'}
        ]
      })
    ]
  };
};
