import initializeFFT from "firebase-functions-test";
import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {initializeApp} from "firebase-admin/app";
// import {getFirestore} from "firebase-admin/firestore";
import {runAtMidnight} from "../src/at-midnight";

process.env["FIRESTORE_EMULATOR_HOST"]="127.0.0.1:8088";
const projectConfig = {projectId: "demo-test"};
const fft = initializeFFT(projectConfig);

// When the function is running in the cloud initializeApp is called by index.ts
// Here we are importing the function's module directly so we can call
// initializeApp ourselves. This is beneficial since initializeApp needs to
// be called after initializeFFT above.
initializeApp();

// type CollectionRef = admin.firestore.CollectionReference<
//   admin.firestore.DocumentData, admin.firestore.DocumentData
// >;

describe("atMidnight", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
  });

  test("clean up firestore roots", async () => {
    // The wrapper doesn't support onSchedule. The Typescript types don't allow it
    // and at run time it doesn't pass the right event:
    // https://github.com/firebase/firebase-functions-test/issues/210
    // const wrapped = fft.wrap(atMidnight);
    await runAtMidnight();
  });

  afterAll(() => {
    fft.cleanup();
  });
});
