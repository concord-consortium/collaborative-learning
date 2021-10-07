import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { IGetNetworkDocumentUnionParams, isWarmUpParams } from "./shared";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.0.0";

export async function getNetworkDocument(
                        params?: IGetNetworkDocumentUnionParams,
                        callableContext?: functions.https.CallableContext) {
  if (isWarmUpParams(params)) return { version };

  const { context, context_id: documentContextId, uid: documentUid, key: documentKey } = params || {};
  const { appMode, classHash: userContextId, network } = context || {};
  const { isValid, uid, classPath, firestoreRoot } = validateUserContext(context, callableContext?.auth);
  if (!context || !isValid || !userContextId || !network || !uid) {
    throw new functions.https.HttpsError("failed-precondition", "The provided user context is not valid.");
  };

  // validate that authenticated users are in the network they claim to be in
  if (appMode === "authed") {
    const userDocResult = await admin.firestore().doc(`/${firestoreRoot}/users/${uid}`).get();
    if (!userDocResult.exists || (userDocResult.data()?.network !== network)) {
      throw new functions.https.HttpsError("failed-precondition", "The provided user network is not valid.");
    }
  }

  // verify that the requested class is available in the network
  const classDocResult = await admin.firestore().doc(`/${firestoreRoot}/classes/${network}_${documentContextId}`).get();
  const classDoc = classDocResult.exists ? classDocResult.data() : undefined;
  if (network && (network !== classDoc?.network)) {
    throw new functions.https.HttpsError("permission-denied", "The requested document is not available in the network.");
  }

  if (!documentUid || !documentKey) {
    throw new functions.https.HttpsError("failed-precondition", "The requested document is incompletely specified.");
  }

  // lop off the last element of the path to get the root
  const databaseRoot = classPath.split("/").slice(0, -1).join("/");
  // all of a user's documents for a given class are stored under their uid
  const classUserRoot = `${databaseRoot}/${documentContextId}/users/${documentUid}`;

  let documentContent: any;
  let documentMetadata: any;
  try {
    const [documentContentSnap, documentMetadataSnap] = await Promise.all([
      admin.database().ref(`${classUserRoot}/documents/${documentKey}`).get(),
      admin.database().ref(`${classUserRoot}/documentMetadata/${documentKey}`).get()
    ]);
    documentContent = documentContentSnap.val() || undefined;
    documentMetadata = documentMetadataSnap.val() || undefined;

    if (!documentContent) {
      throw new functions.https.HttpsError("not-found", "An error occurred when reading the requested document.");
    }
  }
  catch(e) {
    throw new functions.https.HttpsError("not-found", "An error occurred when reading the requested document.");
  }

  // return the requested document content and metadata
  return { version, content: documentContent, metadata: documentMetadata };
};
