import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  IPostDocumentCommentUnionParams, isCurriculumMetadata, isDocumentMetadata, isWarmUpParams
} from "./shared";
import { validateUserContext } from "./user-context";
import { createCommentableDocumentIfNecessary } from "./validate-commentable-document";

// update this when deploying updates to this function
const version = "1.1.4";

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

  const docResult = await createCommentableDocumentIfNecessary({ context, document, firestoreRoot, uid });
  if (!docResult?.ref) throw new functions.https.HttpsError("invalid-argument", "Some required arguments were not valid.");

  // add the comment once we're certain the document exists
  const commentsCollectionRef = admin.firestore().collection(`${docResult.ref.path}/comments`);
  const result = await commentsCollectionRef.add({
    uid,
    name: context.name,
    network: context.network,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...comment
  });
  return { version, id: result.id };
};
