/* eslint-env node */
// build/production configuration extends default/development configuration
module.exports = {
    extends: "./.eslintrc.js",
    rules: {
      "eslint-comments/no-unused-disable": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error"
    },
    overrides: [
      { // plugins (temporary)
        files: ["**/plugins/**/*"],
        rules: {
          "no-console": ["warn", { allow: ["log", "warn", "error"] }],
        }
      },
      {
        files: ["jsxgraph.d.ts"],
        rules: {
          "eslint-comments/no-unused-disable": "off"
        }
      }
    ]
};
