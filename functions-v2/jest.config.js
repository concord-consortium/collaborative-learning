module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};

// This is configured here because the clearFirebaseData function from
// firebase-functions-test/lib/providers/firestore needs it set
// before the module is imported.
// The port here should match the port that is set in the emulators
// section of firebase.json
process.env["FIRESTORE_EMULATOR_HOST"]="127.0.0.1:8088";
