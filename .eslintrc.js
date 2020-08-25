// default configuration tuned for development
module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
    },
    plugins: ["@typescript-eslint", "json", "react", "react-hooks"],
    env: {
      browser: true,
      es6: true,
      jest: true
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
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",  // extensive use before introduction of eslint
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none", "ignoreRestSiblings": true }],
      "@typescript-eslint/no-var-requires": "off",  // 12 uses as of 2020-07-23
      curly: ["error", "multi-line", "consistent"],
      eqeqeq: ["error", "smart"],
      "eslint-comments/no-unused-disable": "off",   // enabled in .eslintrc.build.js
      "max-len": ["warn", { code: 120, ignoreUrls: true }],
      "no-bitwise": "error",
      "no-debugger": "off", // enabled in .eslintrc.build.js
      "no-shadow": ["error", { "builtinGlobals": false, "hoist": "all", "allow": [] }],
      "no-unused-vars": "off",  // superceded by @typescript-eslint/no-unused-vars
      "react/prop-types": "off",
      semi: ["error", "always"]
    }
};
