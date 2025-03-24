/* eslint-env node */
// build/production configuration extends default/development configuration
module.exports = {
    extends: [
      "../.eslintrc.js",
      "plugin:cypress/recommended",
      "plugin:chai-friendly/recommended"
    ],
    plugins: ["no-only-tests"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "cypress/no-unnecessary-waiting": "off",
      "max-len": "off",
      "prefer-const": "off",
      "no-only-tests/no-only-tests": "error"
    },
    overrides: [
      {
        files: ["plugins/index.js"],
        rules: {
          "@typescript-eslint/no-var-requires": "off",
          "@typescript-eslint/no-require-imports": "off"
        }
      },
    ]
};
