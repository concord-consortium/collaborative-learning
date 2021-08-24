import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { IPostCommentParams } from "./shared-types";
import { validateUserContext } from "./user-context";

export const postDocumentComment = async (params?: IPostCommentParams, callableContext?: functions.https.CallableContext) => {
  const { context, document, comment } = params || {};
  const { isValid, uid, firestoreRoot } = validateUserContext(context, callableContext?.auth);
  if (!isValid || !context?.classHash || !uid) {
    throw new functions.https.HttpsError("invalid-argument", "The provided user context is not valid.");
  };

  if (!context?.name || !context.teachers?.length) {
    throw new functions.https.HttpsError("invalid-argument", "Some required teacher information was not provided.");
  }

  if (!document?.uid || !document.type || !document.key || !document.createdAt) {
    throw new functions.https.HttpsError("invalid-argument", "Some required document information was not provided.");
  }

  if (!comment?.content) {
    throw new functions.https.HttpsError("invalid-argument", "Some required comment information was not provided.");
  }

  const firestore = admin.firestore();
  const kDocumentDocPath = `${firestoreRoot}/documents/${document.key}`;
  const kCommentsCollectionPath = `${kDocumentDocPath}/comments`;

  // see if the document is already in firestore
  const docReadResponse = await firestore.doc(kDocumentDocPath).get();
  if (!docReadResponse.data()) {
    // if not already present, create it
    await firestore.doc(kDocumentDocPath).set({
      context_id: context.classHash,
      teachers: context.teachers,
      network: context.network,
      // we could pull some of the document metadata from the realtime database,
      // but for now we trust the client to provide valid values.
      ...document
    });
  }

  // add the comment once we're certain the document exists
  const result = await firestore.collection(kCommentsCollectionPath).add({
    uid,
    name: context.name,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...comment
  });
  return { id: result.id };
};
