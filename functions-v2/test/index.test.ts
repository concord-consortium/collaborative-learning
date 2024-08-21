import initializeFFT from "firebase-functions-test";
import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {updateClassDocNetworksOnUserChange} from "../src";

jest.mock("firebase-functions/logger");

process.env["FIRESTORE_EMULATOR_HOST"]="127.0.0.1:8088";
const projectConfig = {projectId: "demo-test"};
const fft = initializeFFT(projectConfig);

// const app = admin.initializeApp(projectConfig);
admin.initializeApp(projectConfig);

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
  });

  test("updateClassDocNetworksOnUserChange", async () => {
    const wrapped = fft.wrap(updateClassDocNetworksOnUserChange);

    const beforeSnap = fft.firestore.makeDocumentSnapshot({
      uid: "1234",
      type: "teacher",
    }, "demo/test/users/1234");
    const afterSnap = fft.firestore.makeDocumentSnapshot({
      uid: "1234",
      type: "teacher",
      networks: ["test-network"],
    }, "demo/test/users/1234");

    const event = {
      before: beforeSnap,
      after: afterSnap,
      params: {
        root: "demo",
        space: "test",
        userId: "1234",
      },
    };

    const classesCollection = admin.firestore().collection("demo/test/classes");
    const newDocRef = classesCollection.doc("testclass-1");

    await newDocRef
      .set({
        context_id: "testclass-1",
        id: "1",
        teachers: ["1234"],
        uri: "https://example.concord.org/classes/1",
      });

    await classesCollection
      .doc("testclass-2")
      .set({
        context_id: "testclass-2",
        id: "2",
        teachers: ["1235"],
        uri: "https://example.concord.org/classes/2",
      });

    await wrapped(event);

    expect(logger.info)
      .toHaveBeenCalledWith("User updated", "demo/test/users/1234" );
  });
});
