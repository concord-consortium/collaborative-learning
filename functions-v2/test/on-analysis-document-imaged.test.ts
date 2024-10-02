import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
// import {makeChange} from "firebase-functions-test/lib/v1";

import {initialize, projectConfig} from "./initialize";
import {onAnalysisDocumentImaged} from "../src/on-analysis-document-imaged";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
  });

  describe("onAnalysisDocumentImaged", () => {
    test("creates comment when queued document is imaged", async () => {
      const wrapped = fft.wrap(onAnalysisDocumentImaged);
      const firestore = admin.firestore();

      await wrapped({
        data: makeDocumentSnapshot({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          docUpdated: "1001",
          docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
        }, "analysis/queue/imaged/testdoc1"),
        params: {
          docId: "testdoc1",
        },
      });

      expect(logger.info)
        .toHaveBeenLastCalledWith("Creating comment for",
          "analysis/queue/imaged/testdoc1");

      // Document should have been removed from "imaged" queue and added to "done"

      const pendingQueue = firestore.collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = firestore.collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const doneQueue = firestore.collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await doneQueue.doc("testdoc1").get().then((result) => {
        expect(result.data()).toEqual({
          metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
          docUpdated: "1001",
          completedAt: expect.any(Object),
          docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
        });
      });

      const failedAnalyzingQueue = firestore.collection("analysis/queue/failedAnalyzing");
      expect(await failedAnalyzingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedImagingQueue = firestore.collection("analysis/queue/failedImaging");
      expect(await failedImagingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      // Comment should have been created

      const comments = firestore.collection("demo/AI/documents/testdoc1/comments");
      await comments.get().then((snapshot) => {
        expect(snapshot.size).toBe(1);
        const comment = snapshot.docs[0].data();
        expect(comment).toEqual({
          content: expect.stringMatching(/Key Indicators:/),
          tags: expect.any(Array),
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
      });
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
