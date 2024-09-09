import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { canonicalizeUrl } from "./canonicalize-url";
import { parseDocumentContent } from "./parse-document-content";
import { IPublishSupportUnionParams, isWarmUpParams } from "../../shared/shared";
import { parseFirebaseImageUrl } from "../../shared/shared-utils";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.0.4";

export async function publishSupport(
                        params?: IPublishSupportUnionParams,
                        callableContext?: functions.https.CallableContext) {
  if (!params) throw new functions.https.HttpsError("invalid-argument", "Required arguments are missing.");
  if (isWarmUpParams(params)) return { version };

  const { context, caption, classes, content, properties, resource_link_id, resource_url, ...others } = params;
  const { appMode, classHash, demoName: _demoName, portal: platform_id, network: _network } = context || {};
  const { isValid, uid, classPath, firestoreRoot } = validateUserContext(context, callableContext?.auth);
  if (!appMode || !isValid || !classHash || !classPath || !uid) {
    throw new functions.https.HttpsError("invalid-argument", "The provided user context is not valid.");
  };
  if (!classes?.length) {
    throw new functions.https.HttpsError("invalid-argument", "The request does not include any target classes.");
  };
  if (!content) {
    throw new functions.https.HttpsError("invalid-argument", "The document to be published has no content.");
  };

  const _canonicalizeUrl = (url: string) => canonicalizeUrl(url, classHash, firestoreRoot);
  const { content: canonicalizedContent, images } = await parseDocumentContent(content, _canonicalizeUrl);

  // only include demoName and network if they exist
  const demoName = _demoName ? { demoName: _demoName } : undefined;
  const network = _network ? { network: _network } : undefined;
  const supportDoc = {
    appMode, ...demoName, classes, classPath, uid, ...network,
    type: "supportPublication",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    properties: { teacherSupport: "true", caption, ...properties },
    content: canonicalizedContent, platform_id, context_id: classHash,
    resource_link_id, resource_url, ...others
  };

  const batch = admin.firestore().batch();

  // update the root time stamp
  batch.set(admin.firestore().doc(firestoreRoot), { updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  // write the support itself
  const supportDocRef = admin.firestore().collection(`${firestoreRoot}/mcsupports`).doc();
  const supportKey = supportDocRef.id;
  batch.set(supportDocRef, supportDoc);

  // write an mcimages entry for each image
  for (const legacyUrl in images) {
    const { imageClassHash = classHash, imageKey } = parseFirebaseImageUrl(images[legacyUrl]);
    const imageClassPath = classPath.replace(classHash, imageClassHash);
    const mcimage = { url: legacyUrl, classes, classPath: imageClassPath, supportKey, ...network,
                      platform_id, context_id: imageClassHash, resource_link_id, resource_url };
    const mcimageRef = admin.firestore().doc(`${firestoreRoot}/mcimages/${supportKey}_${imageKey}`);
    batch.set(mcimageRef, mcimage);
  }

  return batch.commit();
}
