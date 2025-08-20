#!/usr/bin/node

// Find all "commentable documents" using old-style prefixed paths, and move them
// to the unprefixed location. Multiple documents may be consolidated into a single one
// if they share the same key.

// $ cd scripts
// $ npx tsx consolidate-comments.ts

import admin from "firebase-admin";
import { deleteApp } from "firebase-admin/app";
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

const keyPattern = "-[a-zA-Z0-9_\\-]{19}";
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

function typeOfDocument(documentName: string) {
  if (isCurriculum(documentName)) {
    return "curriculum";
  } else if (isPrefixed(documentName)) {
    return "prefixed";
  } else if (isUnprefixed(documentName)) {
    return "unprefixed";
  } else {
    return "error";
  }
}

function unprefixedName(documentName: string) {
  if (isPrefixed(documentName)) {
    const result = documentName.match(prefixedPattern);
    if (result) {
      return result[1];
    }
    throw new Error("Error parsing document name: " + documentName);
  }
  return documentName;
}

async function getAllDocumentNames(ref: FirebaseFirestore.CollectionReference) {
  return (await ref.listDocuments()).map(docRef => docRef.id);
}

function displayList(title: string, list: string[]) {
  console.log(`${title} (${list.length}):`);
  console.log(list);
}

// Moves a document and all its subcollections.
async function moveDocument(name: string, newName: string) {
  console.log("  move", name, "->", newName);
  if (!dryRun) {
    await moveFirestoreDoc(firestore, documentsRoot, name, documentsRoot, newName, "all");
  }
}

// Copies comments, history, or whatever subcollections in finds under the parent,
// but just deletes the parent document.
async function moveSubcollections(name: string, newName: string) {
  console.log("  move subcollections only", name, "->", newName);
  if (!dryRun) {
    await moveFirestoreDoc(firestore, documentsRoot, name, documentsRoot, newName, "subcollections");
  }
}

async function reorganizeDocuments() {
  const documentsRef = firestore.collection(documentsRoot);
  const documentNames = await getAllDocumentNames(documentsRef);
  const docInfo: { [key: string]: DocumentInfo } = {};
  const errorDocs = [];
  for (const documentName of documentNames) {
    const type = typeOfDocument(documentName);
    if (type === "error") {
      errorDocs.push(documentName);
      continue;
    }
    if (type === "curriculum") {
      continue;
    }
    const unprefixed = unprefixedName(documentName);

    if (!(unprefixed in docInfo)) {
      docInfo[unprefixed] = { key: unprefixed, commentableDocs: [] };
    }
    docInfo[unprefixed].commentableDocs.push({ name: documentName, type });
  }

  if (errorDocs.length > 0) {
    displayList("Unexpected documents found, quitting.", errorDocs);
    return;
  }

  for (const key in docInfo) {
    const documentInfo = docInfo[key];
    let hasBaseDoc = documentInfo.commentableDocs.some(doc => doc.type === "unprefixed");
    console.log(key, ":");
    if (hasBaseDoc && documentInfo.commentableDocs.length === 1) {
      console.log("  is all set");
      continue;
    }
    for (const doc of documentInfo.commentableDocs) {
      if (doc.type === "unprefixed") {
        console.log("  unprefixed doc, leave as is", doc.name);
      } else if (doc.type === "prefixed") {
        if (hasBaseDoc) {
          await moveSubcollections(doc.name, key);
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

await deleteApp(fbApp);
