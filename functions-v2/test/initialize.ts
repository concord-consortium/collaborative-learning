import {deleteApp, initializeApp} from "firebase-admin/app";
import initializeFFT from "firebase-functions-test";

export const projectConfig = {
  projectId: "demo-test",
  // This URL doesn't have to be valid, it just has to a non empty string
  // The actual database host will be picked up from
  //   FIREBASE_DATABASE_EMULATOR_HOST
  // This is defined in jest.config.js
  databaseURL: "https://not-a-project.firebaseio.com",
};

export function initialize() {
  const fft = initializeFFT(projectConfig);

  // When the function is running in the cloud initializeApp is called by index.ts
  // In our tests we import the function's module directly so we can call
  // initializeApp ourselves. This is beneficial since initializeApp needs to
  // be called after initializeFFT above.
  const fbApp = initializeApp();

  const cleanup = async () => {
    fft.cleanup();
    // Deleting the Firebase app is necessary for the Jest tests to exit when they
    // are complete. FFT creates a testApp which it deletes in cleanup(), but
    // we are not using this testApp.
    await deleteApp(fbApp);
  };
  return {fft, fbApp, cleanup};
}
