import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {FieldValue, Firestore} from "@google-cloud/firestore";
import * as logger from "firebase-functions/logger";
import {initialize, projectConfig} from "./initialize";
import {
  DocumentMetadata, findRelatedSummaries, readDocumentMetadata,
} from "../lib/src/ai-categorize-document";
import {AiAgreementV2} from "../src/summary-types";
import {IEvaluationRequestContext} from "../../shared/shared";

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
  problem: "1",
  offeringId: "1234",
  contextSource: "document",
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

    // The lookup does not filter on `contextSource`, so a personal document's record is found the
    // same way a problem document's is.
    it("returns a record whose context came from the evaluation request", async () => {
      await writeSummary("demo-AI-personaldoc", {
        key: "personaldoc", contextSource: "request", summary: "A peer's personal document.",
      });

      const found = await findRelatedSummaries(demoMetadata, [0.1, 0.2, 0.3]);

      expect(summaryTexts(found)).toEqual(["A peer's personal document."]);
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
      await writeSummary("demo-AI-otherproblem", {key: "otherproblem", problem: "1.2", summary: "Another problem."});
      await writeSummary("demo-AI-otherinv", {key: "otherinv", investigation: "2", summary: "Another investigation."});
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
        key: "thisdoc", context_id: "class1", unit: "vibe", investigation: "1", problem: "1",
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
        context_id: "class1", unit: "vibe", investigation: "1", problem: "1",
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
        key, context_id: "class1", unit: "vibe", investigation: "1", problem: "1",
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

    const requestContext: IEvaluationRequestContext = {
      unit: "vibe", investigation: "1", problem: "1", offeringId: "1234",
    };

    it("fills a personal document's missing fields from the request", async () => {
      await writeMetadataDocument({key: "thisdoc", type: "personal", context_id: "class1", unit: null});

      expect(await readDocumentMetadata(documentPath, requestContext))
        .toEqual({metadata: {...demoMetadata, contextSource: "request"}});
    });

    // The completeness check treats "" as missing, so the fill has to as well.
    it("treats an empty string on the record as a missing field", async () => {
      await writeMetadataDocument({
        key: "thisdoc", type: "personal", context_id: "class1", unit: "", investigation: "", problem: "",
      });

      expect(await readDocumentMetadata(documentPath, requestContext))
        .toEqual({metadata: {...demoMetadata, contextSource: "request"}});
    });

    it("keeps the record's own fields for a document that has them", async () => {
      await writeMetadataDocument({
        key: "thisdoc", type: "problem", context_id: "class1", unit: "vibe", investigation: "1",
        problem: "1", offeringId: "1234",
      });

      expect(await readDocumentMetadata(documentPath, {
        unit: "mods", investigation: "3", problem: "3.2", offeringId: "9999",
      })).toEqual({metadata: demoMetadata});
    });

    // A group document is tied to an offering, so its record carries the full context. Both
    // spellings are in use: CLUE-604's sweep rewrites "group" to "axes".
    it.each([["group"], ["axes"]])("reads a group document's own context, stored as %s", async (type) => {
      await writeMetadataDocument({
        key: "thisdoc", type, context_id: "class1", unit: "vibe", investigation: "1",
        problem: "1", offeringId: "1234",
      });

      expect(await readDocumentMetadata(documentPath, requestContext)).toEqual({metadata: demoMetadata});
    });

    // Only `unit` is covered by the mixed case above, so reversing the precedence of any other
    // field would otherwise go unnoticed.
    it("keeps every field the record has, and takes only the ones it lacks", async () => {
      await writeMetadataDocument({
        key: "thisdoc", type: "personal", context_id: "class1", investigation: "3", problem: "2",
        offeringId: "9999",
      });

      expect(await readDocumentMetadata(documentPath, requestContext)).toEqual({metadata: {
        ...demoMetadata, investigation: "3", problem: "2", offeringId: "9999",
        contextSource: "request",
      }});
    });

    // `offeringId` is not part of the lookup, so taking it from the request does not make the
    // record's context any less the document's own.
    it("says document when only the offeringId came from the request", async () => {
      await writeMetadataDocument({
        key: "thisdoc", type: "personal", context_id: "class1", unit: "vibe", investigation: "1",
        problem: "1",
      });

      expect(await readDocumentMetadata(documentPath, requestContext))
        .toEqual({metadata: demoMetadata});
    });

    // The class has no fallback: the request does not carry one, and the record is the only source.
    it("reports no-context for a personal document with no class, however good the request", async () => {
      await writeMetadataDocument({key: "thisdoc", type: "personal", unit: null});

      expect(await readDocumentMetadata(documentPath, requestContext)).toEqual({gap: "no-context"});
    });

    // Decision 1: only personal documents get this, and the type match is exact.
    it.each([
      ["a learning log", "learningLog"],
      ["a class-wide document", "axes"],
      ["a published personal document", "personalPublication"],
    ])("reports no-context for %s even with a request context", async (_label, type) => {
      await writeMetadataDocument({key: "thisdoc", type, context_id: "class1", unit: null});

      expect(await readDocumentMetadata(documentPath, requestContext)).toEqual({gap: "no-context"});
    });

    it("reports no-context for a personal document when the request carried no context", async () => {
      await writeMetadataDocument({key: "thisdoc", type: "personal", context_id: "class1", unit: null});

      expect(await readDocumentMetadata(documentPath)).toEqual({gap: "no-context"});
    });

    // Not a state a personal document is known to reach. Any field taken from the request makes
    // the whole record say so.
    it("says request when only some of the curriculum fields came from the request", async () => {
      await writeMetadataDocument({key: "thisdoc", type: "personal", context_id: "class1", unit: "mods"});

      expect(await readDocumentMetadata(documentPath, requestContext))
        .toEqual({metadata: {...demoMetadata, unit: "mods", contextSource: "request"}});
    });

    // Optional on a metadata document, stored unconditionally on a summary record, and undefined
    // cannot be written to Firestore.
    it("substitutes an empty string for a missing offeringId", async () => {
      await writeMetadataDocument({
        key: "thisdoc", context_id: "class1", unit: "vibe", investigation: "1", problem: "1",
      });

      expect(await readDocumentMetadata(documentPath)).toEqual({metadata: {...demoMetadata, offeringId: ""}});
    });
  });
});
