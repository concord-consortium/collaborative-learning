import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { IGetImageDataUnionParams, isWarmUpParams } from "./shared";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.0.1";

function parseImageUrl(url: string) {
  const match = /ccimg:\/\/fbrtdb\.concord\.org\/([^/]+)(\/([^/]+))?/.exec(url);
  const imageKey = match?.[3] || match?.[1];
  const imageClassHash = match?.[3] ? match?.[1] : undefined;
  const legacyUrl = imageClassHash ? url.replace(`/${imageClassHash}`, ""): url;
  return { imageClassHash, imageKey, legacyUrl };
}

export async function getImageData(
                        params?: IGetImageDataUnionParams,
                        callableContext?: functions.https.CallableContext) {
  if (isWarmUpParams(params)) return { version };

  const { context, url } = params || {};
  const { classHash: userClassHash, network, type } = context || {};
  const { isValid, uid, classPath: userClassPath, firestoreRoot } = validateUserContext(context, callableContext?.auth);
  if (!isValid || !userClassHash || !uid) {
    throw new functions.https.HttpsError("invalid-argument", "The provided user context is not valid.");
  };
  if (!url) {
    throw new functions.https.HttpsError("invalid-argument", "The requested url is not valid.");
  };

  const { imageClassHash, imageKey, legacyUrl } = parseImageUrl(url);
  if (!imageKey) {
    throw new functions.https.HttpsError("invalid-argument", "The requested url is not valid.");
  };

  function firebaseImageDataPromise(classPath: string) {
    return admin.database()
            .ref(`${classPath}/images/${imageKey}`)
            .get()
            .then(snapshot => snapshot.val())
            .catch(() => null);
  }

  function processImageSnapshots(snaps: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>) {
    const _imageClassPath = snaps.docs.find(doc => !!doc.data()?.classPath)?.data()?.classPath;
    return _imageClassPath || null;
  }

  function firestorePublishedImagePromise(): Promise<string | null> {
    return admin.firestore()
            .collection(`${firestoreRoot}/mcimages`)
            .where("url", "==", legacyUrl)
            .where("classes", "array-contains", userClassHash)
            .get()
            .then(processImageSnapshots)
            .catch(() => null);
  }

  function firestoreNetworkImagePromise(): Promise<string | null> {
    return network && (type === "teacher")
            ? admin.firestore()
                .collection(`${firestoreRoot}/mcimages`)
                .where("url", "==", legacyUrl)
                .where("network", "==", network)
                .get()
                .then(processImageSnapshots)
                .catch(() => null)
            : Promise.resolve(null);
  }

  // if we have an image class hash and it's the same as the user class hash then just look it up
  if (imageClassHash === userClassHash) {
    return firebaseImageDataPromise(userClassPath);
  }

  // if we don't have an image class hash, or the image class hash doesn't match the user's class,
  // then we have to try multiple approaches, so we run multiple queries in parallel.
  const [imageData, imageClassPath1, imageClassPath2] = await Promise.all([
    // if we have an imageClassHash, then it's not in the user's class (that case was handled above)
    // if we don't have a class hash, then it could be in the user's class, so we have to check
    imageClassHash ? Promise.resolve(null) : firebaseImageDataPromise(userClassPath),
    firestorePublishedImagePromise(), // has it been published to this user's class?
    firestoreNetworkImagePromise()    // has it been shared with this teacher's network?
  ]);
  // if we found the image data then return it
  if (imageData) return imageData;
  // if we retrieved the image path from firestore then use it to retrieve the image data
  const imageClassPath = imageClassPath1 || imageClassPath2;
  return imageClassPath ? await firebaseImageDataPromise(imageClassPath) : null;
}
