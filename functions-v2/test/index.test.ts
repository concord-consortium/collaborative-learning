import initializeFFT from "firebase-functions-test";
import * as logger from "firebase-functions/logger";
import {updateClassDocNetworksOnUserChange} from "../src";

jest.mock("firebase-functions/logger");

// process.env["FIRESTORE_EMULATOR_HOST"]="127.0.0.1:8080";
const projectConfig = {projectId: "demo-test"};
const fft = initializeFFT(projectConfig);

describe("functions", () => {
  beforeEach(async () => {
    // await clearFirestoreData(projectConfig);
  });

  test("updateClassDocNetworksOnUserChange", async () => {
    const wrapped = fft.wrap(updateClassDocNetworksOnUserChange);

    const beforeSnap = fft.firestore.makeDocumentSnapshot(
      {foo: "bar"}, "demo/test/users/1234");
    const afterSnap = fft.firestore.makeDocumentSnapshot(
      {foo: "bar2"}, "demo/test/users/1234");

    const event = {
      before: beforeSnap,
      after: afterSnap,
      params: {
        root: "demo",
        space: "test",
        userId: "1234",
      },
    };

    await wrapped(event);

    expect(logger.info)
      .toHaveBeenCalledWith("User updated", "demo/test/users/1234" );
  });
});
