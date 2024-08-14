import * as admin from "firebase-admin";
import { buildFirebaseImageUrl, parseFirebaseImageUrl } from "./shared-utils";

export async function canonicalizeUrl(url: string, defaultClassHash: string, firestoreRoot: string) {
  const { imageClassHash, imageKey } = parseFirebaseImageUrl(url);
  // if it's already in canonical form (or can't be canonicalized) just return it
  if (imageClassHash || !imageKey) return url;
  // check for an entry in our `images` collection which maps legacy image urls to their classes
  const imageDoc = (await admin.firestore().doc(`${firestoreRoot}/images/${imageKey}`).get()).data();
  const classHash = imageDoc ? imageDoc.context_id : defaultClassHash;
  return buildFirebaseImageUrl(classHash, imageKey);
}
