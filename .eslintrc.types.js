/* eslint-env node */
// build/production configuration extends default/development configuration
module.exports = {
    parserOptions: {
      tsconfigRootDir: __dirname,
      project: ['./tsconfig.json']
    },
    extends: [
      "./.eslintrc.js",
      "plugin:@typescript-eslint/recommended-requiring-type-checking"
    ],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",         //  67 as of 2021-02-08
      "@typescript-eslint/no-misused-promises": "off",          //  11 as of 2021-02-08
      "@typescript-eslint/no-unsafe-assignment": "off",         // 450 as of 2021-02-08
      "@typescript-eslint/no-unsafe-call": "off",               //  72 as of 2021-02-08
      "@typescript-eslint/no-unsafe-member-access": "off",      // 388 as of 2021-02-08
      "@typescript-eslint/no-unsafe-return": "off",             //  80 as of 2021-02-08
      "@typescript-eslint/restrict-template-expressions": "off" //  31 as of 2021-02-08
    },
    overrides: [
      { // some rules can be relaxed in tests
        files: ["**/*.test.*"],
        rules: {
          "@typescript-eslint/require-await": "off"
        }
      }
    ]
};
