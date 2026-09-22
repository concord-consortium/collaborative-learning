/* eslint-env node */
// build/production configuration extends default/development configuration
module.exports = {
    extends: "./.eslintrc.js",
    rules: {
      "eslint-comments/no-unused-disable": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "mocha/no-exclusive-tests": "error",
    },
    overrides: [
      { // plugins (temporary)
        files: ["**/plugins/**/*"],
        rules: {
          "no-console": ["warn", { allow: ["log", "warn", "error"] }],
        }
      },
      { // shared/ runs in Cloud Functions and in CLI scripts, where console is the logging
        // mechanism. Repeated here rather than only in .eslintrc.js because this config sets
        // no-console at the top level, which wins over an override inherited through `extends`.
        files: ["shared/**/*.ts"],
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
