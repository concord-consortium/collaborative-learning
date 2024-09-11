import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {getDatabase} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import {initialize, projectConfig} from "./initialize";
import {runAtMidnight} from "../src/at-midnight";

jest.mock("firebase-functions/logger");

const {cleanup} = initialize();

const HOUR = 1000 * 60 * 60;

async function writeFirestoreRoot(lastLaunchMillis = 0) {
  const newRoot = getFirestore()
    .collection("qa")
    .doc();

  await newRoot.set({
    lastLaunchTime: Timestamp.fromMillis(lastLaunchMillis),
  });

  // Add some sub docs to make sure they are deleted
  await newRoot.collection("users").doc().set({
    uid: "test-user",
  });

  return newRoot;
}

async function writeDatabaseRoot(rootId: string) {
  getDatabase().ref("qa").child(rootId).set({someField: "firebase realtime database"});
}

// In other tests we use firebase-functions-test to wrap the function.
// In this case it would look like:
//   const wrapped = fft.wrap(atMidnight);
// However the wrapper doesn't support onSchedule:
// - The Typescript types don't allow it
// - at run time it doesn't pass the right event:
//   https://github.com/firebase/firebase-functions-test/issues/210
// So instead the code is separated from the onSchedule and called directly.

describe("atMidnight", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref().set(null);
  });

  test("clean up firestore roots with no database roots", async () => {
    await writeFirestoreRoot();
    await runAtMidnight();

    const roots = await getFirestore().collection("qa").get();
    expect(roots.size).toBe(0);
    expect(logger.info)
      .toHaveBeenCalledWith("Found 1 roots to delete");
  });

  test("clean up firestore root and database root", async () => {
    const firestoreRoot = await writeFirestoreRoot();
    await writeDatabaseRoot(firestoreRoot.id);

    await runAtMidnight();

    const fsRoots = await getFirestore().collection("qa").get();
    expect(fsRoots.size).toBe(0);
    const dbRoots = await getDatabase().ref("qa").get();
    expect(dbRoots.val()).toEqual(null);
    expect(logger.info)
      .toHaveBeenCalledWith("Found 1 roots to delete");
  });

  test("only clean up firestore roots older than 6 hours", async () => {
    await writeFirestoreRoot(Date.now() - HOUR);
    await writeFirestoreRoot(Date.now() - 2*HOUR);
    await writeFirestoreRoot(Date.now() - 5*HOUR);
    await writeFirestoreRoot(Date.now() - 8*HOUR);
    await writeFirestoreRoot(Date.now() - 24*HOUR);

    await runAtMidnight();

    const roots = await getFirestore().collection("qa").get();
    expect(roots.size).toBe(3);
    expect(logger.info)
      .toHaveBeenCalledWith("Found 2 roots to delete");
  });

  afterAll(async () => {
    await cleanup();
  });
});
