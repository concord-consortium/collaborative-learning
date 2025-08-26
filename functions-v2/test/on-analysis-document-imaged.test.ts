/* eslint-disable max-len */
import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";
import {initialize, projectConfig} from "./initialize";
import {onAnalysisDocumentImaged} from "../src/on-analysis-document-imaged";
import {buildZodResponseSchema, buildImageMessages} from "../lib/src/ai-categorize-document";
import {ZodArray, ZodEnum, ZodString} from "zod";

jest.mock("firebase-functions/logger");

const categorizeUrl = jest.fn();
jest.mock("../lib/src/ai-categorize-document", () => {
  const actual = jest.requireActual("../lib/src/ai-categorize-document");
  return {
    categorizeUrl: (file: string) => categorizeUrl(file),
    buildZodResponseSchema: actual.buildZodResponseSchema,
    buildMessages: actual.buildMessages,
  };
});

const {fft, cleanup} = initialize();

// The emulator should pick up a local value for the secret from this file, to avoid the local user needing
// permissions to access the actual secret in the cloud.
// firebase-functions-test doesn't support this, though, so we need this workaround which pulls it into the env.
// See https://github.com/firebase/firebase-tools/issues/5520#issuecomment-1900545942
// and https://github.com/firebase/firebase-functions-test/issues/196#issuecomment-1900541854
dotenv.config({
  path: path.resolve(__dirname, "../.secret.local"),
});

const sampleDoc = {
  metadataPath: "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1",
  documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
  commentsPath: "demo/AI/documents/testdoc1/comments",
  docUpdated: "1001",
  docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
  evaluator: "categorize-design",
};

function mockCategorizeUrlResponse({
  parsed,
  usage = {prompt_tokens: 1, completion_tokens: 2},
  refusal,
}: {
  parsed?: { category: string, discussion: string, keyIndicators: string[] },
  usage?: { prompt_tokens: number, completion_tokens: number },
  refusal?: string,
}) {
  categorizeUrl.mockResolvedValueOnce({
    choices: [{
      message: {
        parsed,
        refusal,
      },
    }],
    usage,
  });
}

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
  });

  describe("buildZodResponseSchema", () => {
    test("creates discussion-only schema", () => {
      const schema = buildZodResponseSchema({
        systemPrompt: "You are a master teacher.",
        mainPrompt: "Evaluate this.",
        discussionPrompt: "Discussion.",
      });
      expect(schema).toEqual({
        discussion: expect.any(ZodString),
      });
    });

    test("creates categorization-only schema", () => {
      const schema = buildZodResponseSchema({
        systemPrompt: "You are a master teacher.",
        mainPrompt: "Categorize this.",
        categorizationDescription: "Categorize the document based on its content.",
        categories: ["category1", "category2"],
      });
      expect(schema).toEqual({
        category: expect.any(ZodEnum),
      });
    });

    test("creates categorization-and-discussion schema", () => {
      const schema = buildZodResponseSchema({
        systemPrompt: "You are a master teacher.",
        mainPrompt: "Evaluate and categorize this.",
        categorizationDescription: "Categorize the document based on its content.",
        categories: ["category1", "category2"],
        discussionPrompt: "Discussion.",
      });
      expect(schema).toEqual({
        category: expect.any(ZodEnum),
        discussion: expect.any(ZodString),
      });
    });

    test("creates full schema", () => {
      const schema = buildZodResponseSchema({
        systemPrompt: "You are a master teacher.",
        mainPrompt: "Evaluate and categorize this.",
        categorizationDescription: "Categorize the document based on its content.",
        categories: ["category1", "category2"],
        keyIndicatorsPrompt: "Key indicators.",
        discussionPrompt: "Discussion.",
      });
      expect(schema).toEqual({
        category: expect.any(ZodEnum),
        discussion: expect.any(ZodString),
        keyIndicators: expect.any(ZodArray),
      });
    });
  });

  describe("buildMessages", () => {
    test("creates messages", () => {
      const messages = buildImageMessages(
        {
          systemPrompt: "You are a master teacher.",
          mainPrompt: "Evaluate this.",
          categorizationDescription: "Categorize the document based on its content.",
          categories: ["category1", "category2"],
          keyIndicatorsPrompt: "Key indicators.",
          discussionPrompt: "Discussion.",
        },
        "https://example.com/image.png",
      );
      expect(messages).toEqual([
        {
          role: "system",
          content: "You are a master teacher.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Evaluate this.",
            },
            {
              type: "image_url",
              image_url: {
                url: "https://example.com/image.png",
                detail: "auto",
              },
            },
          ],
        },
      ]);
    });
  });

  describe("onAnalysisDocumentImaged", () => {
    test("uses mock evaluator when specified", async () => {
      const wrapped = fft.wrap(onAnalysisDocumentImaged);
      const firestore = admin.firestore();
      const doc = {...sampleDoc, evaluator: "mock"};

      await wrapped({
        data: makeDocumentSnapshot(doc, "analysis/queue/imaged/testdoc1"),
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
            documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
            commentsPath: "demo/AI/documents/testdoc1/comments",
            documentId: "testdoc1",
            docUpdated: "1001",
            completedAt: expect.any(Object),
            docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
            evaluator: "mock",
            promptTokens: 0,
            completionTokens: 0,
            fullResponse: "",
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
          content: "Mock reply from AI analysis",
          tags: [],
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
      });
    });

    test("uses custom evaluator when specified", async () => {
      mockCategorizeUrlResponse({
        parsed: {
          category: "category",
          discussion: "Discussion.",
          keyIndicators: ["key1", "key2"],
        },
      });
      const wrapped = fft.wrap(onAnalysisDocumentImaged);
      const firestore = admin.firestore();
      const aiPrompt = {
        mainPrompt: "Main prompt",
        categorizationDescription: "Categorization description",
        categories: ["category1", "category2"],
        keyIndicatorsPrompt: "Key indicators prompt",
        discussionPrompt: "Discussion prompt",
        systemPrompt: "You are a teaching assistant in an engineering design course.",
      };
      const doc = {...sampleDoc, evaluator: "custom", aiPrompt};

      await wrapped({
        data: makeDocumentSnapshot(doc, "analysis/queue/imaged/testdoc1"),
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
            documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
            commentsPath: "demo/AI/documents/testdoc1/comments",
            documentId: "testdoc1",
            docUpdated: "1001",
            completedAt: expect.any(Object),
            docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
            evaluator: "custom",
            promptTokens: 1,
            completionTokens: 2,
            fullResponse: "{\"choices\":[{\"message\":{\"parsed\":{\"category\":\"category\",\"discussion\":\"Discussion.\",\"keyIndicators\":[\"key1\",\"key2\"]}}}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2}}",
            aiPrompt: {
              mainPrompt: "Main prompt",
              categorizationDescription: "Categorization description",
              categories: ["category1", "category2"],
              keyIndicatorsPrompt: "Key indicators prompt",
              discussionPrompt: "Discussion prompt",
              systemPrompt: "You are a teaching assistant in an engineering design course.",
            },
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

    test("creates comment when queued document is imaged", async () => {
      mockCategorizeUrlResponse({
        parsed: {
          category: "category",
          discussion: "Discussion.",
          keyIndicators: ["key1", "key2"],
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
            documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
            commentsPath: "demo/AI/documents/testdoc1/comments",
            documentId: "testdoc1",
            docUpdated: "1001",
            completedAt: expect.any(Object),
            docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
            evaluator: "categorize-design",
            promptTokens: 1,
            completionTokens: 2,
            fullResponse: "{\"choices\":[{\"message\":{\"parsed\":{\"category\":\"category\",\"discussion\":\"Discussion.\",\"keyIndicators\":[\"key1\",\"key2\"]}}}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2}}",
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
      mockCategorizeUrlResponse({
        parsed: {
          category: "unknown",
          discussion: "Discussion.",
          keyIndicators: [],
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
            documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
            commentsPath: "demo/AI/documents/testdoc1/comments",
            documentId: "testdoc1",
            docUpdated: "1001",
            completedAt: expect.any(Object),
            docImageUrl: "https://concord.org/wp-content/uploads/2024/05/capturing-moths-fig-2.png",
            evaluator: "categorize-design",
            promptTokens: 1,
            completionTokens: 2,
            fullResponse: "{\"choices\":[{\"message\":{\"parsed\":{\"category\":\"unknown\",\"discussion\":\"Discussion.\",\"keyIndicators\":[]}}}],\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2}}",
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
      mockCategorizeUrlResponse({
        refusal: "AI reason",
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
            documentPath: "demo/AI/portals/demo/classes/democlass1/users/1/documents/testdoc1",
            commentsPath: "demo/AI/documents/testdoc1/comments",
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
