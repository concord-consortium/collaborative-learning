#!/usr/bin/node

// Find all "commentable documents" using old-style prefixed paths, and move them
// to the unprefixed location. Multiple documents may be consolidated into a single one
// if they share the same key.

// $ cd scripts
// $ npx tsx consolidate-comments.ts

import admin from "firebase-admin";
import { GrpcStatus } from "firebase-admin/firestore";
import _ from "lodash";
import {
  copyFirestoreDoc, getFirestoreBasePath, getScriptRootFilePath, logErrorList,
  logList, WriterState
} from "./lib/script-utils.js";

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

const portal = "";
const demo = "CLUE-Test";
const dryRun = true;

const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
const credential = admin.credential.cert(serviceAccountFile);
// Initialize the app with a service account, granting admin privileges
const fbApp = admin.initializeApp({
  credential,
  databaseURL
});
const firestore = fbApp.firestore();

const documentsRoot = getFirestoreBasePath(portal, demo);

const keyPattern = "[a-zA-Z0-9_\\-]{20}";
const unprefixedPattern = new RegExp("^" + keyPattern + "$");
const prefixedPattern = new RegExp("^.+_(" + keyPattern + ")$");

interface DocumentInfo {
  key: string;
  commentableDocs: { name: string, type: string }[]
}

function isCurriculum(documentName: string) {
  return documentName.startsWith("curriculum:");
}

function isPrefixed(documentName: string) {
  return documentName.match(prefixedPattern);
}

function isUnprefixed(documentName: string) {
  return documentName.match(unprefixedPattern);
}

function typeOfDocument(docSnapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  const documentName = docSnapshot.id;
  if (isCurriculum(documentName)) {
    return "curriculum";
  } else if (isPrefixed(documentName)) {
    return "prefixed";
  } else if (isUnprefixed(documentName) && documentName === docSnapshot.data().key) {
    return "unprefixed";
  } else {
    return "error";
  }
}

async function getAllDocuments(ref: FirebaseFirestore.CollectionReference) {
  console.log("Ok Getting all documents from", ref.path);
  const documents: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const batchSize = 1000;

  // This fetches 100 matching documents at a time to avoid query limits or memory issues.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = ref
      .select("key")
      .limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    documents.push(...snapshot.docs);
    console.log("Ok ...", documents.length);

    if (snapshot.docs.length < batchSize) {
      break; // No more documents to fetch
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return documents;
}

interface DocumentUpdates { [key: string]: any }

interface MergeResult {
  errors: string[];
  newData: admin.firestore.DocumentData;
}

// Checks and combines two documents.
// Key fields must match; a few can differ and we combine them smartly.
async function checkAndMerge(
  name: string,
  baseData: admin.firestore.DocumentData,
  updates: DocumentUpdates
): Promise<MergeResult> {
  // Make sure that the contents of the new document match the existing one.
  const mustMatch = ["key", "uid", "context_id", "type", "title", ];
  const otherFields = ["tools", "tileTypes", "strategies", "teachers", "originDoc", "contextId", "createdAt",
    "unit", "investigation", "problem", "visibility", "offeringId", "properties", "network"
  ];
  const propertiesFields = ["pubCount", "isDeleted"];

  const newDoc = await firestore.doc(documentsRoot + "/" + name).get();
  const newData = newDoc.data();

  const errors: string[] = [];

  for (const field of mustMatch) {
    if (!_.isEqual(newData[field], baseData[field]) && (newData[field] || baseData[field])) {
      errors.push(`mismatch in ${field} new data: ${newData[field]} base data: ${baseData[field]}`);
    }
  }
  // Check that there are no fields beyond the ones in our mustMatch and otherFields lists.
  const newFields = Object.keys(newData);
  const baseFields = Object.keys(baseData);
  for (const field of newFields) {
    if (!mustMatch.includes(field) && !otherFields.includes(field)) {
      errors.push(`unexpected field in newDoc: ${field}`);
    }
  }
  for (const field of baseFields) {
    if (!mustMatch.includes(field) && !otherFields.includes(field)) {
      errors.push(`unexpected field in baseDoc: ${field}`);
    }
  }

  // See if there are any updates needed

  // createdAt -- choose the earlier one.
  if (newData.createdAt && (!baseData.createdAt || newData.createdAt < baseData.createdAt)) {
    updates.createdAt = newData.createdAt;
  }
  // unit, investigation, problem, visibility, offeringId -- if one has a value, use that.
  if (newData.unit && !baseData.unit) {
    updates.unit = newData.unit;
  }
  if (newData.unit && baseData.unit && newData.unit !== baseData.unit) {
    errors.push(`mismatch in unit, new: ${newData.unit} base: ${baseData.unit}`);
  }
  if (newData.investigation && !baseData.investigation) {
    updates.investigation = newData.investigation;
  }
  if (newData.investigation && baseData.investigation && newData.investigation !== baseData.investigation) {
    errors.push(`mismatch in investigation, new: ${newData.investigation} base: ${baseData.investigation}`);
  }
  if (newData.problem && !baseData.problem) {
    updates.problem = newData.problem;
  }
  if (newData.problem && baseData.problem && newData.problem !== baseData.problem) {
    errors.push(`mismatch in problem, new: ${newData.problem} base: ${baseData.problem}`);
  }
  if (newData.visibility && !baseData.visibility) {
    updates.visibility = newData.visibility;
  }
  if (newData.visibility && baseData.visibility && newData.visibility !== baseData.visibility) {
    errors.push(`mismatch in visibility, new: ${newData.visibility} base: ${baseData.visibility}`);
  }
  if (newData.offeringId && !baseData.offeringId) {
    updates.offeringId = newData.offeringId;
  }
  if (newData.offeringId && baseData.offeringId && newData.offeringId !== baseData.offeringId) {
    errors.push(`mismatch in offeringId, new: ${newData.offeringId} base: ${baseData.offeringId}`);
  }
  // tileTypes, tools, strategies -- choose the one with more values.
  if (newData.tileTypes && (!baseData.tileTypes || newData.tileTypes.length > baseData.tileTypes.length)) {
    updates.tileTypes = newData.tileTypes;
  }
  if (newData.tools && (!baseData.tools || newData.tools.length > baseData.tools.length)) {
    updates.tools = newData.tools;
  }
  if (newData.strategies && (!baseData.strategies || newData.strategies.length > baseData.strategies.length)) {
    updates.strategies = newData.strategies;
  }
  // originDoc -- if one has a value, use that.
  if (newData.originDoc !== undefined && baseData.originDoc === undefined) {
    updates.originDoc = newData.originDoc;
  }
  if (!_.isEmpty(newData.properties) && _.isEmpty(baseData.properties)) {
    updates.properties = newData.properties;
  }
  if (!_.isEmpty(newData.properties) && !_.isEmpty(baseData.properties)
    && !_.isEqual(newData.properties, baseData.properties)) {
    // Warn if the properties contains any fields other than pubCount or isDeleted
    if (Object.keys(newData.properties).some(k => !propertiesFields.includes(k))
      || Object.keys(baseData.properties).some(k => !propertiesFields.includes(k))) {
        errors.push(`unknown field in properties, ` +
          `new: ${newData.properties.toJSON()} ` +
          `base: ${baseData.properties.toJSON()}`
        );
    }
    updates.properties = baseData.properties;
    if (newData.properties.pubCount !== undefined) {
      // For pubCount, keep the larger one.
      updates.properties.pubCount = Math.max(newData.properties.pubCount, baseData.properties.pubCount || 0);
    }
    if (newData.properties.isDeleted !== undefined && baseData.properties.isDeleted === undefined) {
      // For isDeleted, keep whichever has a value.
      updates.properties.isDeleted = newData.properties.isDeleted;
    }
  }

  // teachers, contextId, network -- not used any more, just ignore.

  return {
    errors,
    newData
  };
}

const oneWeekAgoSeconds = Date.now() - 7 * 24 * 60 * 60;

async function reorganizeDocuments() {
  const documentsRef = firestore.collection(documentsRoot);
  const documents = await getAllDocuments(documentsRef);
  let docsToProcess = 0;
  let docsProcessed = 0;
  const docInfo: { [key: string]: DocumentInfo } = {};
  const errorDocs = [];
  const curriculumDocs = [];
  for (const docSnapshot of documents) {
    const type = typeOfDocument(docSnapshot);
    if (type === "error") {
      errorDocs.push(docSnapshot.id);
      continue;
    }
    if (type === "curriculum") {
      curriculumDocs.push(docSnapshot.id);
      continue;
    }
    const unprefixed = docSnapshot.data().key;

    if (!(unprefixed in docInfo)) {
      docsToProcess++;
      docInfo[unprefixed] = { key: unprefixed, commentableDocs: [] };
    }
    docInfo[unprefixed].commentableDocs.push({ name: docSnapshot.id, type });
  }

  if (errorDocs.length > 0) {
    logList("Err Unexpected documents found, ignoring:", errorDocs);
  }
  if (curriculumDocs.length > 0) {
    logList("Curriculum documents found, ignoring:", curriculumDocs);
  }

  const writerState: WriterState = {
    firestore,
    bulkWriter: firestore.bulkWriter(),
    operationsCount: 0,
    writeErrors: [],
    dryRun
  };

  const allowedExistingPaths = new Set<string>();
  let resourceExhaustedErrors = 0;

  writerState.bulkWriter.onWriteError((err) => {
    // Because this script has been run before and then stopped in the middle there are some
    // documents that have been partially processed. This means they have history and comment
    // entries already copied into the unprefixed document. These history and comment entries
    // have unique ids, so if they already exist we can just ignore this error.
    if (err.code === GrpcStatus.ALREADY_EXISTS) {
      for (const allowedExistingPath of allowedExistingPaths) {
        if (err.documentRef.path.startsWith(allowedExistingPath)) {
          // We reject the promise here, but don't record it as a writeError
          return false;
        }
      }

    }

    const retriable = (
      err.code === GrpcStatus.ABORTED ||
      err.code === GrpcStatus.UNAVAILABLE ||
      err.code === GrpcStatus.RESOURCE_EXHAUSTED
    ) && err.failedAttempts < 10;
    if (err.code === GrpcStatus.RESOURCE_EXHAUSTED) {
      resourceExhaustedErrors++;
      if (resourceExhaustedErrors > 10) {
        console.error("Err Too many resource exhausted errors, exiting");
        logErrorList("Err Errors during writes:", writerState.writeErrors);
        // If we are getting resource exhausted errors then we should stop
        // trying to write more documents.
        process.exit(1);
      }
    }
    if (!retriable) {
      writerState.writeErrors.push({
        path: err.documentRef.path,
        code: err.code,
        attempts: err.failedAttempts,
        message: err.message,
      });
    }
    return retriable; // true = retry, false = stop and reject that write's Promise
  });

  for (const key in docInfo) {
    const documentInfo = docInfo[key];
    const hasUnprefixedDoc = documentInfo.commentableDocs.some(doc => doc.type === "unprefixed");
    docsProcessed++;
    console.log("Processing", key, `(${docsProcessed}/${docsToProcess}) :`);
    if (hasUnprefixedDoc && documentInfo.commentableDocs.length === 1) {
      console.log("  only found an unprefixed doc, nothing to do");
      continue;
    }

    // We want a single write to the unprefixed/base document
    // So we maintain a local copy of the base document data. If this document
    // already exists in Firestore then we track any updates needed to it.
    // If the document doesn't exist then we start the content with the first
    // prefixed document and then merge any additional prefixed documents into this
    // one.
    // At the end we either apply the updates to the existing document or we create
    // a new document.
    // Finally if there are no errors then we delete the old documents
    const baseDocRef = firestore.doc(documentsRoot + "/" + key);
    let baseDocData: admin.firestore.DocumentData | undefined;
    let updates: DocumentUpdates | undefined;

    if (hasUnprefixedDoc) {
      const baseDoc = await baseDocRef.get();
      baseDocData = baseDoc.data();
      updates = {};
    }

    const documentsToDelete: string[] = [];

    // Ignore errors for existing documents under this baseDocument
    const subDocumentsPath = baseDocRef.path + "/";
    allowedExistingPaths.add(subDocumentsPath);
    let skipBecauseOfMergeErrors = false;
    let skipBecauseRecentDocument = false;
    let mostRecentPrefixedCreatedTime = 0;
    let mostRecentSubDocumentCreatedTime = 0;

    for (const doc of documentInfo.commentableDocs) {
      if (doc.type === "unprefixed") {
        console.log("  unprefixed doc, leave as is", doc.name);
      } else if (doc.type === "prefixed") {
        let prefixedCreatedTime: number | undefined | null;
        if (baseDocData) {
          console.log("  merging prefixed doc into base", doc.name);
          const mergeResult = await checkAndMerge(doc.name, baseDocData, updates);
          if (mergeResult.errors.length > 0) {
            // We don't exit the entire script if the sanity check fails
            // We just log the errors and don't make any changes to the database for this
            // document.
            logErrorList(`Err Sanity check failed for prefixed doc: ${doc.name}`, mergeResult.errors);
            skipBecauseOfMergeErrors = true;
          }
          prefixedCreatedTime = mergeResult.newData.createdAt;
        } else {
          console.log("  using first prefixed doc as base", doc.name);
          // There is no baseDoc yet so the first prefixed document we find
          // becomes the initial content of the baseDoc
          const newBaseDoc = await firestore.doc(documentsRoot + "/" + doc.name).get();
          baseDocData = newBaseDoc.data();

          // We set the updates to this baseDocData. This way any changes
          // merged from additional prefixed documents will directly update the
          // baseDocData that we are going to write out at the end.
          updates = baseDocData;

          prefixedCreatedTime = baseDocData.createdAt;
        }

        if (skipBecauseOfMergeErrors) {
          continue;
        }

        // This seems to be in milliseconds not seconds
        console.log("  prefixedCreatedTime:", prefixedCreatedTime);

        if (prefixedCreatedTime != null) {

          // If ts is greater than November 20, 2286 in seconds, it's probably ms
          // That date is April 26, 1970 in milliseconds, so anything less than that is probably seconds
          if (prefixedCreatedTime > 10000000000) {
            prefixedCreatedTime = Math.floor(prefixedCreatedTime / 1000);
          }

          mostRecentPrefixedCreatedTime = Math.max(mostRecentPrefixedCreatedTime, prefixedCreatedTime);

          if (prefixedCreatedTime > oneWeekAgoSeconds) {
            // prefixedCreatedTime is more recent than 1 week ago
            skipBecauseRecentDocument = true;
            continue;
          }
        }

        // Copy comments, history, or whatever subcollections it finds under the parent,
        console.log("  copying subcollections from", doc.name, "to", key);
        const startingOperationsCount = writerState.operationsCount;
        // If writerState.dryRun is true, we won't actually update the database
        const copied = await copyFirestoreDoc(
          writerState,
          documentsRoot, doc.name,
          documentsRoot, key,
          "subcollections",
          (docId, docData) => {
            const { created } = docData;
            if (created && created.seconds) {
              mostRecentSubDocumentCreatedTime = Math.max(mostRecentSubDocumentCreatedTime, created.seconds);
            }
          }
        );

        const docsCopied = writerState.operationsCount - startingOperationsCount;
        if (dryRun) {
          console.log("  would have copied", docsCopied, "documents");
        } else {
          console.log("  copied", docsCopied, "documents");
        }

        if (!copied) {
          console.error("Err Failed to copy document", doc.name, "to", key);
          process.exit(1);
        }

        documentsToDelete.push(doc.name);
      } else {
        throw new Error("Unexpected document type: " + doc.type);
      }
    }

    allowedExistingPaths.delete(subDocumentsPath);

    if (skipBecauseOfMergeErrors) {
      console.log("  skipping document due to merge errors");
      continue;
    }

    console.log("  mostRecentPrefixedCreatedTime:", mostRecentPrefixedCreatedTime);
    if (skipBecauseRecentDocument) {
      console.log("  skipping document because it has a recent prefixed document");
      continue;
    }

    console.log("  mostRecentSubDocumentCreatedTime:", mostRecentSubDocumentCreatedTime);
    if (mostRecentSubDocumentCreatedTime > oneWeekAgoSeconds) {
      console.log("  skipping document because it has a recent sub-document");
      continue;
    }

    if (hasUnprefixedDoc) {
      // We had a unprefixed document already
      // If there are changes from prefixed documents we need to update this doc
      if (Object.keys(updates).length > 0) {
        if (dryRun) {
          console.log("  would update base document:", updates);
        } else {
          console.log("  updating base document:", updates);
          // We can't wait for the update to complete here, because of how the
          // BulkWriter works. Instead we wait for it with a flush later.
          // The error will be reported here as well as in the onWriteError handler.
          // We report it in both places just to be safe.
          writerState.bulkWriter.update(baseDocRef, updates)
            .catch((error) => {
              console.error("Error updating base document:", baseDocRef.path, error);
            });
        }
      } else {
        console.log("  no updates to base document");
      }
    } else {
      // We didn't have a base (unprefixed) document, so we need to create one
      if (!baseDocData) {
        throw new Error("No baseDocData for key " + key);
      }
      if (dryRun) {
        console.log("  would create base document:", baseDocData);
      } else {
        console.log("  creating base document:", baseDocData);

        // The bulkWriter.create call is asynchronous, but using await
        // with it doesn't work. The promise returned by create doesn't resolve
        // by itself, a flush or close has to be called before it resolves.
        // Also if we don't handle the error here, node.js will automatically
        // exit with an unhandled error.
        writerState.bulkWriter.create(baseDocRef, baseDocData)
          .catch((error) => {
            console.error("Error creating base document:", baseDocRef.path, error);
          });
      }
    }

    await writerState.bulkWriter.flush();
    if (writerState.writeErrors.length > 0) {
      logErrorList("Err Errors during writes:", writerState.writeErrors);
      process.exit(1);
    }

    if (documentsToDelete.length > 0) {
      if (dryRun) {
        console.log("  would delete documents:", documentsToDelete);
      } else {
        for (const doc of documentsToDelete) {
          if (doc === "" || doc == null) {
            console.log("  skipping empty document deletion:", doc);
            continue;
          }
          console.log("  deleting document:", doc);
          await firestore.recursiveDelete(firestore.doc(documentsRoot + "/" + doc), writerState.bulkWriter);
        }
      }
    }
  }
}

await reorganizeDocuments();
