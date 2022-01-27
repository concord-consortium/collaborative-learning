import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { parseSupportContent } from "./parse-support-content";
import { buildFirebaseImageUrl, IPublishSupportUnionParams, isWarmUpParams, parseFirebaseImageUrl } from "./shared";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.0.0";

export async function canonicalizeUrl(url: string, defaultClassHash: string, firestoreRoot: string) {
  const { imageClassHash, imageKey  } = parseFirebaseImageUrl(url);
  // if it's already in canonical form (or can't be canonicalized) just return it
  if (imageClassHash || !imageKey) return url;
  // check for an entry in our `images` collection which maps legacy image urls to their classes
  const imageDoc = (await admin.firestore().doc(`${firestoreRoot}/images/${imageKey}`).get()).data();
  const classHash = imageDoc ? imageDoc.context_id : defaultClassHash;
  return buildFirebaseImageUrl(classHash, imageKey);
}

export async function publishSupport(
                        params?: IPublishSupportUnionParams,
                        callableContext?: functions.https.CallableContext) {
  if (!params) throw new functions.https.HttpsError("invalid-argument", "Required arguments are missing.");
  if (isWarmUpParams(params)) return { version };

  const { context, caption, classes, content, properties, resource_link_id, resource_url, ...others } = params;
  const { appMode, classHash, demoName: _demoName, portal: platform_id } = context || {};
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
  const { content: canonicalizedContent, images } = await parseSupportContent(content, _canonicalizeUrl);

  // only include demoName if it exists
  const demoName = _demoName ? { demoName: _demoName } : undefined;
  const supportDoc = {
    appMode, ...demoName, classes, classPath, uid, type: "supportPublication",
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
    const mcimage = { url: legacyUrl, classes, classPath: imageClassPath, supportKey,
                      platform_id, context_id: imageClassHash, resource_link_id, resource_url };
    const mcimageRef = admin.firestore().doc(`${firestoreRoot}/mcimages/${supportKey}_${imageKey}`);
    batch.set(mcimageRef, mcimage);
  }

  return batch.commit();
}
