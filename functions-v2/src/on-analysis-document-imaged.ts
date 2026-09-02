import {FirestoreEvent, onDocumentCreated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
// Modular import: admin.firestore.FieldValue is undefined in the functions emulator.
import {FieldValue} from "firebase-admin/firestore";
import {getAnalysisQueueFirestorePath, getSummaryPath} from "./utils";
import {
  type DocumentMetadata, type DocumentRepresentations, type MetadataGap, categorizeRepresentations,
} from "../lib/src/ai-categorize-document";
import {Summary} from "./summary-types";
import {defineSecret} from "firebase-functions/params";
import {kAnalyzerUserParams} from "../../shared/shared";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write a queue of docs to process
// 2. Summarize and screenshot those documents
// 3. (This function) Send what was produced to the AI service for processing along with any custom AI prompt,
//    record the summary that was evaluated in `summaries/`, and create comments with the results

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const imagedQueuePath = getAnalysisQueueFirestorePath("imaged", "{docId}");

/**
 * A usable value or nothing: an empty string is not a summary, and not a URL either.
 *
 * @param {unknown} value the field read off the queue record
 * @return {string | null} the value if it is a non-empty string, otherwise null
 */
function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * What to send, read from the queue record.
 *
 * The values decide, not the flags. A record claiming `sendImage: true` with no `docImageUrl`
 * yields null rather than a request built around an empty string, and if both come out null
 * `categorizeRepresentations` refuses, so the record lands in `failedAnalyzing` with a clear
 * message instead of the model being asked to judge a bare prompt.
 *
 * A record with no `analysisVersion` was written by the previous version of the producer during
 * the seconds a deploy takes. It carries one representation and says which in `summarizer`. This
 * branch and the producer's `summarizer` field go together in a later cleanup, once the `done`
 * queue shows no version-less records.
 *
 * @param {Record<string, unknown>} queueDoc the record from the imaged queue
 * @return {DocumentRepresentations} what is being sent, with null for anything that is not
 */
export function representationsOf(queueDoc: Record<string, unknown>): DocumentRepresentations {
  if (queueDoc.analysisVersion !== 2) {
    return queueDoc.summarizer === "text" ?
      {summary: stringOrNull(queueDoc.docSummary), imageUrl: null} :
      {summary: null, imageUrl: stringOrNull(queueDoc.docImageUrl)};
  }
  return {
    summary: queueDoc.sendSummary === true ? stringOrNull(queueDoc.docSummary) : null,
    imageUrl: queueDoc.sendImage === true ? stringOrNull(queueDoc.docImageUrl) : null,
  };
}

/**
 * What became of this run's summary record, stored on the `done` queue entry so that "did this
 * document get a summary, and if not why not" is a query rather than a log search.
 *
 * `no-summary-sent` and `no-context` are ordinary: the first is an image-only or mock run, the
 * second a document with no class or problem, which is what a personal document looks like.
 * `no-metadata`, `no-embedding` and `failed` mean something was expected and did not arrive.
 */
export type SummaryOutcome =
  "created" | "refreshed" | "failed" | "no-summary-sent" | MetadataGap | "no-embedding";

/**
 * Records the summary this run evaluated, so ratings of the comments it produces have somewhere to
 * land and later evaluations of similar documents can find it.
 *
 * Two paths, because a merge that never touches the agreements cannot also initialize them. A new
 * record starts with no agreements and both counts at zero; an existing one has only its summary,
 * vector, timestamp and comment id refreshed, since the agreements belong to the people who made
 * them. A record written before `root` and `space` existed gains them here, but only if it sits at
 * the id `getSummaryPath` derives: the retired trigger keyed records by the metadata document id,
 * which differs from the key on older documents, and such a record is never found — re-analysis
 * writes a fresh one beside it.
 *
 * The read and the write share a transaction because a rating can arrive at any moment.
 *
 * @param {admin.firestore.Firestore} firestore the admin Firestore instance
 * @param {DocumentMetadata} metadata where the document lives and what class and problem it is for
 * @param {string} summary the summary text that was sent to the AI service
 * @param {number[]} summaryEmbedding the vector of that text, computed once for this run
 * @param {string} adaCommentId the comment this run is about to create
 * @return {Promise<SummaryOutcome>} whether the record was created or refreshed
 */
async function writeSummaryRecord(
  firestore: admin.firestore.Firestore,
  metadata: DocumentMetadata,
  summary: string,
  summaryEmbedding: number[],
  adaCommentId: string
): Promise<SummaryOutcome> {
  const summaryRef = firestore.doc(getSummaryPath(metadata.root, metadata.space, metadata.key));
  // Typed as a subset of Summary so a field this run has no business writing cannot be added here.
  const analyzed: Omit<Summary, "aiAgreements" | "numAiAgreements" | "numAgreements"> = {
    key: metadata.key,
    root: metadata.root,
    space: metadata.space,
    context_id: metadata.context_id,
    unit: metadata.unit,
    investigation: metadata.investigation,
    problem: metadata.problem,
    offeringId: metadata.offeringId,
    summary,
    summaryEmbedding: FieldValue.vector(summaryEmbedding),
    analyzedAt: Date.now(),
    adaCommentId,
  };

  return firestore.runTransaction(async (transaction): Promise<SummaryOutcome> => {
    const existing = await transaction.get(summaryRef);
    if (existing.exists) {
      transaction.update(summaryRef, analyzed);
      logger.info("Refreshed summary", summaryRef.path);
      return "refreshed";
    }
    transaction.set(summaryRef, {...analyzed, aiAgreements: {}, numAiAgreements: 0, numAgreements: 0});
    logger.info("Created summary", summaryRef.path);
    return "created";
  });
}

async function error(error: string, event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>) {
  logger.warn("Error processing document", event.document, error);
  const firestore = admin.firestore();
  await firestore.collection(getAnalysisQueueFirestorePath("failedAnalyzing")).add({
    ...event.data?.data(),
    documentId: event.params.docId,
    error,
  });
  await firestore.doc(event.document).delete();
}

export const onAnalysisDocumentImaged =
  onDocumentCreated(
    {
      document: imagedQueuePath,
      secrets: [openaiApiKey],
    },
    async (event) => {
      logger.info("onAnalysisDocumentImaged");
      const firestore = admin.firestore();
      const queueDoc = event.data?.data();
      if (!queueDoc) {
        logger.warn("No queue doc", event);
        return;
      }

      const commentsPath = queueDoc.commentsPath;

      let message = "";
      let tags: string[] = [];
      let promptTokens = 0;
      let completionTokens = 0;
      let fullResponse = "";
      let messageShape;
      // None of these is set unless a summary was sent; the metadata and the embedding can still
      // go missing individually, which is what the outcomes below tell apart.
      let sentSummary: string | null = null;
      let summaryEmbedding: number[] | undefined;
      let documentMetadata: DocumentMetadata | undefined;
      let metadataGap: MetadataGap | undefined;

      if (queueDoc.evaluator === "mock") {
        message = "Mock reply from AI analysis";
      } else if (queueDoc.evaluator === "categorize-design" || queueDoc.evaluator === "custom") {
        const aiPrompt = queueDoc.evaluator === "custom" ? queueDoc.aiPrompt : undefined;
        const firestoreDocumentPath = queueDoc.firestoreDocumentPath;

        const representations = representationsOf(queueDoc);
        sentSummary = representations.summary;
        let completion;
        try {
          ({completion, messageShape, summaryEmbedding, documentMetadata, metadataGap} =
            await categorizeRepresentations(
              representations, openaiApiKey.value(), firestoreDocumentPath, aiPrompt));
        } catch (err) {
          await error(`${err}`, event);
          return;
        }
        const reply = completion?.choices[0].message;
        promptTokens = completion?.usage?.prompt_tokens || 0;
        completionTokens = completion?.usage?.completion_tokens || 0;

        if (reply?.refusal) {
          await error(`AI refusal: ${reply.refusal}`, event);
          return;
        }
        if (!reply?.parsed) {
          await error("No response from AI", event);
          return;
        }
        tags = reply.parsed.category && reply.parsed.category !== "unknown" ? [reply.parsed.category] : [];
        const indicators = reply.parsed.keyIndicators && reply.parsed.keyIndicators.length ?
          ` Your work shows: ${reply.parsed.keyIndicators.join(", ")}` : "";
        message = (reply.parsed.discussion || "") + indicators;
        fullResponse = JSON.stringify(completion);
      } else {
        await error(`Unexpected value for evaluator: ${queueDoc?.evaluator}`, event);
        return;
      }

      // Generating the id writes nothing, so the summary record can name the comment and still be
      // written first. It has to be first: a student can rate a comment the moment it appears, and
      // onCommentRated drops a rating whose summary does not exist yet.
      const commentRef = firestore.collection(commentsPath).doc();

      let summaryRecorded: SummaryOutcome;

      // `.length`, not truthiness: an empty array is truthy, and writing one would persist a
      // zero-dimension vector no search can find. Kept even though categorizeRepresentations
      // normalizes an empty result too, so a change to either file alone cannot open this.
      if (sentSummary && documentMetadata && summaryEmbedding?.length) {
        try {
          summaryRecorded =
            await writeSummaryRecord(firestore, documentMetadata, sentSummary, summaryEmbedding, commentRef.id);
        } catch (err) {
          // The evaluation succeeded and the student is owed its feedback. A missing record only
          // costs ratings of this comment, and the next analysis writes it again.
          summaryRecorded = "failed";
          logger.warn("Could not record the summary; continuing to the comment", event.document, err);
        }
      } else {
        // Not logged: a line per image-only run would bury the cases that matter, and the two that
        // are anomalies are already logged where they are detected.
        // metadataGap is set exactly when the metadata is missing, so it answers for that case.
        summaryRecorded = !sentSummary ? "no-summary-sent" : metadataGap ?? "no-embedding";
      }

      logger.info("Creating comment for", event.document);
      // NOTE we are leaving the "network" and "tileId" fields empty in the comment doc.
      await commentRef.set({
        tags,
        content: message,
        createdAt: FieldValue.serverTimestamp(),
        name: kAnalyzerUserParams.fullName,
        uid: kAnalyzerUserParams.id,
      });

      // Add to "done" queue
      await firestore.collection(getAnalysisQueueFirestorePath("done")).add({
        ...queueDoc,
        documentId: event.params.docId,
        completedAt: FieldValue.serverTimestamp(),
        promptTokens,
        completionTokens,
        fullResponse,
        summaryRecorded,
        ...(messageShape ? {messageShape} : {}),
      });

      // Remove from the "imaged" queue
      await firestore.doc(event.document).delete();
    }
  );
