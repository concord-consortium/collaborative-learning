import {FirestoreEvent, onDocumentCreated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {getAnalysisQueueFirestorePath} from "./utils";
import {
  type DocumentRepresentations, categorizeRepresentations,
} from "../lib/src/ai-categorize-document";
import {defineSecret} from "firebase-functions/params";
import {kAnalyzerUserParams} from "../../shared/shared";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write a queue of docs to process
// 2. Summarize and screenshot those documents
// 3. (This function) Send what was produced to the AI service for processing along with any custom AI prompt, and
//    create comments with the results

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

      if (queueDoc.evaluator === "mock") {
        message = "Mock reply from AI analysis";
      } else if (queueDoc.evaluator === "categorize-design" || queueDoc.evaluator === "custom") {
        const aiPrompt = queueDoc.evaluator === "custom" ? queueDoc.aiPrompt : undefined;
        const firestoreDocumentPath = queueDoc.firestoreDocumentPath;

        const representations = representationsOf(queueDoc);
        let completion;
        try {
          ({completion, messageShape} = await categorizeRepresentations(
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

      logger.info("Creating comment for", event.document);
      // NOTE we are leaving the "network" and "tileId" fields empty in the comment doc.
      await firestore.collection(commentsPath).add({
        tags,
        content: message,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        name: kAnalyzerUserParams.fullName,
        uid: kAnalyzerUserParams.id,
      });

      // Add to "done" queue
      await firestore.collection(getAnalysisQueueFirestorePath("done")).add({
        ...queueDoc,
        documentId: event.params.docId,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        promptTokens,
        completionTokens,
        fullResponse,
        ...(messageShape ? {messageShape} : {}),
      });

      // Remove from the "imaged" queue
      await firestore.doc(event.document).delete();
    }
  );
