/* eslint-env node */
'use strict';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const packageJson = require('../package.json');

const defaultHtmlConfig = {
  templateParameters: {
    ...packageJson.config
  },
  chunks: ['admin'],
  publicPath: '.',
  template: 'src/admin.html',
  favicon: '../src/public/favicon.ico',
};

module.exports = (env, argv) => {
  const devMode = argv.mode !== 'production';

  return {
    context: __dirname, // to automatically find tsconfig.json
    // https://survivejs.com/webpack/building/source-maps/
    devtool: devMode ? 'eval-cheap-module-source-map' : 'source-map',
    devServer: {
      port: 8082
    },
    entry: {
      admin: './src/admin.tsx',
    },
    mode: devMode ? 'development' : 'production',
    output: {
      clean: true,
      filename: '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash:8].js'
    },
    performance: { hints: false },
    module: {
      rules: [
        {
          test: /\.[tj]sx?$/i,
          loader: 'ts-loader',
          exclude: /node_modules/
        },
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
          test: /\.png$/i,
          type: 'asset',
          generator: {
            filename: 'assets/images/[name].[contenthash:6][ext]'
          }
        }
      ]
    },
    resolve: {
      alias: {
        'mobx-state-tree': '@concord-consortium/mobx-state-tree',
        // cf. https://github.com/facebook/react/issues/20235#issuecomment-732205073
        'react/jsx-runtime': require.resolve('react/jsx-runtime'),
        'react-modal-hook': '@concord-consortium/react-modal-hook',
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
        ...defaultHtmlConfig,
        filename: 'index.html'
      }),
      new HtmlWebpackPlugin({
        ...defaultHtmlConfig,
        publicPath: 'cms',
        filename: 'admin.html'
      })
    ]
  };
};
