/* eslint-env node */
// default configuration tuned for development
module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
    },
    plugins: ["@typescript-eslint", "json", "react", "react-hooks", "unused-imports", "mocha"],
    env: {
      browser: true,
      es6: true
    },
    settings: {
      react: {
        pragma: "React",
        version: "detect"
      }
    },
    ignorePatterns: [
      "build/", "node_modules/", "src/plugins/dataflow/firmware/"
    ],
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:eslint-comments/recommended",
      "plugin:json/recommended",
      "plugin:react/recommended",
      "plugin:react-hooks/recommended"
    ],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-confusing-non-null-assertion": "error",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-empty-object-type": "off",  // typescript-eslint v8 successor of no-empty-interface
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",  // 27 as of 2020-09-13
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-shadow": ["error", { builtinGlobals: false, hoist: "all", allow: ["resolve", "reject"] }],
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true }],
      "@typescript-eslint/no-unused-vars": "off", // moved to unused-imports
      "@typescript-eslint/prefer-optional-chain": "off",  // 300 as of 2020-09-13
      "mocha/no-exclusive-tests": "warn", // error in .eslintrc.build.js
      curly: ["error", "multi-line", "consistent"],
      "dot-notation": "error",
      "eol-last": "warn",
      eqeqeq: ["error", "smart"],
      "eslint-comments/no-unused-disable": "off",   // enabled in .eslintrc.build.js
      "max-len": ["warn", { code: 120, ignoreUrls: true }],
      "no-bitwise": "error",
      "no-debugger": "off", // enabled in .eslintrc.build.js
      "no-duplicate-imports": "error",
      "no-sequences": "error",
      "no-shadow": "off", // superseded by @typescript-eslint/no-shadow
      "no-tabs": "error",
      "no-unneeded-ternary": "error",
      "no-unused-expressions": "off",  // superseded by @typescript-eslint/no-unused-expressions
      "no-unused-vars": "off",  // superseded by @typescript-eslint/no-unused-vars
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "no-whitespace-before-property": "error",
      "object-shorthand": "error",
      "prefer-const": ["error", {"destructuring": "all"}],
      "prefer-object-spread": "error",
      "prefer-regex-literals": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      radix: "error",
      "react/jsx-closing-tag-location": "error",
      "react/jsx-handler-names": "off", // 13 as of 2020-09-13
      "react/jsx-no-useless-fragment": "error",
      "react/no-access-state-in-setstate": "error",
      "react/no-danger": "error",
      "react/no-unsafe": ["off", { checkAliases: true }], // 1 as of 2020-09-13
      "react/no-unused-state": "error",
      "react/prop-types": "off",
      semi: ["error", "always"],
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": ["warn",
        { args: "none", ignoreRestSiblings: true, "destructuredArrayIgnorePattern": "^_" }],
    },
    overrides: [
      { // test files
        files: ["*.test.*", "jest-resolver.js", "setupTests.ts"],
        env: {
          node: true,
          jest: true
        },
        rules: {
          "@typescript-eslint/no-non-null-assertion": "off",
          // require() can be useful in mocking
          "@typescript-eslint/no-require-imports": "off",
          "@typescript-eslint/no-var-requires": "off",
        }
      },
      { // shared/ is loaded by Firebase Cloud Functions as well as by the browser, and functions
        // cannot load React, MST, or asset imports. Several files there state that constraint in a
        // comment; this is what actually enforces it. Breaking it does not fail loudly — the
        // functions build fails later with an error that does not name the cause.
        //
        // Exempt: test files, which only ever run under jest, and ai-summarizer-with-drawings.ts,
        // which is the deliberately browser-only SVG variant used by the standalone doc editor.
        // Matches the extensions the lint scripts glob for shared/, so a file cannot be linted
        // without also being held to this. shared/ holds only .ts today; .tsx and .jsx are absent
        // deliberately, since a React component there would already be the thing this forbids.
        files: ["shared/**/*.{ts,js}"],
        excludedFiles: [
          "shared/**/*.test.{ts,js}", "shared/ai-summarizer/ai-summarizer-with-drawings.ts"
        ],
        rules: {
          // Cloud Functions and the CLI scripts under shared/ log through console — it is the
          // logging mechanism there, not a leftover debug statement.
          "no-console": ["warn", { allow: ["log", "warn", "error"] }],
          "no-restricted-imports": ["error", {
            paths: [
              { name: "react", message: "shared/ is loaded by Cloud Functions, which cannot load React." },
              { name: "react-dom", message: "shared/ is loaded by Cloud Functions, which cannot load React." },
              { name: "mobx", message: "shared/ is loaded by Cloud Functions, which cannot load MobX." },
              { name: "mobx-react", message: "shared/ is loaded by Cloud Functions, which cannot load MobX." },
              { name: "mobx-state-tree", message: "shared/ works on snapshots, not models; MST cannot load in Cloud Functions." },
              { name: "@concord-consortium/mobx-state-tree", message: "shared/ works on snapshots, not models; MST cannot load in Cloud Functions." }
            ],
            patterns: [
              {
                group: ["react/*", "react-dom/*", "*.svg"],
                message: "shared/ is loaded by Cloud Functions, which cannot load React or asset imports."
              },
              {
                group: ["**/src/**"],
                message: "Importing from src/ pulls React and MST in transitively. Put the shared piece in shared/ and import it from both sides."
              }
            ]
          }]
        }
      },
      { // A React component under shared/ is the violation this whole boundary exists to prevent,
        // and it is the one case no-restricted-imports cannot catch: a .tsx there might import
        // nothing at all and still be a component. So these extensions are globbed by the lint
        // scripts *in order to be rejected*, not because they are supported.
        //
        // The `Program` selector is the root node of a parsed file's syntax tree, present exactly
        // once in every file including an empty one, so matching it rejects the file's existence
        // rather than anything in it. No exclusions: a .test.tsx would be just as wrong.
        files: ["shared/**/*.{tsx,jsx}"],
        rules: {
          "no-restricted-syntax": ["error", {
            selector: "Program",
            message: "shared/ is loaded by Cloud Functions, which cannot load React. Put the component in src/ and keep the logic it needs in a .ts file here."
          }]
        }
      },
      { // eslint configs
        files: [".eslintrc*.js"],
        env: {
          node: true
        }
      },
      { // webpack configs
        files: ["webpack.config.js"],
        env: {
          node: true
        },
        rules: {
          "@typescript-eslint/no-require-imports": "off",
          "@typescript-eslint/no-var-requires": "off"
        }
      }
    ]
};
