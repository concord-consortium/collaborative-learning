import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
// import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";

import {initialize, projectConfig} from "./initialize";
import {onProcessingQueueWritten} from "../src/send-to-ai";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
  });

  describe("onProcessingQueueWritten", () => {
    test("triggers on queue document creation", async () => {
      const wrapped = fft.wrap(onProcessingQueueWritten);

      await getDatabase().ref("demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1").set({
        otherMetadata: "blah",
        lastUpdatedAt: "1001",
      });

      const event = {
        params: {
          docId: "testdoc1",
        },
      };

      await wrapped(event);

      // expect(logger.info)
      //   .toHaveBeenCalledWith("Document update noticed",
      //     "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/lastUpdatedAt",
      //     "democlass1", "1", "testdoc1" );

      // await getDatabase().ref("demo/AI/portals/demo/aiProcessingQueue").once("value", (snapshot) => {
      //   const queue = snapshot.val();
      //   expect(Object.keys(queue)).toHaveLength(1);
      //   expect(queue).toEqual({
      //     testdoc1: {
      //       metadataPath: "classes/democlass1/users/1/documentMetadata/testdoc1",
      //       updated: "1001",
      //       status: "unanalyzed",
      //     },
      //   });
      // });
    }, 10000); // Increase timeout for OpenAI API call
  });

  afterAll(async () => {
    await cleanup();
  });
});
