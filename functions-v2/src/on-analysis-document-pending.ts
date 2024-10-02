import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getAnalysisQueueFirestorePath} from "./utils";
import * as admin from "firebase-admin";

// This is one of three functions for AI analysis of documents:
// 1. Watch for changes to the lastUpdatedAt metadata field and write into the queue of docs to process
// 2. (This function) Create screenshots of those documents
// 3. Send those screenshots to the AI service for processing, and create document comments with the results

// TODO just a stub for now

const pendingQueuePath = getAnalysisQueueFirestorePath("pending", "{docId}");

export const onAnalysisDocumentPending =
  onDocumentCreated(pendingQueuePath, async (event) => {
    const {docId} = event.params;
    const firestore = admin.firestore();

    // TODO: create screenshot of document
    const imageUrl = "https://placehold.co/300x20?text=Wheelbarrow+design";

    // Write to the "imaged" queue
    const nextQueuePath = getAnalysisQueueFirestorePath("imaged", docId);
    firestore.doc(nextQueuePath).set({
      ...event.data?.data(),
      docImaged: admin.firestore.FieldValue.serverTimestamp(),
      docImageUrl: imageUrl,
    });

    // Remove from the "pending "queue
    await firestore.doc(event.document).delete();
  });
