/** ESM + ts-jest. The `test` script sets NODE_OPTIONS=--experimental-vm-modules. */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  // NodeNext-style ".js" specifiers in TypeScript sources resolve back to the ".ts" files.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: { "^.+\\.tsx?$": ["ts-jest", { useESM: true }] },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/data/"]
};
