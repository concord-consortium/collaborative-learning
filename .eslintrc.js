/* eslint-env node */
// default configuration tuned for development
module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
    },
    plugins: ["@typescript-eslint", "json", "react", "react-hooks", "import", "simple-import-sort"],
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
      "build/", "node_modules/"
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
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",  // 27 as of 2020-09-13
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-shadow": ["error", { builtinGlobals: false, hoist: "all", allow: ["resolve", "reject"] }],
      "@typescript-eslint/no-unused-vars": ["warn",
        { args: "none", ignoreRestSiblings: true, "destructuredArrayIgnorePattern": "^_" }],
      "@typescript-eslint/prefer-optional-chain": "off",  // 300 as of 2020-09-13
      // "comma-spacing": "error",
      curly: ["error", "multi-line", "consistent"],
      "dot-notation": "error",
      "eol-last": "warn",
      eqeqeq: ["error", "smart"],
      "eslint-comments/no-unused-disable": "off",   // enabled in .eslintrc.build.js
      "indent": ["error", 2, {
        SwitchCase: 1,
        FunctionDeclaration: { parameters: 2 },
        FunctionExpression: { parameters: 2 },
      }],
      // "indent": ["error", 2, {
      //   ignoredNodes: [
      //     // Ignore ternaries, we have different types of indentation
      //     "ConditionalExpression",
      //     // Ignore indentation within variable declarations.
      //     // This effectively disables a whole lot of the indentation checking.
      //     // Generally the indentation of our code blocks by this rule is pretty good,
      //     // but there are cases like arrow functions inside of variable declarations
      //     // which don't look good with the default indentation
      //     "VariableDeclaration *"
      //   ],
      //   ArrayExpression: "off",
      //   CallExpression: {
      //     arguments: "off"
      //   },
      //   FunctionDeclaration: {
      //     parameters: "off"
      //   },
      //   FunctionExpression: {
      //     parameters: "off"
      //   },
      //   ImportDeclaration: "first",
      //   MemberExpression: "off",
      //   ObjectExpression: "first",
      //   SwitchCase: 1,
      //   VariableDeclarator: "first"
      // }],

      // This looks like the right thing to enable
      // "indent": ["error", 2, {
      //   ignoredNodes: [ ":not(ImportDeclaration, ImportDeclaration *)" ],
      //   ImportDeclaration: "first",
      // }],
      "max-len": ["warn", { code: 120, ignoreUrls: true }],
      "no-bitwise": "error",
      "no-debugger": "off", // enabled in .eslintrc.build.js
      "no-duplicate-imports": "error",
      "no-sequences": "error",
      "no-shadow": "off", // superseded by @typescript-eslint/no-shadow
      "no-tabs": "error",
      "no-unneeded-ternary": "error",
      "no-unused-expressions": ["error", { allowShortCircuit: true }],
      "no-unused-vars": "off",  // superseded by @typescript-eslint/no-unused-vars
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "no-whitespace-before-property": "error",
      "object-shorthand": "error",
      // "object-curly-spacing": ["error", "always"],
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
      // "simple-import-sort/imports": ["error", {
      //   // TODO: Non assigned or side effect imports will be in the anything groupin their matching group but not be sorted
      //   // within the group, is this OK?
      //   groups: [
      //     // Non assigned, this will match a shorter string than the css group
      //     ["^\\u0000"],
      //     // Node.js builtins prefixed with `node:`.
      //     ["^node:"],
      //     // Packages.
      //     // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
      //     // Always put react first
      //     ["^react$", "^@?\\w"],
      //     // Absolute imports and other imports such as Vue-style `@/foo`.
      //     // Anything not matched in another group.
      //     ["^"],
      //     // Relative imports.
      //     // Anything that starts with a dot.
      //     ["^\\."],
      //     // Assets
      //     ["\.png$", "\.svg$"],
      //     // Non assigning css
      //     ["^\\u0000.*\.(css|sass|scss)"],
      //     // Non assigning local registration imports
      //     ["^\\u0000\..*/register-", "^\\u0000\..*-registration$"]

      //   ]
      // }],
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
