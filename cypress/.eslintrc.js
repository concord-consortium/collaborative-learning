/* eslint-env node */
// build/production configuration extends default/development configuration
module.exports = {
    extends: [
      "../.eslintrc.js",
      "plugin:cypress/recommended",
      "plugin:chai-friendly/recommended"
    ],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      // chai-friendly only disables the base no-unused-expressions; also disable
      // the @typescript-eslint variant (added by typescript-eslint v8 recommended)
      // so chai property assertions like `expect(x).to.exist;` aren't flagged.
      "@typescript-eslint/no-unused-expressions": "off",
      "cypress/no-unnecessary-waiting": "off",
      "max-len": "off",
      "prefer-const": "off",
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
