import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  ICommentableDocumentParams, ICommentableDocumentUnionParams, isCurriculumMetadata, isDocumentMetadata,
  isWarmUpParams, networkDocumentKey
} from "../../shared/shared";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.0.1";

export async function validateCommentableDocument(
                        params?: ICommentableDocumentUnionParams,
                        callableContext?: functions.https.CallableContext) {
  if (isWarmUpParams(params)) return { version };

  const { context, document } = params || {};
  const { isValid, uid, firestoreRoot } = validateUserContext(context, callableContext?.auth);
  if (!isValid || !context?.classHash || !uid) {
    throw new functions.https.HttpsError("invalid-argument", "The provided user context is not valid.");
  };

  if (!context?.name || !context.teachers?.length) {
    throw new functions.https.HttpsError("invalid-argument", "Some required teacher information was not provided.");
  }

  if (!isDocumentMetadata(document) && !isCurriculumMetadata(document)) {
    throw new functions.https.HttpsError("invalid-argument", "Some required document information was not provided.");
  }

  const result = await createCommentableDocumentIfNecessary({ context, document, firestoreRoot, uid });

  return { version, id: result?.ref.id, data: result?.data };
};

export interface ICreateCommentableDocumentParams extends ICommentableDocumentParams {
  firestoreRoot: string;
  uid: string;
}

// This can create multiple "commentable documents" also known as metadata documents for the same
// document content. The uid is the user id of the current user, not the user id of the owner
// of the document. This is by design so the comments by one network of teachers are not
// available to the other network of teachers. However approach complicates the usage of these documents
// for extra metadata like history and document filtering.
// History handles this by always looking for a document with the prefix of `uid:[owner_uid]`, and
// when history entries are written they are always written by the owner.
export async function createCommentableDocumentIfNecessary(params?: ICreateCommentableDocumentParams) {
  const { context, document, firestoreRoot, uid } = params || {};
  if (!context || !document || !firestoreRoot || !uid) return null;
  const firestore = admin.firestore();
  const kCollection = isCurriculumMetadata(document) ? "curriculum" : "documents";
  const kBaseDocumentKey = isCurriculumMetadata(document) ? document.path : document.key;
  const kDocumentKey = networkDocumentKey(uid, kBaseDocumentKey, context.network);
  const kDocumentDocPath = `${firestoreRoot}/${kCollection}/${kDocumentKey}`;
  const documentRef = firestore.doc(kDocumentDocPath);

  // see if the document is already in firestore
  const docReadResponse = await documentRef.get();
  let documentContent = docReadResponse.data();
  if (!documentContent) {
    // convert empty/falsy networks to null
    const network = context.network || null;
    // if not already present, create it
    documentContent = isDocumentMetadata(document)
                        ? {
                          // we could pull some of the document metadata from the realtime database,
                          // but for now we trust the client to provide valid values.
                          ...document,
                          context_id: context.classHash,
                          teachers: context.teachers,
                          network
                        }
                        : {
                          ...document,
                          uid,
                          network
                        };
    await documentRef.set(documentContent);
  }
  return { ref: documentRef, data: documentContent };
}
