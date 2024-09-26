import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getDatabase} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
// import * as admin from "firebase-admin";

// This is one of what will likely be multiple functions for AI analysis of documents:
// 1. (This function) watch for changes to the lastUpdatedAt metadata field and write a queue of docs to process
// 2. Create screenshots of those documents
// 3. Send those screenshots to the AI service for processing, and create document comments with the results

// For now, restrict processing to a particular root for testing.
// TODO later this will be a parameter.
const root = "demo/AI/portals/demo";

// Location of the queue of documents to process, relative to the root
const queuePath = "aiProcessingQueue";

export const onAnalyzableDocWritten =
  onDocumentWritten(`${root}/classes/{classId}/users/{userId}/documentMetadata/{docId}/lastUpdatedAt`,
    async (event) => {
      const {classId, userId, docId} = event.params;
      const database = getDatabase();
      logger.info("Document update noticed", event.document, classId, userId, docId);

      const timestamp = await database.ref(event.document).once("value").then((snap) => {
        return snap.val();
      },
      (error) => {
        logger.error("Error reading document", error);
      });
      getDatabase().ref(`${root}/${queuePath}`).update({
        [docId]: {
          metadataPath: `classes/${classId}/users/${userId}/documentMetadata/${docId}`,
          updated: timestamp,
          status: "unanalyzed",
        },
      });
    });


