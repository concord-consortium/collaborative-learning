import admin from "firebase-admin";
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsRoot = path.resolve(__dirname, "..");

// _duration should be in miliseconds
export function prettyDuration(_duration: number) {
  const miliseconds = _duration % 1000;
  const totalSeconds = Math.floor(_duration / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const hourPart = hours > 0 ? `${hours}:` : "";
  const minutePart = hourPart || minutes > 0 ? `${minutes}:` : "";
  const secondPart = minutePart || seconds > 0 ? `${seconds}.` : "";
  return `${hourPart}${minutePart}${secondPart}${miliseconds}`;
}

export function getFirebaseBasePath(portal: string, demo?: string | boolean) {
  return demo
    ? `/demo/${demo}/portals/demo/classes`
    : `/authed/portals/${portal?.replace(/\./g, "_")}/classes`;
}

export function getFirestoreBasePath(portal: string, demo?: string | boolean) {
  return demo
    ? `demo/${demo}/documents`
    : `authed/${portal.replace(/\./g, "_")}/documents`;
}

export function getFirestoreUsersPath(portal: string, demo?: string | boolean) {
  return demo
    ? `demo/${demo}/users`
    : `authed/${portal.replace(/\./g, "_")}/users`;
}

export function getFirestoreClassesPath(portal: string, demo?: string | boolean) {
  return demo
    ? `demo/${demo}/classes`
    : `authed/${portal.replace(/\./g, "_")}/classes`;
}

export function getScriptRootFilePath(filename: string) {
  return path.resolve(scriptsRoot, filename);
}

// eslint-disable-next-line prefer-regex-literals
const clueBranchRegExp = new RegExp("^https://[^/]*(/[^?]*)");
export function getClueBranch(activityUrl: string) {
  return clueBranchRegExp.exec(activityUrl)?.[1];
}

// eslint-disable-next-line prefer-regex-literals
const unitParamRegExp = new RegExp("unit=([^&]*)");
export function getUnitParam(activityUrl: string) {
  return unitParamRegExp.exec(activityUrl)?.[1];
}

// eslint-disable-next-line prefer-regex-literals
const unitBranchRegExp = new RegExp("/branch/[^/]*");
export function getUnitBranch(unitParam: string | undefined) {
  if (unitParam?.startsWith("https://")) {
    return unitBranchRegExp.exec(unitParam)?.[0];
  } else {
    return "";
  }
}

// eslint-disable-next-line prefer-regex-literals
const unitCodeRegExp = new RegExp("/([^/]*)/content.json");
export function getUnitCode(unitParam: string | undefined) {
  if (unitParam?.startsWith("https://")) {
    const unitCode = unitCodeRegExp.exec(unitParam)?.[1];
    return unitCode ? unitCode : null;
  } else {
    return unitParam ? unitParam : null;
  }
}

export function getProblemDetails(url: string) {
  const activityURL = new URL(url);
  const urlParams = activityURL.searchParams;
  const unitParam = urlParams.get("unit");
  // The unit param's value may be a unit code or a full url, so we make sure to get just the unit code
  const unit = getUnitCode(unitParam);
  const investigationAndProblem = urlParams.get("problem");
  const [investigation, problem] = investigationAndProblem ? investigationAndProblem.split(".") : [null, null];
  return { investigation, problem, unit };
}

/**
 * Create a new Record based on a passed in Record. The keys in the new Record
 * are computed by the passed in getNewKey function.
 * If getNewKey returns a falsely value the entry is skipped and it is logged
 * to the console.
 *
 * @param originalMap
 * @param getNewKey
 * @returns
 */
export function remap(
  originalMap: Record<string, any>,
  getNewKey: (value: any) => string | undefined
) {
  if (!originalMap) return undefined;
  const newMap = {};
  for (const [originalKey, value] of Object.entries(originalMap)) {
    const newKey = getNewKey(value);
    if (!newKey) {
      console.log("Invalid value found: ", originalKey, value);
      continue;
    }
    newMap[newKey] = value;
  }
  return newMap;
}

/**
 * Firebase publications are stored with different keys than their document
 * id for some reason. In some cases the real document id is in self.documentKey
 * so we make a map with that documentKey as the key of the map.
 *
 * @param fbPublications
 */
export function remapFirebaseClassPublications(fbPublications: Record<string, any>) {
  return remap(fbPublications, (metadata) => metadata?.self?.documentKey);
}

/**
 * Firebase publications are stored with different keys than their document
 * id for some reason. In some cases the real document id is in documentKey
 * so we make a map with that documentKey as the key of the map.
 * @param fbPublications
 */
export function remapFirebaseProblemDocPublications(fbPublications: Record<string, any>) {
  return remap(fbPublications, (metadata) => metadata?.documentKey);
}

/**
 * Copy a Firestore document, and optionally all of its subcollections.
 * There is no built-in way to do this in Firestore.
 * @param collectionFrom The collection to copy from.
 * @param docId The id of the document to copy.
 * @param collectionTo The collection to copy to.
 * @param docIdTo The id of the document to copy to. If not set, uses docId.
 * @param scope Whether to copy the base document, its subcollections, or both.
 * @param addData Additional data to add to the new document.
 * @returns True if the document was copied, false otherwise.
 *
 * @see https://leechy.hashnode.dev/firestore-move
 */
export const copyFirestoreDoc = async (
  firestore: admin.firestore.Firestore,
  collectionFrom: string,
  docId: string,
  collectionTo: string,
  docIdTo?: string,
  scope: "document" | "subcollections" | "all" = "all",
  addData: admin.firestore.DocumentData = {},
  bulkWriter: admin.firestore.BulkWriter = null,
): Promise<boolean> => {
  const shouldCommit = bulkWriter === null;
  if (shouldCommit) {
    bulkWriter = firestore.bulkWriter();
  }
  const docRef = firestore.collection(collectionFrom).doc(docId);
  if (!docIdTo) {
    docIdTo = docId;
  }
  if (collectionFrom === collectionTo && docId === docIdTo) {
    throw new Error("Cannot copy a document to the same location.");
  }
  const copyBaseDoc = scope === "all" || scope === "document";
  const copySubcollections = scope === "all" || scope === "subcollections";

  // read the document
  const docData = await docRef
    .get()
    .then((doc) => doc.exists && doc.data())
    .catch((error) => {
      console.error('Error reading document', `${collectionFrom}/${docId}`, JSON.stringify(error));
      throw new Error('Error reading document');
    });

  if (docData) {
    // document exists, create the new item
    if (copyBaseDoc) {
      const newDocRef = firestore.collection(collectionTo).doc(docIdTo);
      bulkWriter.create(newDocRef, docData);
    }

    if (copySubcollections) {
      const subcollections = await docRef.listCollections();
      for await (const subcollectionRef of subcollections) {
        const subcollectionPath = `${collectionFrom}/${docId}/${subcollectionRef.id}`;
        const subcollectionPathTo = `${collectionTo}/${docIdTo}/${subcollectionRef.id}`;

        // get all the documents in the collection
        await subcollectionRef
          .get()
          .then(async (snapshot) => {
            const docs = snapshot.docs;
            const promises = [];
            for await (const doc of docs) {
              promises.push(copyFirestoreDoc(firestore, subcollectionPath, doc.id,
                subcollectionPathTo, doc.id, "all", bulkWriter));
            }
            await Promise.all(promises);
            return true;
          })
          .catch((error) => {
            console.error('Error reading subcollection', subcollectionPath, error);
            throw new Error('Data was not copied properly to the target collection.');
          });
      }
    }
    if (shouldCommit) {
      await bulkWriter.close();
    }
    return true;
  }
  return false;
};

/**
 * Move a Firestore document, and optionally all of its subcollections.
 * There is no built-in way to do this in Firestore.
 * @param firestore The Firestore instance.
 * @param collectionFrom The collection to move from.
 * @param docId The id of the document to move.
 * @param collectionTo The collection to move to.
 * @param docIdTo The id of the document to move to. If not set, uses docId.
 * @param addData Additional data to add to the new document.
 * @param scope Whether to keep the base document, its subcollections, or both.
 * Note that in any case the base document and all subcollections will be deleted from
 * the original location; the scope just determines what is kept in the new location.
 * @returns True if the document was moved, false otherwise.
 *
 * @see https://leechy.hashnode.dev/firestore-move
 */
export const moveFirestoreDoc = async (
  firestore: admin.firestore.Firestore,
  collectionFrom: string,
  docId: string,
  collectionTo: string,
  docIdTo?: string,
  scope: "document" | "subcollections" | "all" = "all",
  addData?: admin.firestore.DocumentData,
): Promise<boolean> => {
  const copied = await copyFirestoreDoc(firestore, collectionFrom, docId, collectionTo, docIdTo, scope, addData);
  // if copy was successful, delete the original
  if (copied) {
    await firestore.recursiveDelete(firestore.doc(`${collectionFrom}/${docId}`));
    return true;
  }
  throw new Error('Error while moving document.');
};
