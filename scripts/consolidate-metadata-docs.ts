#!/usr/bin/node

// Find all "commentable documents" using old-style prefixed paths, and move them
// to the unprefixed location. Multiple documents may be consolidated into a single one
// if they share the same key.

// $ cd scripts
// $ npx tsx consolidate-comments.ts

import admin from "firebase-admin";
import _ from "lodash";
import { getFirestoreBasePath, getScriptRootFilePath, moveFirestoreDoc } from "./lib/script-utils.js";

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
  const batchSize = 100;

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

function displayList(title: string, list: any[]) {
  console.log(`Err ${title} (${list.length}):`);
  for (const item of list) {
    console.log("Err  ", item);
  }
}

// Checks and combines two documents.
// Key fields must match; a few can differ and we combine them smartly.
async function checkAndMerge(name: string, key: string) {
  // Make sure that the contents of the new document match the existing one.
  const mustMatch = ["key", "uid", "context_id", "type", "title", ];
  const otherFields = ["tools", "tileTypes", "strategies", "teachers", "originDoc", "contextId", "createdAt",
    "unit", "investigation", "problem", "visibility", "offeringId", "properties", "network"
  ];
  const propertiesFields = ["pubCount", "isDeleted"];

  const newDoc = await firestore.doc(documentsRoot + "/" + name).get();
  const newData = newDoc.data();
  const oldDoc = await firestore.doc(documentsRoot + "/" + key).get();
  const oldData = oldDoc.data();
  if (dryRun && oldData === undefined) {
    // Since we're in dry run mode, this documents may not have been written.
    return true;
  }

  for (const field of mustMatch) {
    if (!_.isEqual(newData[field], oldData[field]) && (newData[field] || oldData[field])) {
      console.error("Err Sanity check failed, mismatch in", field);
      console.error("Err New data:", newData);
      console.error("Err Old data:", oldData);
      return false;
    }
  }
  // Check that there are no fields beyond the ones in our mustMatch and otherFields lists.
  const newFields = Object.keys(newData);
  const oldFields = Object.keys(oldData);
  for (const field of newFields) {
    if (!mustMatch.includes(field) && !otherFields.includes(field)) {
      console.error("Err Sanity check failed, unexpected field:", field);
      return false;
    }
  }
  for (const field of oldFields) {
    if (!mustMatch.includes(field) && !otherFields.includes(field)) {
      console.error("Err Sanity check failed, unexpected field:", field);
      return false;
    }
  }

  // See if there are any updates needed
  const updates: { [key: string]: any } = {};

  // createdAt -- choose the earlier one.
  if (newData.createdAt && (!oldData.createdAt || newData.createdAt < oldData.createdAt)) {
    updates.createdAt = newData.createdAt;
  }
  // unit, investigation, problem, visibility, offeringId -- if one has a value, use that.
  if (newData.unit && !oldData.unit) {
    updates.unit = newData.unit;
  }
  if (newData.unit && oldData.unit && newData.unit !== oldData.unit) {
    console.log("Err mismatch in unit:", newData.unit, oldData.unit);
    return false;
  }
  if (newData.investigation && !oldData.investigation) {
    updates.investigation = newData.investigation;
  }
  if (newData.investigation && oldData.investigation && newData.investigation !== oldData.investigation) {
    console.log("Err mismatch in investigation:", newData.investigation, oldData.investigation);
    return false;
  }
  if (newData.problem && !oldData.problem) {
    updates.problem = newData.problem;
  }
  if (newData.problem && oldData.problem && newData.problem !== oldData.problem) {
    console.log("Err mismatch in problem:", newData.problem, oldData.problem);
    return false;
  }
  if (newData.visibility && !oldData.visibility) {
    updates.visibility = newData.visibility;
  }
  if (newData.visibility && oldData.visibility && newData.visibility !== oldData.visibility) {
    console.log("Err mismatch in visibility:", newData.visibility, oldData.visibility);
    return false;
  }
  if (newData.offeringId && !oldData.offeringId) {
    updates.offeringId = newData.offeringId;
  }
  if (newData.offeringId && oldData.offeringId && newData.offeringId !== oldData.offeringId) {
    console.log("Err mismatch in offeringId:", newData.offeringId, oldData.offeringId);
    return false;
  }
  // tileTypes, tools, strategies -- choose the one with more values.
  if (newData.tileTypes && (!oldData.tileTypes || newData.tileTypes.length > oldData.tileTypes.length)) {
    updates.tileTypes = newData.tileTypes;
  }
  if (newData.tools && (!oldData.tools || newData.tools.length > oldData.tools.length)) {
    updates.tools = newData.tools;
  }
  if (newData.strategies && (!oldData.strategies || newData.strategies.length > oldData.strategies.length)) {
    updates.strategies = newData.strategies;
  }
  // originDoc -- if one has a value, use that.
  if (newData.originDoc !== undefined && oldData.originDoc === undefined) {
    updates.originDoc = newData.originDoc;
  }
  if (!_.isEmpty(newData.properties) && _.isEmpty(oldData.properties)) {
    updates.properties = newData.properties;
  }
  if (!_.isEmpty(newData.properties) && !_.isEmpty(oldData.properties)
    && !_.isEqual(newData.properties, oldData.properties)) {
    // Warn if the properties contains any fields other than pubCount or isDeleted
    if (Object.keys(newData.properties).some(k => !propertiesFields.includes(k))
      || Object.keys(oldData.properties).some(k => !propertiesFields.includes(k))) {
        console.log("Err unknown field in properties:", newData.properties, oldData.properties);
        return false;
    }
    updates.properties = oldData.properties;
    if (newData.properties.pubCount !== undefined) {
      // For pubCount, keep the larger one.
      updates.properties.pubCount = Math.max(newData.properties.pubCount, oldData.properties.pubCount || 0);
    }
    if (newData.properties.isDeleted !== undefined && oldData.properties.isDeleted === undefined) {
      // For isDeleted, keep whichever has a value.
      updates.properties.isDeleted = newData.properties.isDeleted;
    }
  }

  // teachers, contextId, network -- not used any more, just ignore.

  // Write out the updates
  if (Object.keys(updates).length > 0) {
    console.log("Ok Updates needed:", updates);
    if (!dryRun) {
      await oldDoc.ref.update(updates);
    }
  }

  return true;
}

// Moves a document and all its subcollections.
async function moveDocument(name: string, newName: string) {
  console.log("Ok  move", name, "->", newName);
  if (!dryRun) {
    await moveFirestoreDoc(firestore, documentsRoot, name, documentsRoot, newName, "all");
  }
}

// Copies comments, history, or whatever subcollections in finds under the parent,
// but just deletes the parent document.
async function moveSubcollections(name: string, newName: string) {
  console.log("Ok  move subcollections only", name, "->", newName);
  if (!dryRun) {
    await moveFirestoreDoc(firestore, documentsRoot, name, documentsRoot, newName, "subcollections");
  }
}

async function reorganizeDocuments() {
  const documentsRef = firestore.collection(documentsRoot);
  const documents = await getAllDocuments(documentsRef);
  const numDocs = documents.length;
  let docsProcessed = 0;
  const docInfo: { [key: string]: DocumentInfo } = {};
  const errorDocs = [];
  for (const docSnapshot of documents) {
    const type = typeOfDocument(docSnapshot);
    if (type === "error") {
      errorDocs.push(docSnapshot.id);
      continue;
    }
    if (type === "curriculum") {
      continue;
    }
    const unprefixed = docSnapshot.data().key;

    if (!(unprefixed in docInfo)) {
      docInfo[unprefixed] = { key: unprefixed, commentableDocs: [] };
    }
    docInfo[unprefixed].commentableDocs.push({ name: docSnapshot.id, type });
  }

  if (errorDocs.length > 0) {
    displayList("Unexpected documents found, ignoring:", errorDocs);
  }

  for (const key in docInfo) {
    const documentInfo = docInfo[key];
    let hasBaseDoc = documentInfo.commentableDocs.some(doc => doc.type === "unprefixed");
    docsProcessed++;
    console.log("Ok", docsProcessed, "of", numDocs, "documents", key, ":");
    if (hasBaseDoc && documentInfo.commentableDocs.length === 1) {
      continue;
    }
    for (const doc of documentInfo.commentableDocs) {
      if (doc.type === "unprefixed") {
        console.log("Ok  unprefixed doc, leave as is", doc.name);
      } else if (doc.type === "prefixed") {
        if (hasBaseDoc) {
          if (await checkAndMerge(doc.name, key)) {
            await moveSubcollections(doc.name, key);
          } else {
            // We exit the entire script if the sanity check fails -- it means there is an unexpected
            // data inconsistency that should be investigated, or something the script doesn't yet handle.
            console.error("Err Sanity check failed");
            process.exit(1);
          }
        } else {
          await moveDocument(doc.name, key);
          hasBaseDoc = true; // this becomes the base doc after the move
        }
      } else {
        throw new Error("Unexpected document type: " + doc.type);
      }
    }
  }
}

await reorganizeDocuments();
