import {FirestoreEvent, onDocumentCreated, QueryDocumentSnapshot} from "firebase-functions/v2/firestore";
import {getAnalysisQueueFirestorePath} from "./utils";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write into the queue of docs to process
// 2. (This function) Create screenshots of those documents
// 3. Send those screenshots to the AI service for processing, and create document comments with the results

// TODO just a stub for now

const pendingQueuePath = getAnalysisQueueFirestorePath("pending", "{docId}");

async function error(error: string, event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>) {
  logger.warn("Error processing document", event.document, error);
  const firestore = admin.firestore();
  await firestore.doc(getAnalysisQueueFirestorePath("failedImaging", event.params.docId)).set({
    ...event.data?.data(),
    error,
  });
  await firestore.doc(event.document).delete();
}


export const onAnalysisDocumentPending =
  onDocumentCreated(pendingQueuePath, async (event) => {
    const {docId} = event.params;
    const firestore = admin.firestore();
    const queueDoc = event.data?.data();

    if (queueDoc?.evaluator !== "categorize-design") {
      await error(`Unexpected value for evaluator: ${queueDoc?.evaluator}`, event);
      return;
    }

    // TODO: create screenshot of document
    const imageUrl = "https://placehold.co/300x20?text=Wheelbarrow+design";

    // Write to the "imaged" queue
    const nextQueuePath = getAnalysisQueueFirestorePath("imaged", docId);
    firestore.doc(nextQueuePath).set({
      ...queueDoc,
      docImaged: admin.firestore.FieldValue.serverTimestamp(),
      docImageUrl: imageUrl,
    });

    // Remove from the "pending" queue
    await firestore.doc(event.document).delete();
  });
