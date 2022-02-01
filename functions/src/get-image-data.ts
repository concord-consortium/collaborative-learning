import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { IGetImageDataUnionParams, isWarmUpParams } from "./shared";
import { validateUserContext } from "./user-context";

// update this when deploying updates to this function
const version = "1.0.0";

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
  const { classHash: userClassHash } = context || {};
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

  function firestoreImagePathPromise(): Promise<string | null> {
    return admin.firestore()
            .collection(`${firestoreRoot}/mcimages`)
            .where("url", "==", legacyUrl)
            .where("classes", "array-contains", userClassHash)
            .get()
            .then(snapshots => {
              const _imageClassPath = snapshots.docs.find(doc => !!doc.data()?.classPath)?.data()?.classPath;
              return _imageClassPath || null;
            })
            .catch(() => null);
  }

  // if we have an image class hash and it's the same as the user class hash then just look it up
  if (imageClassHash === userClassHash) {
    return firebaseImageDataPromise(userClassPath);
  }

  // if we have an image class hash and it's different from the user class hash
  // then we have to look it up in the firestore mcimages to see if it's been published
  // to this user's class.
  if (imageClassHash) {
    const _imageClassPath = await firestoreImagePathPromise();
    return _imageClassPath ? await firebaseImageDataPromise(_imageClassPath) : null;
  }

  // if we don't have an image class hash, then we have to try both approaches,
  // so we run the two initial queries in parallel.
  const [imageData, imageClassPath] = await Promise.all([
    firebaseImageDataPromise(userClassPath),
    firestoreImagePathPromise()
  ]);
  // if we found the image data then return it
  if (imageData) return imageData;
  // if we retrieved the image path from firestore then use it to retrieve the image data
  return imageClassPath ? await firebaseImageDataPromise(imageClassPath) : null;
}
