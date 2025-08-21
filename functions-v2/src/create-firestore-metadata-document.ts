import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  escapeKey, IFirestoreMetadataDocumentParams, IFirestoreMetadataDocumentUnionParams, isCurriculumMetadata,
  isDocumentMetadata, isWarmUpParams,
} from "../../shared/shared";
import {validateUserContext} from "./user-context";

// update this when deploying updates to this function
const version = "1.0.0";

/**
 * Creates a Firestore metadata document for a document if one
 * doesn't already exist.
 */
export const createFirestoreMetadataDocument = onCall(async (request) => {
  const params = request.data as IFirestoreMetadataDocumentUnionParams | undefined;
  if (isWarmUpParams(params)) return {version};

  const {context, document} = params || {};
  const {isValid, uid, firestoreRoot} = validateUserContext(context, request.auth);
  if (!isValid || !context?.classHash || !uid) {
    throw new HttpsError("invalid-argument", "The provided user context is not valid.");
  }

  if (!context?.name || !context.teachers?.length) {
    throw new HttpsError("invalid-argument", "Some required teacher information was not provided.");
  }

  if (!isDocumentMetadata(document) && !isCurriculumMetadata(document)) {
    throw new HttpsError("invalid-argument", "Some required document information was not provided.");
  }

  const result = await createFirestoreMetadataDocumentIfNecessaryWithoutValidation(
    {context, document, firestoreRoot, uid}
  );

  return {version, id: result?.ref.id, data: result?.data};
});

interface ICreateFirestoreMetadataDocumentParams extends IFirestoreMetadataDocumentParams {
  firestoreRoot: string;
  uid: string;
}

// Creates a "commentable document" (metadata document) for the given content if one does not already exist.
export async function createFirestoreMetadataDocumentIfNecessaryWithoutValidation(
  params?: ICreateFirestoreMetadataDocumentParams
) {
  const {context, document, firestoreRoot, uid} = params || {};
  if (!context || !document || !firestoreRoot || !uid) return null;
  const firestore = admin.firestore();
  const kCollection = isCurriculumMetadata(document) ? "curriculum" : "documents";
  const kBaseDocumentKey = isCurriculumMetadata(document) ? document.path : document.key;
  const kDocumentKey = escapeKey(kBaseDocumentKey);
  const kDocumentDocPath = `${firestoreRoot}/${kCollection}/${kDocumentKey}`;
  const documentRef = firestore.doc(kDocumentDocPath);
  const docReadResponse = await documentRef.get();
  let documentContent = docReadResponse.data();

  // if we don't have a document, create one
  if (!documentContent) {
    // convert empty/falsy networks to null
    const network = context.network || null;
    // if not already present, create it
    documentContent = isDocumentMetadata(document) ?
      {
        // we could pull some of the document metadata from the realtime database,
        // but for now we trust the client to provide valid values.
        ...document,
        context_id: context.classHash,
        network,
      } :
      {
        ...document,
        uid,
        network,
      };
    await documentRef.set(documentContent);
  }
  return {ref: documentRef, data: documentContent};
}
