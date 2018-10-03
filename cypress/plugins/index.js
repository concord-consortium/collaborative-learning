
const wp = require('@cypress/webpack-preprocessor');
const config = require('../../webpack.config');

module.exports = (on) => {
  const options = {
    webpackOptions: config(null, {mode: 'dev'}),

  }
  on('file:preprocessor', wp(options))
}