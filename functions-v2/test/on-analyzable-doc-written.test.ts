import {
  clearFirestoreData,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";

import {initialize, projectConfig} from "./initialize";
import {onAnalyzableDocWritten} from "../src/on-analyzable-doc-written";
import {makeChange} from "firebase-functions-test/lib/v1";
import {makeDataSnapshot} from "firebase-functions-test/lib/providers/database";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await admin.firestore().collection("analysis").doc("queue").create({});
    await getDatabase().ref("demo").set(null);
  });

  describe("onAnalyzableDocWritten", () => {
    test("triggers on lastUpdateAt field creation", async () => {
      const wrapped = fft.wrap(onAnalyzableDocWritten);

      const before = makeDataSnapshot(null,
        "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/categorize-design");
      const after = makeDataSnapshot("1001",
        "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1/evaluation/categorize-design");
      const delta = makeChange(before, after);

      await wrapped({
        data: delta,
        params: {
          classId: "democlass1",
          userId: "1",
          docId: "testdoc1",
          evaluator: "categorize-design",
        }});

      expect(logger.info)
        .toHaveBeenCalledWith("Added document testdoc1 to queue for categorize-design");

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await pendingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          docUpdated: "1001",
          evaluator: "categorize-design",
        });
      });
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
