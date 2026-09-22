module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['lib/', 'node_modules/'],
  moduleNameMapper: {
    // These are necessary so code imported from ../shared/ will use the same version of
    // firebase-admin that the local code does.
    // The explicit `^` and `$` are needed so this only matches what we are importing.
    // Otherwise it breaks the internal firebase admin code's imports
    "^firebase-admin$": "<rootDir>/node_modules/firebase-admin",
    "^firebase-admin/firestore$": "<rootDir>/node_modules/firebase-admin/lib/firestore",
    "^firebase-admin/app$": "<rootDir>/node_modules/firebase-admin/lib/app",
    "^firebase-admin/database$": "<rootDir>/node_modules/firebase-admin/lib/database",
    // Same reason, for ../shared/ai-analysis-messages: shared/ has its own openai and zod so the
    // evaluation harness can import it directly, but the deployed function resolves both from
    // functions-v2/node_modules. Without these, jest would load two copies of zod and `instanceof`
    // checks on the built schema (expect.any(ZodEnum) and friends) would fail.
    "^openai$": "<rootDir>/node_modules/openai",
    "^openai/(.*)$": "<rootDir>/node_modules/openai/$1",
    "^zod$": "<rootDir>/node_modules/zod",
  },
  // The tests can't be run in parallel because they are using a shared Firestore and
  // Realtime database.
  maxWorkers: 1,
};

// This is configured here because the clearFirebaseData function from
// firebase-functions-test/lib/providers/firestore needs it set
// before the module is imported.
// The port here should match the port that is set in the emulators
// section of firebase.json
process.env["FIRESTORE_EMULATOR_HOST"]="127.0.0.1:8088";
process.env["FIREBASE_DATABASE_EMULATOR_HOST"]="127.0.0.1:9000";
