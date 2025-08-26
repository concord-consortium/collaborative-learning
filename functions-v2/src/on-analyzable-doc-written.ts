import {DatabaseEvent, DataSnapshot, onValueWritten} from "firebase-functions/v2/database";
import {Change} from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {getAnalysisQueueFirestorePath} from "./utils";

// This is one of three functions for AI analysis of documents:
// 1. (This function) watch for changes to the evaluation metadata field and write into the queue of docs to process
// 2. Create screenshots of those documents
// 3. Send those screenshots to the AI service for processing, and create document comments with the results

// We watch for changes in the Firebase metadata, but will eventually need to write results out to comments
// on the document.

/* eslint-disable max-len */
// Firebase metadata path                                                    --> corresponding Firestore document path
// dev/devId/portals/localhost/classes/devclass/users/userId/documentMetadata/docId --> dev/devId/documents/docId
// qa/qaId/portals/qa/classes/classId/users/userId/documentMetadata/docId           --> qa/qaId/documents/docId
// demo/demoId/portals/demo/classes/classId/users/userId/documentMetadata/docId     --> demo/demoId/documents/docId
// authed/portals/portalId/classes/classId/users/userId/documentMetadata/docId      --> authed/portalId/documents/docId

// Note Firebase (unlike Firestore) does not support multi-segment wildcards so we can't just write {root}

// This pattern handles dev, qa, and demo "realms"
export const onAnalyzableTestDocWritten =
  onValueWritten("{realm}/{realmId}/portals/{portalId}/classes/{classId}/users/{userId}/documentMetadata/{docId}/evaluation/{evaluator}",
    (event) => {
      const {realm, realmId, portalId} = event.params;
      const firebaseRoot = `${realm}/${realmId}/portals/${portalId}`;
      const firestoreRoot = `${realm}/${realmId}`;
      return handleUpdate(event, firebaseRoot, firestoreRoot);
    });

// This pattern handles the authed "realm", which has one less level of hierarchy
export const onAnalyzableProdDocWritten =
  onValueWritten("authed/portals/{portalId}/classes/{classId}/users/{userId}/documentMetadata/{docId}/evaluation/{evaluator}",
    (event) => {
      const {portalId} = event.params;
      const firebaseRoot = `authed/portals/${portalId}`;
      const firestoreRoot = `authed/${portalId}`;
      return handleUpdate(event, firebaseRoot, firestoreRoot);
    });

export interface AIPrompt {
  mainPrompt: string,
  categorizationDescription?: string,
  categories?: string[],
  keyIndicatorsPrompt?: string,
  discussionPrompt?: string,
  systemPrompt: string,
  summarizer?: string
}

export interface AnalysisQueueDocument {
  aiPrompt?: AIPrompt;
  commentsPath: string;
  documentPath: string;
  docUpdated: number | string;
  evaluator: string;
  metadataPath: string;
  firestoreDocumentPath: string;
}

const handleUpdate = async (event: DatabaseEvent<Change<DataSnapshot>>, firebaseRoot: string, firestoreRoot: string) => {
  const content = event.data.after.val();
  if (!content) {
    logger.info("evaluation was deleted", event.subject);
    return;
  }
  // Check the type since it has changed from a timestamp to an object
  const timestamp = typeof content === "object" ? content.timestamp : content;
  const aiPrompt = (typeof content === "object" && content.aiPrompt) ? content.aiPrompt : null;
  // onValueWritten will trigger on create, update, or delete. Ignore deletes.

  // Determine all the database paths that we are going to need
  const {classId, userId, docId, evaluator} = event.params;
  const metadataPath = `${firebaseRoot}/classes/${classId}/users/${userId}/documentMetadata/${docId}`;
  const documentPath = `${firebaseRoot}/classes/${classId}/users/${userId}/documents/${docId}`;
  const commentsPath = `${firestoreRoot}/documents/${docId}/comments`;
  const firestoreDocumentPath = `${firestoreRoot}/documents/${docId}`;

  const firestore = admin.firestore();

  // This should be safe in the event of duplicate calls; the second will just overwrite the first.
  const newDocument: AnalysisQueueDocument = {
    metadataPath,
    documentPath,
    commentsPath,
    docUpdated: timestamp,
    evaluator,
    firestoreDocumentPath,
  };

  if (aiPrompt) {
    newDocument.aiPrompt = aiPrompt;
  }

  await firestore.doc(getAnalysisQueueFirestorePath("pending", docId)).set(newDocument);
  logger.info(`Added document ${documentPath} to queue for ${evaluator} with aiPrompt ${JSON.stringify(aiPrompt)}`);
};
