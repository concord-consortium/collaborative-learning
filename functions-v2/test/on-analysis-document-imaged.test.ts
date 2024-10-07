/* eslint-disable max-len */
import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";

import {initialize, projectConfig} from "./initialize";
import {onAnalysisDocumentImaged} from "../src/on-analysis-document-imaged";

jest.mock("firebase-functions/logger");

const categorizeUrl = jest.fn();
jest.mock("../lib/src/ai-categorize-document", () => ({
  categorizeUrl: (file:string) => categorizeUrl(file),
}));

const {fft, cleanup} = initialize();

const sampleDoc = {
  metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
  docUpdated: "1001",
  docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
  evaluator: "categorize-design",
};

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
  });

  describe("onAnalysisDocumentImaged", () => {
    test("creates comment when queued document is imaged", async () => {
      categorizeUrl.mockResolvedValueOnce({
        choices: [{
          message: {
            parsed: {
              success: true,
              category: "category",
              discussion: "Discussion.",
              keyIndicators: ["key1", "key2"],
            },
          },
        }],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 2,
        },
      });
      const wrapped = fft.wrap(onAnalysisDocumentImaged);
      const firestore = admin.firestore();

      await wrapped({
        data: makeDocumentSnapshot(sampleDoc, "analysis/queue/imaged/testdoc1"),
        params: {
          docId: "testdoc1",
        },
      });

      expect(logger.info)
        .toHaveBeenLastCalledWith("Creating comment for",
          "analysis/queue/imaged/testdoc1");
      expect(logger.warn).not.toHaveBeenCalled();

      // Document should have been removed from "imaged" queue and added to "done"

      const pendingQueue = firestore.collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = firestore.collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const doneQueue = firestore.collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await doneQueue.get().then((snapshot) => {
        snapshot.forEach((doc) => {
          expect(doc.data()).toEqual({
            metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
            documentId: "testdoc1",
            docUpdated: "1001",
            completedAt: expect.any(Object),
            docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
            evaluator: "categorize-design",
            promptTokens: 1,
            completionTokens: 2,
            fullResponse: "{\"choices\":[{\"message\":{\"parsed\":{\"success\":true,\"category\":\"category\",\"discussion\":\"Discussion.\",\"keyIndicators\":[\"key1\",\"key2\"]}}}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2}}",
          });
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
          content: "Discussion. Key Indicators: key1, key2",
          tags: ["category"],
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
      });
    });

    test("creates comment with no tags when AI doesn't assign a category", async () => {
      categorizeUrl.mockResolvedValueOnce({
        choices: [{
          message: {
            parsed: {
              success: false,
              category: "unknown",
              discussion: "Discussion.",
              keyIndicators: [],
            },
          },
        }],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 2,
        },
      });
      const wrapped = fft.wrap(onAnalysisDocumentImaged);
      const firestore = admin.firestore();

      await wrapped({
        data: makeDocumentSnapshot(sampleDoc, "analysis/queue/imaged/testdoc1"),
        params: {
          docId: "testdoc1",
        },
      });

      expect(logger.info)
        .toHaveBeenLastCalledWith("Creating comment for",
          "analysis/queue/imaged/testdoc1");
      expect(logger.warn).not.toHaveBeenCalled();

      // Document should have been removed from "imaged" queue and added to "done"

      const pendingQueue = firestore.collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = firestore.collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const doneQueue = firestore.collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(1);
      await doneQueue.get().then((snapshot) => {
        snapshot.forEach((doc) => {
          expect(doc.data()).toEqual({
            metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
            documentId: "testdoc1",
            docUpdated: "1001",
            completedAt: expect.any(Object),
            docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
            evaluator: "categorize-design",
            promptTokens: 1,
            completionTokens: 2,
            fullResponse: "{\"choices\":[{\"message\":{\"parsed\":{\"success\":false,\"category\":\"unknown\",\"discussion\":\"Discussion.\",\"keyIndicators\":[]}}}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2}}",
          });
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
          content: "Discussion.",
          tags: [],
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
      });
    });

    test("fails when AI refuses request", async () => {
      categorizeUrl.mockResolvedValueOnce({
        choices: [{
          message: {
            refusal: "AI reason",
            parsed: undefined,
          },
        }],
      });
      const wrapped = fft.wrap(onAnalysisDocumentImaged);
      const firestore = admin.firestore();

      await wrapped({
        data: makeDocumentSnapshot(sampleDoc, "analysis/queue/imaged/testdoc1"),
        params: {
          docId: "testdoc1",
        },
      });

      expect(logger.info)
        .toHaveBeenLastCalledWith("Creating comment for",
          "analysis/queue/imaged/testdoc1");
      expect(logger.warn)
        .toHaveBeenLastCalledWith("Error processing document",
          "analysis/queue/imaged/testdoc1", "AI refusal: AI reason");

      // Document should have been removed from "imaged" queue and added to "failedAnalyzing"

      const pendingQueue = firestore.collection("analysis/queue/pending");
      expect(await pendingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const imagedQueue = firestore.collection("analysis/queue/imaged");
      expect(await imagedQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const doneQueue = firestore.collection("analysis/queue/done");
      expect(await doneQueue.count().get().then((result) => result.data().count)).toEqual(0);

      const failedAnalyzingQueue = firestore.collection("analysis/queue/failedAnalyzing");
      expect(await failedAnalyzingQueue.count().get().then((result) => result.data().count)).toEqual(1);

      await failedAnalyzingQueue.get().then((snapshot) => {
        snapshot.forEach((doc) => {
          expect(doc.data()).toEqual({
            metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
            documentId: "testdoc1",
            docUpdated: "1001",
            docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
            evaluator: "categorize-design",
            error: "AI refusal: AI reason",
          });
        });
      });
      const failedImagingQueue = firestore.collection("analysis/queue/failedImaging");
      expect(await failedImagingQueue.count().get().then((result) => result.data().count)).toEqual(0);

      // Comment should not have been created

      const comments = firestore.collection("demo/AI/documents/testdoc1/comments");
      await comments.count().get().then((result) => expect(result.data().count).toBe(0));
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
