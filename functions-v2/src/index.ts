import * as admin from "firebase-admin";
export {onUserDocWritten} from "./on-user-doc-written";
export {onDocumentTagged} from "./on-document-tagged";
export {atMidnight} from "./at-midnight";
export {onAnalyzableTestDocWritten, onAnalyzableProdDocWritten} from "./on-analyzable-doc-written";
export {onAnalysisDocumentPending} from "./on-analysis-document-pending";
export {onAnalysisDocumentImaged} from "./on-analysis-document-imaged";
import {createFirestoreMetadataDocument} from "./create-firestore-metadata-document";
import {postDocumentComment} from "./post-document-comment";
import {postExemplarComment} from "./post-exemplar-comment";

/* eslint-disable camelcase */
export const createFirestoreMetadataDocument_v2 = createFirestoreMetadataDocument;
export const postDocumentComment_v2 = postDocumentComment;
export const postExemplarComment_v2 = postExemplarComment;
/* eslint-enable camelcase */

admin.initializeApp();
