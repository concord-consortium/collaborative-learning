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
import {onAnalysisDocumentImaged, representationsOf} from "../src/on-analysis-document-imaged";
import {buildZodResponseSchema, buildImageMessages} from "../lib/src/ai-categorize-document";
import {ZodArray, ZodEnum, ZodString} from "zod";

jest.mock("firebase-functions/logger");

const categorizeRepresentations = jest.fn();
jest.mock("../lib/src/ai-categorize-document", () => {
  const actual = jest.requireActual("../lib/src/ai-categorize-document");
  return {
    categorizeRepresentations: (...args: unknown[]) => categorizeRepresentations(...args),
    buildZodResponseSchema: actual.buildZodResponseSchema,
    buildImageMessages: actual.buildImageMessages,
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

function mockCategorizeResponse({
  parsed,
  usage = {prompt_tokens: 1, completion_tokens: 2},
  refusal,
  messageShape = "image-only",
}: {
  parsed?: { category: string, discussion: string, keyIndicators: string[] },
  usage?: { prompt_tokens: number, completion_tokens: number },
  refusal?: string,
  messageShape?: string,
}) {
  categorizeRepresentations.mockResolvedValueOnce({
    completion: {
      choices: [{
        message: {
          parsed,
          refusal,
        },
      }],
      usage,
    },
    messageShape,
  });
}

// The representations the mock was asked to send, from its most recent call.
function sentRepresentations() {
  return categorizeRepresentations.mock.calls[0][0];
}

// A record in the shape the current producer writes. Pass a field as undefined to leave it out;
// Firestore cannot encode undefined, so it has to be absent rather than present and empty.
function versionTwoDoc(fields: Record<string, unknown>) {
  const doc: Record<string, unknown> = {
    ...sampleDoc,
    analysisVersion: 2,
    classification: {
      modality: "mixed", hasStudentText: true, summaryCarriesStudentWork: true, needsImage: true,
    },
    renderTarget: {clueUrl: "https://collaborative-learning.concord.org/authoring-iframe/index.html", unit: "vibe"},
    ...fields,
  };
  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) delete doc[key];
  }
  return doc;
}

describe("functions", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    await getDatabase().ref("demo").set(null);
    jest.clearAllMocks();
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
      mockCategorizeResponse({
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
            messageShape: "image-only",
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
          content: "Discussion. Your work shows: key1, key2",
          tags: ["category"],
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
      });
    });

    test("creates comment when queued document is imaged", async () => {
      mockCategorizeResponse({
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
            messageShape: "image-only",
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
          content: "Discussion. Your work shows: key1, key2",
          tags: ["category"],
          createdAt: expect.any(Object),
          name: "Ada Insight",
          uid: "ada_insight_1",
        });
      });
    });

    test("creates comment with no tags when AI doesn't assign a category", async () => {
      mockCategorizeResponse({
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
            messageShape: "image-only",
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
      mockCategorizeResponse({
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
        .toHaveBeenLastCalledWith("onAnalysisDocumentImaged");
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

  describe("representationsOf", () => {
    const target = {clueUrl: "https://example.com/iframe.html", unit: "vibe"};

    test("reads a legacy text record from its summarizer field", () => {
      // Written by the previous producer during a deploy: one representation, named by `summarizer`.
      expect(representationsOf({summarizer: "text", docSummary: "A summary", docImageUrl: "https://x/y.png"}))
        .toEqual({summary: "A summary", imageUrl: null});
    });

    test("reads a legacy image record the same way", () => {
      expect(representationsOf({summarizer: "image", docSummary: "A summary", docImageUrl: "https://x/y.png"}))
        .toEqual({summary: null, imageUrl: "https://x/y.png"});
    });

    test("sends both when a version-2 record says so", () => {
      expect(representationsOf({
        analysisVersion: 2, renderTarget: target,
        sendSummary: true, docSummary: "A summary",
        sendImage: true, docImageUrl: "https://x/y.png",
      })).toEqual({summary: "A summary", imageUrl: "https://x/y.png"});
    });

    test("withholds a stored summary that is not being sent", () => {
      // The producer stores an unsent summary for auditing. Sending it anyway would evaluate a
      // document on text the classification said not to use.
      expect(representationsOf({
        analysisVersion: 2, renderTarget: target,
        sendSummary: false, docSummary: "A summary", summaryOmittedReason: "no-student-work-in-summary",
        sendImage: true, docImageUrl: "https://x/y.png",
      })).toEqual({summary: null, imageUrl: "https://x/y.png"});
    });

    test("trusts the value over the flag when the two disagree", () => {
      // sendImage says there is a picture and there is no URL. The flag loses: a request built
      // around an empty string would be a paid-for evaluation of nothing.
      expect(representationsOf({
        analysisVersion: 2, renderTarget: target,
        sendSummary: true, docSummary: "A summary",
        sendImage: true,
      })).toEqual({summary: "A summary", imageUrl: null});
    });

    test("gives nothing when a version-2 record sends neither", () => {
      expect(representationsOf({
        analysisVersion: 2, renderTarget: target, sendSummary: false, sendImage: false,
      })).toEqual({summary: null, imageUrl: null});
    });
  });

  describe("what the imaged function sends", () => {
    const parsed = {category: "category", discussion: "Discussion.", keyIndicators: ["key1", "key2"]};

    async function runImaged(doc: Record<string, unknown>) {
      const wrapped = fft.wrap(onAnalysisDocumentImaged);
      await wrapped({
        data: makeDocumentSnapshot(doc, "analysis/queue/imaged/testdoc1"),
        params: {docId: "testdoc1"},
      });
    }

    const doneRecord = () => admin.firestore().collection("analysis/queue/done").get()
      .then((snapshot) => snapshot.docs[0]?.data());

    test("a mixed record sends both representations", async () => {
      mockCategorizeResponse({parsed, messageShape: "mixed"});

      await runImaged(versionTwoDoc({
        sendSummary: true, docSummary: "A summary",
        sendImage: true, docImageUrl: "https://x/y.png",
      }));

      expect(sentRepresentations()).toEqual({summary: "A summary", imageUrl: "https://x/y.png"});
      // The producer's fields ride through to `done` on the spread, which is what the harness and
      // the survey script read.
      expect(await doneRecord()).toMatchObject({
        messageShape: "mixed",
        analysisVersion: 2,
        classification: {modality: "mixed", hasStudentText: true, needsImage: true},
        sendSummary: true,
        sendImage: true,
        renderTarget: {unit: "vibe"},
      });
    });

    test("a summary-only record sends no image", async () => {
      mockCategorizeResponse({parsed, messageShape: "summary-only"});

      await runImaged(versionTwoDoc({
        classification: {
          modality: "text-only", hasStudentText: true, summaryCarriesStudentWork: true,
          needsImage: false,
        },
        sendSummary: true, docSummary: "A summary",
        sendImage: false, imageOmittedReason: "no-visual-content",
        docImageUrl: undefined,
      }));

      expect(sentRepresentations()).toEqual({summary: "A summary", imageUrl: null});
      expect(await doneRecord()).toMatchObject({
        messageShape: "summary-only",
        sendSummary: true,
        sendImage: false,
        imageOmittedReason: "no-visual-content",
      });
    });

    test("an image-only record sends no summary", async () => {
      mockCategorizeResponse({parsed, messageShape: "image-only"});

      await runImaged(versionTwoDoc({
        classification: {
          modality: "visual-only", hasStudentText: false, summaryCarriesStudentWork: true,
          needsImage: true,
        },
        sendSummary: false, docSummary: "A summary", summaryOmittedReason: "no-student-work-in-summary",
        sendImage: true, docImageUrl: "https://x/y.png",
      }));

      expect(sentRepresentations()).toEqual({summary: null, imageUrl: "https://x/y.png"});
      expect(await doneRecord()).toMatchObject({
        messageShape: "image-only",
        sendSummary: false,
        summaryOmittedReason: "no-student-work-in-summary",
        sendImage: true,
      });
    });

    test("a record with nothing to send fails the analysis instead of asking the model", async () => {
      categorizeRepresentations.mockRejectedValueOnce(new Error("no representation to send"));

      await runImaged(versionTwoDoc({sendSummary: false, sendImage: false, docImageUrl: undefined}));

      expect(await admin.firestore().collection("analysis/queue/done").count().get()
        .then((result) => result.data().count)).toEqual(0);
      const failed = await admin.firestore().collection("analysis/queue/failedAnalyzing").get()
        .then((snapshot) => snapshot.docs[0]?.data());
      expect(failed?.error).toContain("no representation to send");
      // No comment was posted on the student's document.
      expect(await admin.firestore().collection("demo/AI/documents/testdoc1/comments").count().get()
        .then((result) => result.data().count)).toEqual(0);
    });

    test("no response from the model fails the analysis", async () => {
      mockCategorizeResponse({parsed: undefined});

      await runImaged(versionTwoDoc({sendSummary: true, docSummary: "A summary", sendImage: false}));

      expect(logger.warn).toHaveBeenLastCalledWith("Error processing document",
        "analysis/queue/imaged/testdoc1", "No response from AI");
      expect(await admin.firestore().collection("analysis/queue/failedAnalyzing").count().get()
        .then((result) => result.data().count)).toEqual(1);
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
