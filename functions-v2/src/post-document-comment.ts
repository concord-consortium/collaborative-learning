import * as admin from "firebase-admin";
import {CallableRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import {
  IPostDocumentCommentUnionParams, isCurriculumMetadata, isDocumentMetadata, isWarmUpParams,
} from "../../shared/shared";
import {validateUserContext} from "./user-context";
import {createFirestoreMetadataDocumentIfNecessaryWithoutValidation} from "./create-firestore-metadata-document";

// update this when deploying updates to this function
const version = "1.2.0";

export const postDocumentComment = onCall(async (request: CallableRequest<IPostDocumentCommentUnionParams>) => {
  const params = request.data;
  if (isWarmUpParams(params)) return {version};

  const {context: userContext, document, comment} = params || {};
  const {isValid, uid, firestoreRoot} = validateUserContext(userContext, request.auth);
  if (!isValid || !userContext?.classHash || !uid) {
    throw new HttpsError("invalid-argument", "The provided user context is not valid.");
  }

  if (!userContext?.name || !userContext.teachers?.length) {
    throw new HttpsError("invalid-argument", "Some required teacher information was not provided.");
  }

  if (!isDocumentMetadata(document) && !isCurriculumMetadata(document)) {
    throw new HttpsError("invalid-argument", "Some required document information was not provided.");
  }

  if (!comment?.content && !comment?.tags?.length) { // if we have a tag we can post an empty comment
    throw new HttpsError("invalid-argument", "Some required comment information was not provided.");
  }

  const docResult = await createFirestoreMetadataDocumentIfNecessaryWithoutValidation(
    {context: userContext, document, firestoreRoot, uid}
  );
  if (!docResult?.ref) {
    throw new HttpsError("invalid-argument", "Some required arguments were not valid.");
  }

  // add the comment once we're certain the document exists
  const commentsCollectionRef = admin.firestore().collection(`${docResult.ref.path}/comments`);
  const result = await commentsCollectionRef.add({
    uid,
    name: userContext.name,
    network: userContext.network,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...comment,
  });
  return {version, id: result.id};
});
