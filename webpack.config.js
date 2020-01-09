'use strict';

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const packageJson = require('./package.json');

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
          test: /\.tsx?$/,
          enforce: 'pre',
          use: [
            {
              loader: 'tslint-loader',
              options: {}
            }
          ]
        },
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: {
            transpileOnly: true // IMPORTANT! use transpileOnly mode to speed-up compilation
          }
        },
        {
          test: /\.(sa|sc|c)ss$/i,
          use: [
            devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
            'css-loader',
            'postcss-loader',
            'sass-loader'
          ]
        },
        {
          test: /\.(woff|woff2|eot|ttf)$/,
          loader: 'url-loader',
          options: {
            limit: 8192,
            name: 'assets/fonts/[name].[hash:6].[ext]',
            esModule: false
          }
        },
        {
          test: /\.(png|svg)$/,
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
      // alias: {
      //   rete$: '@concord-consortium/rete'
      // },
      extensions: [ '.ts', '.tsx', '.js' ]
    },
    stats: {
      // suppress "export not found" warnings about re-exported types
      warningsFilter: /export .* was not found in/
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        measureCompilationTime: true,
        useTypescriptIncrementalApi: false,
        workers: ForkTsCheckerWebpackPlugin.TWO_CPUS_FREE
      }),
      new MiniCssExtractPlugin({
        filename: devMode ? "index.css" : "index.[hash].css"
      }),
      new HtmlWebpackPlugin({
        filename: 'index.html',
        template: 'src/index.html',
        templateParameters: packageJson.config
      }),
      new CopyWebpackPlugin([
        {from: 'src/public'}
      ])
    ]
  };
};