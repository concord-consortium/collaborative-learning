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
      {
        files: ["jsxgraph.d.ts"],
        rules: {
          "eslint-comments/no-unused-disable": "off"
        }
      }
    ]
};
