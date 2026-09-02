/* eslint-disable max-len */
import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as logger from "firebase-functions/logger";
import {getDatabase} from "firebase-admin/database";
import * as admin from "firebase-admin";
import {DocumentReference, FieldValue} from "@google-cloud/firestore";
import * as dotenv from "dotenv";
import * as path from "path";
import {initialize, projectConfig} from "./initialize";
import {onAnalysisDocumentImaged, representationsOf} from "../src/on-analysis-document-imaged";
import {onCommentRated} from "../src/on-comment-rated";
import {getSummaryPath} from "../src/utils";
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

// `key` is deliberately not the queue record's `docId`: an older document's metadata id carries a
// uid or network prefix, and both writers derive the summary's path from `key` instead.
const documentMetadata = {
  root: "demo",
  space: "AI",
  key: "doc-key-1",
  context_id: "class1",
  unit: "vibe",
  investigation: "1",
  problem: "1.1",
  offeringId: "offering-1",
};

function mockCategorizeResponse({
  parsed,
  usage = {prompt_tokens: 1, completion_tokens: 2},
  refusal,
  messageShape = "image-only",
  // Absent by default, which is what an image-only run reports.
  summaryEmbedding,
  metadata,
  metadataGap,
}: {
  parsed?: { category: string, discussion: string, keyIndicators: string[] },
  usage?: { prompt_tokens: number, completion_tokens: number },
  refusal?: string,
  messageShape?: string,
  summaryEmbedding?: number[],
  metadata?: typeof documentMetadata,
  metadataGap?: string,
}) {
  categorizeRepresentations.mockResolvedValueOnce({
    summaryEmbedding,
    documentMetadata: metadata,
    metadataGap,
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
            summaryRecorded: "no-summary-sent",
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
            summaryRecorded: "no-summary-sent",
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
            summaryRecorded: "no-summary-sent",
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
            summaryRecorded: "no-summary-sent",
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

  describe("the summary record the run leaves behind", () => {
    const parsed = {category: "category", discussion: "Discussion.", keyIndicators: []};
    const embedding = [0.1, 0.2, 0.3];
    const summaryPath = getSummaryPath(documentMetadata.root, documentMetadata.space, documentMetadata.key);
    const commentsPath = "demo/AI/documents/testdoc1/comments";

    // The only case that records anything.
    const summarySent = () => versionTwoDoc({
      sendSummary: true, docSummary: "The student's work.",
      sendImage: false, docImageUrl: undefined,
    });

    async function runImaged(doc: Record<string, unknown>) {
      await fft.wrap(onAnalysisDocumentImaged)({
        data: makeDocumentSnapshot(doc, "analysis/queue/imaged/testdoc1"),
        params: {docId: "testdoc1"},
      });
    }

    const readSummary = () => admin.firestore().doc(summaryPath).get();

    const doneRecord = () => admin.firestore().collection("analysis/queue/done").get()
      .then((snapshot) => snapshot.docs[0]?.data());

    // An agreement of the shape onCommentRated writes.
    const anAgreement = () => ({
      "comment-0_student-1": {
        version: 2, value: "yes", raterUid: "student-1", commentId: "comment-0",
        commentUid: "ada_insight_1", isAiComment: true, content: "Ada said something.",
        tags: [], updatedAt: 1_700_000_000_000,
      },
    });

    test("a first analysis creates the record with no agreements and both counts at zero", async () => {
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});

      await runImaged(summarySent());

      const record = await readSummary();
      expect(record.exists).toBe(true);
      expect(record.data()).toEqual({
        ...documentMetadata,
        summary: "The student's work.",
        summaryEmbedding: FieldValue.vector(embedding),
        analyzedAt: expect.any(Number),
        adaCommentId: expect.any(String),
        aiAgreements: {},
        numAiAgreements: 0,
        numAgreements: 0,
      });
    });

    // `root` and `space` are optional on the Summary type, so nothing in the compiler notices if a
    // write path drops them. These two tests are the only thing that does.
    test("the created record says which realm it belongs to", async () => {
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});

      await runImaged(summarySent());

      expect(await readSummary().then((record) => record.data())).toMatchObject({root: "demo", space: "AI"});
    });

    test("a re-analysis adds the realm to a record that predates it", async () => {
      // A record written before root and space existed, which the realm-scoped lookup cannot match
      // until an analysis rewrites it.
      await admin.firestore().doc(summaryPath).set({
        key: documentMetadata.key, context_id: "class1", unit: "vibe", investigation: "1", problem: "1.1",
        summary: "An older summary.", numAiAgreements: 1, aiAgreements: anAgreement(),
      });
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});

      await runImaged(summarySent());

      expect(await readSummary().then((record) => record.data())).toMatchObject({root: "demo", space: "AI"});
    });

    test("a re-analysis refreshes the summary and leaves the agreements alone", async () => {
      await admin.firestore().doc(summaryPath).set({
        ...documentMetadata,
        summary: "An older summary.",
        summaryEmbedding: FieldValue.vector([0.9, 0.9, 0.9]),
        analyzedAt: 1_700_000_000_000,
        adaCommentId: "comment-0",
        aiAgreements: anAgreement(),
        numAiAgreements: 1,
        numAgreements: 1,
      });
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});

      await runImaged(summarySent());

      const data = await readSummary().then((record) => record.data());
      // Refreshed by this run.
      expect(data?.summary).toBe("The student's work.");
      expect(data?.summaryEmbedding).toEqual(FieldValue.vector(embedding));
      expect(data?.analyzedAt).toBeGreaterThan(1_700_000_000_000);
      expect(data?.adaCommentId).not.toBe("comment-0");
      // Left to the people who made them. An older agreement stays attached to the newer summary
      // text; that drift is accepted, and argued in the design doc.
      expect(data?.aiAgreements).toEqual(anAgreement());
      expect(data?.numAiAgreements).toBe(1);
      expect(data?.numAgreements).toBe(1);
    });

    test("the summary exists before the comment does", async () => {
      // Checked at the instant the comment becomes readable, since that is when a rating could
      // arrive and onCommentRated drops one with no summary. The comment is the only write that
      // goes through DocumentReference.set — the summary goes through the transaction — so the spy
      // intercepts the comment and nothing else.
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});
      let summaryExistedWhenCommentWasWritten: boolean | undefined;
      const realSet = DocumentReference.prototype.set;
      const spy = jest.spyOn(DocumentReference.prototype, "set")
        .mockImplementation(async function(this: DocumentReference, ...args: any[]) {
          // eslint-disable-next-line no-invalid-this, @typescript-eslint/no-this-alias
          const ref = this; // a method spy is invoked as a method, so `this` is the reference
          if (ref.path.startsWith(commentsPath)) {
            summaryExistedWhenCommentWasWritten = (await readSummary()).exists;
          }
          return realSet.apply(ref, args as any);
        });

      try {
        await runImaged(summarySent());
      } finally {
        spy.mockRestore();
      }

      expect(summaryExistedWhenCommentWasWritten).toBe(true);
    });

    test("the record names the comment this run created", async () => {
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});

      await runImaged(summarySent());

      const comments = await admin.firestore().collection(commentsPath).get();
      expect(comments.size).toBe(1);
      expect(await readSummary().then((record) => record.data()?.adaCommentId)).toBe(comments.docs[0].id);
    });

    // Runs the two writers against each other rather than comparing the helper with itself: the
    // metadata id is "testdoc1" and the key is "doc-key-1", so either one reaching for a path
    // segment would miss.
    test("a rating lands on the record the pipeline wrote", async () => {
      await admin.firestore().doc("demo/AI/documents/testdoc1").set({key: documentMetadata.key});
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});

      await runImaged(summarySent());

      const comment = (await admin.firestore().collection(commentsPath).get()).docs[0];
      const rated = {...comment.data(), ratings: {"student-1": "yes"}};
      await comment.ref.set(rated);
      await fft.wrap(onCommentRated)({
        data: {before: comment.data(), after: rated},
        params: {root: "demo", space: "AI", documentId: "testdoc1", commentId: comment.id},
        time: "2026-09-01T12:00:00.000Z",
      });

      const data = await readSummary().then((record) => record.data());
      expect(data?.numAiAgreements).toBe(1);
      expect(data?.aiAgreements[`${comment.id}_student-1`]).toMatchObject({value: "yes", isAiComment: true});
    });

    test("a mock run records nothing", async () => {
      await runImaged({...sampleDoc, evaluator: "mock"});

      expect((await readSummary()).exists).toBe(false);
      // The student still got their comment.
      expect(await admin.firestore().collection(commentsPath).count().get()
        .then((result) => result.data().count)).toBe(1);
    });

    test("a run that sent no summary records nothing", async () => {
      // What categorizeRepresentations reports for an image-only run, pinned by its own tests.
      mockCategorizeResponse({parsed, messageShape: "image-only"});

      await runImaged(versionTwoDoc({
        sendSummary: false, docSummary: "The student's work.",
        summaryOmittedReason: "no-student-work-in-summary",
        sendImage: true, docImageUrl: "https://x/y.png",
      }));

      expect((await readSummary()).exists).toBe(false);
      expect(await admin.firestore().collection(commentsPath).count().get()
        .then((result) => result.data().count)).toBe(1);
    });

    // An empty array is truthy, so a gate written as `if (summaryEmbedding)` would store a
    // zero-dimension vector no search can find.
    test("an empty embedding is not mistaken for a usable one", async () => {
      mockCategorizeResponse({
        parsed, messageShape: "summary-only", summaryEmbedding: [], metadata: documentMetadata,
      });

      await runImaged(summarySent());

      expect((await readSummary()).exists).toBe(false);
      expect(await doneRecord()).toMatchObject({summaryRecorded: "no-embedding"});
    });

    test.each([
      ["created on a first analysis", "created"],
      ["failed", "failed"],
    ])("the done record says the summary was %s", async (_label, expected) => {
      mockCategorizeResponse({
        parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata,
      });
      const spy = expected === "failed" ?
        jest.spyOn(admin.firestore.Firestore.prototype, "runTransaction")
          .mockRejectedValueOnce(new Error("Firestore unavailable")) :
        undefined;

      try {
        await runImaged(summarySent());
      } finally {
        spy?.mockRestore();
      }

      expect(await doneRecord()).toMatchObject({summaryRecorded: expected});
    });

    test("the done record says a re-analysis refreshed the record", async () => {
      await admin.firestore().doc(summaryPath).set({
        ...documentMetadata, summary: "An older summary.",
        summaryEmbedding: FieldValue.vector([0.9, 0.9, 0.9]), analyzedAt: 1_700_000_000_000,
        aiAgreements: {}, numAiAgreements: 0, numAgreements: 0,
      });
      mockCategorizeResponse({
        parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata,
      });

      await runImaged(summarySent());

      expect(await doneRecord()).toMatchObject({summaryRecorded: "refreshed"});
    });

    test("the done record distinguishes a run that sent no summary from one that failed", async () => {
      mockCategorizeResponse({parsed, messageShape: "image-only"});

      await runImaged(versionTwoDoc({
        sendSummary: false, docSummary: "The student's work.",
        summaryOmittedReason: "no-student-work-in-summary",
        sendImage: true, docImageUrl: "https://x/y.png",
      }));

      expect(await doneRecord()).toMatchObject({summaryRecorded: "no-summary-sent"});
    });

    test("the done record names a missing metadata read", async () => {
      mockCategorizeResponse({
        parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadataGap: "no-metadata",
      });

      await runImaged(summarySent());

      expect((await readSummary()).exists).toBe(false);
      expect(await doneRecord()).toMatchObject({summaryRecorded: "no-metadata"});
    });

    // A personal document has no class or problem, so it records nothing on every run. Recording
    // that apart from an unreadable document is what keeps the field worth querying: the ordinary
    // case does not drown the one worth looking at.
    test("a document with no context is recorded apart from an unreadable one", async () => {
      mockCategorizeResponse({
        parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadataGap: "no-context",
      });

      await runImaged(summarySent());

      expect((await readSummary()).exists).toBe(false);
      expect(await doneRecord()).toMatchObject({summaryRecorded: "no-context"});
      expect(await admin.firestore().collection(commentsPath).count().get()
        .then((result) => result.data().count)).toBe(1);
    });

    test("a run whose summary could not be embedded records nothing", async () => {
      // getEmbeddings resolves undefined on any OpenAI error.
      mockCategorizeResponse({parsed, messageShape: "summary-only", metadata: documentMetadata});

      await runImaged(summarySent());

      expect((await readSummary()).exists).toBe(false);
      expect(await admin.firestore().collection(commentsPath).count().get()
        .then((result) => result.data().count)).toBe(1);
    });

    test("a record that cannot be written does not cost the student their comment", async () => {
      mockCategorizeResponse({parsed, messageShape: "summary-only", summaryEmbedding: embedding, metadata: documentMetadata});
      const spy = jest.spyOn(admin.firestore.Firestore.prototype, "runTransaction")
        .mockRejectedValueOnce(new Error("Firestore unavailable"));

      try {
        await runImaged(summarySent());
      } finally {
        spy.mockRestore();
      }

      expect((await readSummary()).exists).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("Could not record the summary; continuing to the comment",
        "analysis/queue/imaged/testdoc1", expect.any(Error));
      expect(await admin.firestore().collection(commentsPath).count().get()
        .then((result) => result.data().count)).toBe(1);
      // And the run finished: the queue record moved on rather than being left to retry.
      expect(await admin.firestore().collection("analysis/queue/done").count().get()
        .then((result) => result.data().count)).toBe(1);
    });
  });

  afterAll(async () => {
    await cleanup();
  });
});
