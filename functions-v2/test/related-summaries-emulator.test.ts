import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {FieldValue, Firestore} from "@google-cloud/firestore";
import * as logger from "firebase-functions/logger";
import {initialize, projectConfig} from "./initialize";
import {
  DocumentMetadata, findRelatedSummaries, readDocumentMetadata,
} from "../lib/src/ai-categorize-document";
import {AiAgreementV2} from "../src/summary-types";

jest.mock("firebase-functions/logger");

const {cleanup} = initialize();

const db = new Firestore(projectConfig);

const demoMetadata: DocumentMetadata = {
  root: "demo",
  space: "AI",
  key: "thisdoc",
  context_id: "class1",
  unit: "vibe",
  investigation: "1",
  problem: "1.1",
  offeringId: "1234",
};

function aiRating(): AiAgreementV2 {
  return {
    version: 2,
    value: "yes",
    raterUid: "student-1",
    commentId: "comment-1",
    commentUid: "ada_insight_1",
    isAiComment: true,
    content: "Ada said something.",
    tags: [],
    updatedAt: 1_700_000_000_000,
  };
}

// A stored summary record, with only the fields the lookup filters or reads.
async function writeSummary(id: string, fields: Partial<DocumentMetadata> & {summary: string}) {
  await db.doc(`summaries/${id}`).set({
    ...demoMetadata,
    ...fields,
    summaryEmbedding: FieldValue.vector([0.1, 0.2, 0.3]),
    numAiAgreements: 1,
    numAgreements: 1,
    aiAgreements: {"comment-1_student-1": aiRating()},
    analyzedAt: 1_700_000_000_000,
  });
}

function summaryTexts(found: {summary: string}[]) {
  return found.map((related) => related.summary).sort();
}

describe("the related-summaries lookup", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("findRelatedSummaries", () => {
    it("returns a record from the same realm with matching context", async () => {
      await writeSummary("demo-AI-otherdoc", {key: "otherdoc", summary: "A peer's work."});

      const found = await findRelatedSummaries(demoMetadata, [0.1, 0.2, 0.3]);

      expect(summaryTexts(found)).toEqual(["A peer's work."]);
    });

    // Why realm scoping exists: `summaries` is one flat collection, and the open realms let a
    // signed-in user author both the context fields and the agreement counts, so without this
    // filter a record written for testing can reach a production document's prompt.
    it("does not return a record from another realm whose context fields all match", async () => {
      await writeSummary("qa-AI-otherdoc", {key: "otherdoc", root: "qa", summary: "A qa realm record."});

      const found = await findRelatedSummaries(demoMetadata, [0.1, 0.2, 0.3]);

      expect(found).toEqual([]);
    });

    it("does not return a record from another space within the same root", async () => {
      await writeSummary("demo-OTHER-otherdoc", {key: "otherdoc", space: "OTHER", summary: "Another demo space."});

      const found = await findRelatedSummaries(demoMetadata, [0.1, 0.2, 0.3]);

      expect(found).toEqual([]);
    });

    // A record predating the realm fields is dropped rather than shared across realms. Its next
    // analysis rewrites it.
    it("does not return a record written before root and space existed", async () => {
      await db.doc("summaries/demo-AI-legacydoc").set({
        key: "legacydoc",
        context_id: demoMetadata.context_id,
        unit: demoMetadata.unit,
        investigation: demoMetadata.investigation,
        problem: demoMetadata.problem,
        summary: "A record with no realm.",
        summaryEmbedding: FieldValue.vector([0.1, 0.2, 0.3]),
        numAiAgreements: 1,
        aiAgreements: {"comment-1_student-1": aiRating()},
      });

      const found = await findRelatedSummaries(demoMetadata, [0.1, 0.2, 0.3]);

      expect(found).toEqual([]);
    });

    it("keeps the filters it already had, alongside the realm ones", async () => {
      await writeSummary("demo-AI-thisdoc", {summary: "This document's own summary."});
      await writeSummary("demo-AI-otherunit", {key: "otherunit", unit: "mods", summary: "Another unit."});
      await writeSummary("demo-AI-otherclass", {key: "otherclass", context_id: "class2", summary: "Another class."});
      await db.doc("summaries/demo-AI-unrated").set({
        ...demoMetadata,
        key: "unrated",
        summary: "Nobody rated this one.",
        summaryEmbedding: FieldValue.vector([0.1, 0.2, 0.3]),
        numAiAgreements: 0,
        numAgreements: 0,
        aiAgreements: {},
        analyzedAt: 1_700_000_000_000,
      });
      await writeSummary("demo-AI-keeper", {key: "keeper", summary: "The one that qualifies."});

      const found = await findRelatedSummaries(demoMetadata, [0.1, 0.2, 0.3]);

      expect(summaryTexts(found)).toEqual(["The one that qualifies."]);
    });
  });

  describe("readDocumentMetadata", () => {
    const documentPath = "demo/AI/documents/testdoc1";

    async function writeMetadataDocument(fields: Record<string, unknown>) {
      await db.doc(documentPath).set(fields);
    }

    it("reads the context fields and takes the realm from the path", async () => {
      await writeMetadataDocument({
        key: "thisdoc", context_id: "class1", unit: "vibe", investigation: "1", problem: "1.1",
        offeringId: "1234", title: "Not a field the lookup uses",
      });

      expect(await readDocumentMetadata(documentPath)).toEqual({metadata: demoMetadata});
    });

    // A personal document: no class, no problem. Reported apart from the unreadable cases, because
    // it is the ordinary state of a whole class of documents rather than something going wrong.
    it("reports no-context for a document with incomplete context", async () => {
      await writeMetadataDocument({key: "thisdoc", unit: "vibe"});

      expect(await readDocumentMetadata(documentPath)).toEqual({gap: "no-context"});
    });

    it("reports no-metadata for a document with no key", async () => {
      await writeMetadataDocument({
        context_id: "class1", unit: "vibe", investigation: "1", problem: "1.1",
      });

      expect(await readDocumentMetadata(documentPath)).toEqual({gap: "no-metadata"});
    });

    // `getSummaryPath` escapes the key with a string method, so a non-string throws rather than
    // skips. Clients can write metadata documents directly in the open realms.
    it.each([
      ["a number", 12345],
      ["an object", {oops: true}],
      ["an array", ["a", "b"]],
      ["a boolean", true],
    ])("reports no-metadata when key is %s rather than a string", async (_label, key) => {
      await writeMetadataDocument({
        key, context_id: "class1", unit: "vibe", investigation: "1", problem: "1.1",
      });

      expect(await readDocumentMetadata(documentPath)).toEqual({gap: "no-metadata"});
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("no usable key"));
    });

    it("reports no-metadata when the document does not exist", async () => {
      expect(await readDocumentMetadata(documentPath)).toEqual({gap: "no-metadata"});
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    });

    it("reports no-metadata for a path that is not a document path", async () => {
      expect(await readDocumentMetadata("demo/AI/curriculum/vibe%2F1%2F1%2Fintro")).toEqual({gap: "no-metadata"});
      expect(await readDocumentMetadata("demo/AI/documents/testdoc1/comments/c1")).toEqual({gap: "no-metadata"});
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    // Optional on a metadata document, stored unconditionally on a summary record, and undefined
    // cannot be written to Firestore.
    it("substitutes an empty string for a missing offeringId", async () => {
      await writeMetadataDocument({
        key: "thisdoc", context_id: "class1", unit: "vibe", investigation: "1", problem: "1.1",
      });

      expect(await readDocumentMetadata(documentPath)).toEqual({metadata: {...demoMetadata, offeringId: ""}});
    });
  });
});
