import * as admin from "firebase-admin";
import {CallableRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import {
  IPostDocumentCommentUnionParams, isCurriculumMetadata, isDocumentMetadata, isWarmUpParams,
} from "../../shared/shared";
import {validateUserContext} from "./user-context";
import {createFirestoreMetadataDocumentIfNecessaryWithoutValidation} from "./create-firestore-metadata-document";

// update this when deploying updates to this function
const version = "1.0.0";

// This should match the definitions in src/models/stores/user-types.ts
const kExemplarUserParams = {
  type: "student",
  id: "ivan_idea_1",
  firstName: "Ivan",
  lastName: "Idea",
  fullName: "Ivan Idea",
  initials: "II",
};

/**
 * This checks that the user is allowed to post a comment on the given document,
 * but the comment is actually attributed to the exemplar user (Ivan Idea).
 */
export const postExemplarComment = onCall(async (request: CallableRequest<IPostDocumentCommentUnionParams>) => {
  const params = request.data;
  if (isWarmUpParams(params)) return {version};

  const {context: userContext, document, comment} = params || {};
  const validatedUserContext = validateUserContext(userContext, request.auth);
  const {isValid, uid, firestoreRoot} = validatedUserContext;
  if (!isValid || !userContext?.classHash || !uid) {
    throw new HttpsError("invalid-argument", "The provided user context is not valid.");
  }

  if (!userContext?.name || !userContext.teachers?.length) {
    throw new HttpsError("invalid-argument", "Some required teacher information was not provided.");
  }

  if (!isDocumentMetadata(document) && !isCurriculumMetadata(document)) {
    throw new HttpsError("invalid-argument", "Some required document information was not provided.");
  }

  if (!comment?.content) {
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
    ...comment,
    uid: kExemplarUserParams.id,
    name: kExemplarUserParams.fullName,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {version, id: result.id};
});
