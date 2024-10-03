import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import {initialize, projectConfig} from "./initialize";
import {onAnalysisDocumentPending} from "../src/on-analysis-document-pending";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
  });

  describe("onAnalysisDocumentPending", () => {
    test("runs when queued document is pending", async () => {
      const wrapped = fft.wrap(onAnalysisDocumentPending);

      await wrapped({
        data: makeDocumentSnapshot({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          docUpdated: "1001",
          evaluator: "categorize-design",
        }, "analysis/queue/pending/testdoc1"),
        params: {
          docId: "testdoc1",
        },
        document: "analysis/queue/pending/testdoc1",
      });

      expect(logger.warn).not.toHaveBeenCalled();

      // Document should have been removed from pending queue, and added to "imaged" queue.

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = admin.firestore().collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(1);

      await imagedQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          docUpdated: "1001",
          evaluator: "categorize-design",
          docImaged: expect.any(Object),
          docImageUrl: "https://placehold.co/300x20?text=Wheelbarrow+design",
        });
      });

      const doneQueue = admin.firestore().collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedAnalyzingQueue = admin.firestore().collection("analysis/queue/failedAnalyzing");
      expect(await failedAnalyzingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedImagingQueue = admin.firestore().collection("analysis/queue/failedImaging");
      expect(await failedImagingQueue.count().get().then((result) => result.data().count)).toEqual(0);
    });

    test("does not process doc with unknown evaluator", async () => {
      const wrapped = fft.wrap(onAnalysisDocumentPending);

      await wrapped({
        data: makeDocumentSnapshot({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          docUpdated: "1001",
          evaluator: "does-not-exist",
        }, "analysis/queue/pending/testdoc1"),
        params: {
          docId: "testdoc1",
        },
        document: "analysis/queue/pending/testdoc1",
      });

      expect(logger.warn).toHaveBeenCalledWith(
        "Error processing document", "analysis/queue/pending/testdoc1",
        "Unexpected value for evaluator: does-not-exist");

      // Document should have been removed from pending folder, and added to error folder.

      const pendingQueue = admin.firestore().collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = admin.firestore().collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const doneQueue = admin.firestore().collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedAnalyzingQueue = admin.firestore().collection("analysis/queue/failedAnalyzing");
      expect(await failedAnalyzingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedImagingQueue = admin.firestore().collection("analysis/queue/failedImaging");
      expect(await failedImagingQueue.count().get().then((result) => result.data().count)).toEqual(1);

      await failedImagingQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          docUpdated: "1001",
          evaluator: "does-not-exist",
          error: "Unexpected value for evaluator: does-not-exist",
        });
      });
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
