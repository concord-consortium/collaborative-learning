/* eslint-env node */
// build/production configuration extends default/development configuration
module.exports = {
  extends: "./.eslintrc.js",
  rules: {
    "mocha/no-exclusive-tests": "error",
  },
};
