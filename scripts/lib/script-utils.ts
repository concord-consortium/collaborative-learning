import admin from "firebase-admin";
import { fileURLToPath } from 'url';
import path from 'path';
import { GrpcStatus } from "firebase-admin/firestore";

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
 * Log a list of items with a title to standard output (console.log).
 * Just passing an array of items to console.log will not print out all of them,
 * node.js automatically limits how much is logged.
 *
 * @param title
 * @param list
 */
export function logList(title: string, list: any[]) {
  console.log(`${title} (${list.length}):`);
  for (const item of list) {
    console.log("  ", item);
  }
}

/**
 * Log a list of errors with a title to standard error (console.error).
 * Just passing an array of items to console.error will not print out all of them,
 * node.js automatically limits how much is logged.
 *
 * @param title
 * @param list
 */
export function logErrorList(title: string, list: any[]) {
  console.error(`${title} (${list.length}):`);
  for (const item of list) {
    console.error("  ", item);
  }
}

type WriterFailure = {
  path: string;
  code: number;       // gRPC status code (e.g., 10=ABORTED, 14=UNAVAILABLE)
  attempts: number;
  message: string;
};

export interface WriterState {
  firestore: admin.firestore.Firestore;
  bulkWriter: admin.firestore.BulkWriter;
  operationsCount: number;
  writeErrors: WriterFailure[];
  dryRun: boolean;
}

/**
 * Copy a Firestore document, and optionally all of its subcollections.
 * There is no built-in way to do this in Firestore.
 * @param collectionFrom The collection to copy from.
 * @param docId The id of the document to copy.
 * @param collectionTo The collection to copy to.
 * @param docIdTo The id of the document to copy to. If not set, uses docId.
 * @param scope Whether to copy the base document, its subcollections, or both.
 * @returns True if the document was copied, false otherwise.
 *
 * @see https://leechy.hashnode.dev/firestore-move
 */
export const copyFirestoreDoc = async (
  state: WriterState,
  collectionFrom: string,
  docId: string,
  collectionTo: string,
  docIdTo: string | undefined,
  scope: "document" | "subcollections" | "all" = "all",
  perDocCallback: undefined | ((docId: string, docData: admin.firestore.DocumentData) => void)
): Promise<boolean> => {
  const { bulkWriter } = state;

  await internalCopyFirestoreDoc(state, collectionFrom, docId, undefined, collectionTo, docIdTo, scope, perDocCallback);

  // We wait for all of the write operations to complete so we can make sure there
  // were no failures.
  await bulkWriter.flush();

  // Look for any errors under the docIdTo path
  const writeErrors = state.writeErrors.filter((error) => error.path.startsWith(`${collectionTo}/${docIdTo ?? docId}`));
  if (writeErrors.length > 0) {
    logErrorList(`Failed to copy document from ${collectionFrom}/${docId} to ${collectionTo}/${docIdTo ?? docId}`,
      writeErrors);
    return false;
  }
  return true;
};

/**
 * Note this doesn't copy documents directly inside of the passed in document
 * It only copies documents that are in subcollections of the passed in document
 *
 * @param state
 * @param collectionFrom
 * @param docId
 * @param collectionTo
 * @param docIdTo
 * @param scope
 */
export const internalCopyFirestoreDoc = async (
  state: WriterState,
  collectionFrom: string,
  docId: string,
  preloadedDocData: admin.firestore.DocumentData | undefined,
  collectionTo: string,
  docIdTo: string | undefined,
  scope: "document" | "subcollections" | "all" = "all",
  perDocCallback: ((docId: string, docData: admin.firestore.DocumentData) => void) | undefined
): Promise<void> => {
  const { firestore, bulkWriter, dryRun } = state;
  const docRef = firestore.collection(collectionFrom).doc(docId);
  if (!docIdTo) {
    docIdTo = docId;
  }
  if (collectionFrom === collectionTo && docId === docIdTo) {
    throw new Error("Cannot copy a document to the same location.");
  }
  const copyBaseDoc = scope === "all" || scope === "document";
  const copySubcollections = scope === "all" || scope === "subcollections";

  let docData: admin.firestore.DocumentData;
  if (preloadedDocData) {
    docData = preloadedDocData;
  } else {
    // read the document
    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        // Generally we might want to allow this since some Firestore "documents" just act
        // as containers for other child documents.
        // However for the current usage of this code it is an error if the document is empty.
        // So we return without looking at the child collections.
        console.error("Non-existent source doc", `${collectionFrom}/${docId}`);
        return;
      }
      docData = doc.data();
    } catch (error) {
      console.error('Error reading document', `${collectionFrom}/${docId}`, JSON.stringify(error));
      // TODO: do we really want to throw this error?
      // It will stop the whole chain of copying the top level document
      // It might also stop the whole copy operation all together
      throw new Error('Error reading document');
    }
  }

  if (!docData) return;

  if (perDocCallback) {
    perDocCallback(docId, docData);
  }

  // document exists, create the new item
  if (copyBaseDoc) {
    const newDocRef = firestore.collection(collectionTo).doc(docIdTo);
    // Note we aren't waiting for this to complete
    // Any errors that happen during the create call will be sent to the
    // onWriteError handler.
    // If a document already exists at this location this will cause an error.
    // The onWriteError handler used by consolidate-metadata-docs.ts will
    // ignore these "document exists" errors.
    // However the error will still be "thrown".
    // It still isn't clear what will happen here with these thrown document
    // exists errors.
    // Will this be reported as an unhandled rejected promise?
    // The BulkWriter code makes it seem like that won't happen, but it is unclear.
    // The flush call is supposed to ignore any errors, so at least that won't
    // throw the error.
    if (!dryRun) {
      bulkWriter.create(newDocRef, docData)
        .catch((error) => {
          // We have to catch the errors here otherwise they cause the process to exit
          // We are already managing them in the onWriteError handler.
          if (error.code === GrpcStatus.ALREADY_EXISTS) {
            // We can ignore these already exists errors
          } else {
            // This should be recorded in other places but we log them here just incase
            console.error("Error creating document", newDocRef.path);
          }
        });
    }
    state.operationsCount++;
    // Make sure we don't build up too many write operations
    // The BulkWriter automatically does some buffering process after 500 write
    // operations. However that won't stop us from putting more and more operations
    // onto the bulkWriter. This will eventually result in out of memory issues.
    // That's because we are reading in a bunch of documents in order to write out
    // their copies.
    // So after 1000 operations we wait for them all to finish, before queuing more.
    // Note there are other places where the bulkWriter is used to create or update
    // documents, currently those other places are not counted towards the 1000 limit.
    if (state.operationsCount % 1000 === 0) {
      // As far as I can tell the flush here will wait for all of the write operations
      // to complete and honor the exponential backoff before continuing.
      await bulkWriter.flush();
    }
  }

  if (!copySubcollections) return;

  // This might throw an error if there is a network issue or a firestore limit issue
  // TODO: how should we handle that case?
  const subcollections = await docRef.listCollections();

  for (const subcollectionRef of subcollections) {
    const subcollectionPath = `${collectionFrom}/${docId}/${subcollectionRef.id}`;
    const subcollectionPathTo = `${collectionTo}/${docIdTo}/${subcollectionRef.id}`;

    process.stdout.write(`  copying ${subcollectionRef.id} `);

    // get all the documents in the collection
    try {
      let numCopiedDocs = 0;

      // Use paging to read in all of the subcollection docs
      // this should keep us from running out of memory
      let lastDoc = null;
      let snapshot;
      do {
        let query = subcollectionRef.limit(1000);
        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }
        snapshot = await query.get();
        const docs = snapshot.docs;
        for (const doc of docs) {
          // Recurse on the subcollection documents
          // We await this so if it has to flush the operations we wait for that flush
          // The waiting will also mean we will wait for the reading of the document
          // and its collection
          // For our current purposes there are never any collections in these collections
          // so we only copy the document and don't look for subcollections
          // This speeds up the process significantly.
          await internalCopyFirestoreDoc(
            state, subcollectionPath, doc.id, doc.data(), subcollectionPathTo, doc.id, "document", perDocCallback
          );
          numCopiedDocs++;
          lastDoc = doc;
        }
        process.stdout.write(".");
      } while (snapshot.docs.length === 1000);

      // Close out the status line
      process.stdout.write("\n");

      const logMessage = `${numCopiedDocs} documents from ${subcollectionRef.id}`;
      if (dryRun) {
        console.log("  would have copied", logMessage);
      } else {
        console.log("  copied", logMessage);
      }
    } catch (error) {
      // TODO: this will also capture any errors thrown by the recursive call.
      // That means source doc read errors, or listing documents of
      // subcollections. Probably those errors will be double reported.
      console.error('Error reading subcollection', subcollectionPath, error);
      throw new Error('Data was not copied properly to the target collection.');
    }
  }
};

/**
 * Move a Firestore document, and optionally all of its subcollections.
 * There is no built-in way to do this in Firestore.
 * @param state The Firestore instance, bulkWriter, operationCount, and writeErrors.
 * @param collectionFrom The collection to move from.
 * @param docId The id of the document to move.
 * @param collectionTo The collection to move to.
 * @param docIdTo The id of the document to move to. If not set, uses docId.
 * @param scope Whether to keep the base document, its subcollections, or both.
 * Note that in any case the base document and all subcollections will be deleted from
 * the original location; the scope just determines what is kept in the new location.
 * @returns True if the document was moved, false otherwise.
 *
 * @see https://leechy.hashnode.dev/firestore-move
 */
export const moveFirestoreDoc = async (
  state: WriterState,
  collectionFrom: string,
  docId: string,
  collectionTo: string,
  docIdTo?: string,
  scope: "document" | "subcollections" | "all" = "all",
): Promise<boolean> => {
  const { firestore, bulkWriter } = state;
  const copied = await copyFirestoreDoc(state, collectionFrom, docId, collectionTo, docIdTo, scope, undefined);
  // If copy was successful, delete the original
  // We use a passed in bulkWriter, so the exponential backoff will be shared
  // between the copy and delete operations.
  if (copied) {
    await firestore.recursiveDelete(firestore.doc(`${collectionFrom}/${docId}`), bulkWriter);
    return true;
  }
  throw new Error('Error while moving document.');
};
