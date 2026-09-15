import {DatabaseEvent, DataSnapshot, onValueWritten} from "firebase-functions/v2/database";
import {Change} from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {getAnalysisQueueFirestorePath} from "./utils";
import {IEvaluationRequestContext, kPlaceholderUnitCode} from "../../shared/shared";

// This is one of three functions for AI analysis of documents:
// 1. (This function) watch for changes to the evaluation metadata field and write into the queue of docs to process
// 2. Summarize and screenshot those documents
// 3. Send what was produced to the AI service for processing, record the summary that was evaluated
//    in `summaries/`, and create document comments with the results

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
  systemPrompt: string
}

export interface AnalysisQueueDocument {
  aiPrompt?: AIPrompt;
  commentsPath: string;
  documentPath: string;
  docUpdated: number | string;
  evaluator: string;
  metadataPath: string;
  firestoreDocumentPath: string;
  /** The unit and problem the student was running when the evaluation was requested. */
  requestContext?: IEvaluationRequestContext;
}

// The lengths cap what a client can write: a long enough value pushes the queue record past
// Firestore's document limit, which fails the write and leaves the document unanalyzed.
const kMaxUnitCodeLength = 40;
const kMaxOfferingIdLength = 100;

// The same shape `isRenderableUnit` accepts in on-analysis-document-pending.ts, since a unit that
// cannot be rendered with is not worth storing either.
const isUnitCode = (value: unknown): value is string =>
  typeof value === "string" && value.length <= kMaxUnitCodeLength &&
  /^[A-Za-z0-9_+-]+$/.test(value) && value !== kPlaceholderUnitCode;

// Ordinals are small whole numbers written as strings, as the metadata records hold them. No
// leading zeros: "01" would never match a stored "1".
const isOrdinal = (value: unknown): value is string =>
  typeof value === "string" && /^(0|[1-9]\d{0,2})$/.test(value);

// Investigations can be numbered 0 (vibe, mods and sas all have a 0.1); problems are numbered from
// 1, so 0 is the app's unresolved placeholder. The client refuses to send it, and so does this.
const isProblemOrdinal = (value: unknown): value is string => isOrdinal(value) && value !== "0";

/**
 * The value comes from the realtime database, where a class member can write anything under their
 * class and the open realms let any signed-in user write anything, so nothing is passed on as it
 * arrived. The lookup needs all three curriculum fields, so a context missing or malformed in any
 * of them is dropped whole.
 *
 * @param {unknown} context the `context` field read off the evaluation request
 * @return {IEvaluationRequestContext | undefined} the four fields, or nothing if any is unusable
 */
export const normalizeRequestContext = (context: unknown): IEvaluationRequestContext | undefined => {
  if (!context || typeof context !== "object") return undefined;
  const {unit, investigation, problem, offeringId} = context as Record<string, unknown>;
  if (!isUnitCode(unit) || !isOrdinal(investigation) || !isProblemOrdinal(problem)) return undefined;
  const usableOfferingId = typeof offeringId === "string" && offeringId.length <= kMaxOfferingIdLength;
  return {unit, investigation, problem, offeringId: usableOfferingId ? offeringId : ""};
};

const handleUpdate = async (event: DatabaseEvent<Change<DataSnapshot>>, firebaseRoot: string, firestoreRoot: string) => {
  const content = event.data.after.val();
  if (!content) {
    logger.info("evaluation was deleted", event.subject);
    return;
  }
  // Check the type since it has changed from a timestamp to an object
  const timestamp = typeof content === "object" ? content.timestamp : content;
  const aiPrompt = (typeof content === "object" && content.aiPrompt) ? content.aiPrompt : null;
  const requestContext = typeof content === "object" ? normalizeRequestContext(content.context) : undefined;
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

  if (requestContext) {
    newDocument.requestContext = requestContext;
  }

  await firestore.doc(getAnalysisQueueFirestorePath("pending", docId)).set(newDocument);
  logger.info(`Added document ${documentPath} to queue for ${evaluator} with aiPrompt ${JSON.stringify(aiPrompt)}`);
};
