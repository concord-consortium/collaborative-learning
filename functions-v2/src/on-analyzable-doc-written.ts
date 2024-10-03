import {onValueWritten} from "firebase-functions/v2/database";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {getAnalysisQueueFirestorePath} from "./utils";

// This is one of three functions for AI analysis of documents:
// 1. (This function) watch for changes to the evaluation metadata field and write into the queue of docs to process
// 2. Create screenshots of those documents
// 3. Send those screenshots to the AI service for processing, and create document comments with the results

// For now, restrict processing to a particular root for testing.
// TODO later we will open this up to all documents, and {root} will be a parameter.
const root = "demo/AI/portals/demo";

export const onAnalyzableDocWritten =
  onValueWritten(`${root}/classes/{classId}/users/{userId}/documentMetadata/{docId}/evaluation/{evaluator}`,
    async (event) => {
      const timestamp = event.data.after.val();
      // onValueWritten will trigger on create, update, or delete. Ignore deletes.
      if (!timestamp) {
        logger.info("evaluation was deleted", event.subject);
        return;
      }
      const {classId, userId, docId, evaluator} = event.params;
      const metadataPath = `${root}/classes/${classId}/users/${userId}/documentMetadata/${docId}`;

      const firestore = admin.firestore();
      // This should be safe in the event of dupliclate calls; the second will just overwrite the first.
      await firestore.doc(getAnalysisQueueFirestorePath("pending", docId)).set({
        metadataPath,
        docUpdated: timestamp,
        evaluator,
      });
      logger.info(`Added document ${docId} to queue for ${evaluator}`);
    }
  );
