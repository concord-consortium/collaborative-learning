/* eslint-env node */
// build/production configuration extends default/development configuration
module.exports = {
    extends: [
      "../.eslintrc.js",
      "plugin:cypress/recommended",
      "plugin:chai-friendly/recommended"
    ],
    rules: {
      "cypress/no-unnecessary-waiting": "off",
      "max-len": "off"
    }
};
