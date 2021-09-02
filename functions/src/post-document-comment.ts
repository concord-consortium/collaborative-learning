import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  IPostDocumentCommentUnionParams, isCurriculumMetadata, isDocumentMetadata, isWarmUpParams, networkDocumentKey
} from "./shared";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.1.2";

export async function postDocumentComment(
                        params?: IPostDocumentCommentUnionParams,
                        callableContext?: functions.https.CallableContext) {
  if (isWarmUpParams(params)) return { version };

  const { context, document, comment } = params || {};
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

  if (!comment?.content) {
    throw new functions.https.HttpsError("invalid-argument", "Some required comment information was not provided.");
  }

  const firestore = admin.firestore();
  const kCollection = isCurriculumMetadata(document) ? "curriculum" : "documents";
  const kBaseDocumentKey = isCurriculumMetadata(document) ? document.path : document.key;
  const kDocumentKey = networkDocumentKey(uid, kBaseDocumentKey, context.network);
  const kDocumentDocPath = `${firestoreRoot}/${kCollection}/${kDocumentKey}`;
  const kCommentsCollectionPath = `${kDocumentDocPath}/comments`;

  // see if the document is already in firestore
  const docReadResponse = await firestore.doc(kDocumentDocPath).get();
  if (!docReadResponse.data()) {
    // if not already present, create it
    const documentParams = isDocumentMetadata(document)
                            ? {
                              // we could pull some of the document metadata from the realtime database,
                              // but for now we trust the client to provide valid values.
                              ...document,
                              context_id: context.classHash,
                              teachers: context.teachers
                            }
                            : {
                              ...document,
                              uid
                            };
    // convert empty/falsy networks to null
    const network = context.network || null;
    await firestore.doc(kDocumentDocPath).set({ ...documentParams, network });
  }

  // add the comment once we're certain the document exists
  const result = await firestore.collection(kCommentsCollectionPath).add({
    uid,
    name: context.name,
    network: context.network,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...comment
  });
  return { version, id: result.id };
};
