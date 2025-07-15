import {FirestoreEvent, onDocumentCreated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {getAnalysisQueueFirestorePath} from "./utils";
import {categorizeUrl} from "../lib/src/ai-categorize-document";
import {defineSecret} from "firebase-functions/params";
import {kAnalyzerUserParams} from "../../shared/shared";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write a queue of docs to process
// 2. Create screenshots of those documents
// 3. (This function) Send those screenshots to the AI service for processing along with any custom AI prompt, and
//    create  comments with the results

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const imagedQueuePath = getAnalysisQueueFirestorePath("imaged", "{docId}");

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

      if (queueDoc.evaluator === "mock") {
        message = "Mock reply from AI analysis";
      } else if (queueDoc.evaluator === "categorize-design" || queueDoc.evaluator === "custom") {
        const docImageUrl = event.data?.get("docImageUrl");
        const aiPrompt = queueDoc.evaluator === "custom" ? queueDoc.aiPrompt : undefined;

        const completion = await categorizeUrl(docImageUrl, openaiApiKey.value(), aiPrompt);
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
          ` Key Indicators: ${reply.parsed.keyIndicators.join(", ")}` : "";
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
      });

      // Remove from the "imaged" queue
      await firestore.doc(event.document).delete();
    }
  );
