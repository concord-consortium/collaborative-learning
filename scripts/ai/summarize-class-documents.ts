#!/usr/bin/node

// This script connects to Firestore and performs a query
// It demonstrates how to query documents, users, classes, and other collections

// to run this script type the following in the terminal
// $ cd scripts/ai
// $ npx tsx firestore-query.ts

import admin from "firebase-admin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";

import { getFirebaseBasePath, getFirestoreBasePath,
  getScriptRootFilePath } from "../lib/script-utils";

import { aiSimpleSummarizer, summarizeTiles } from "../lib/simple-ai-summarizer";

// Configuration
const portal = "learn.concord.org";
const demo = false; // Set to a demo name like "TAGCLUE" to use demo data
const unit = "mods"; // Find documents in this unit
const context_id = "ccfa37d608d720146f7db4409f5fa187ccaa9a934bb18842"; // Find documents in this class
const unique_tiles = false; // Set to true to break up docs into unique tiles

// MODS classes with number of documents:
//   "ccfa37d608d720146f7db4409f5fa187ccaa9a934bb18842": 177,
//   "14fc49c959f9242ea46172abbfde9615ba860c9be1f3598f": 165,
//   "7bb240b9c92b551f35435cefc639df098aa9e66c61ac6987": 159,
//   "60bf45ae82db54f0ec155c45bf3be9a09f9d635a80deb518": 139,
//   "d791484754cd635cc83cf720da6ccc59f3b327d316ba638a": 131,
//   "8bc715d2928ce7e6cb8ca576eabb1b4b0e148130577ac513": 131,
//   "ba8182786f0223aa4a94c6f6f19b9b33ca9f463f78450430": 119,
//   "a8cea6c9209df5420555ee144055b63106a178a5523eb2ac": 116,
//   "962da73e057b3d6944fa9c7790e416d69b6781ead9c0fdfc": 81,
//   "cd4aae4316811f9e4ac05f328b8b02cca151dfc9e9617238": 58,
//   "fe48312ac289a0bdd9a8a8bbdbc32739044eedaf82ef6a7e": 33,
//   "e8d659d967c762fe863722d860f7865348177797f4a3d138": 19,
//   "34bf2544b0c5511578e305a05835dd9c84eea9c67d46a06b": 17,
//   "75c820d38efddb26654bf1586240c0bc13b4bfdff9202e4d": 16,
//   "d511464ea89e478e2688c891e16e3414e82b279405703bac": 14,
//   ... several more
//   "be6203f1e39e32472ee652a05f0ecc829255294909cd66f5": 3

// Query configuration
const documentLimit = false; // Set to false to query all documents

// Database configuration
const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

// Initialize Firebase Admin
const credential = admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json"));
admin.initializeApp({
  credential,
  databaseURL
});

// Get Firestore paths
const documentsPath = getFirestoreBasePath(portal, demo);
const firebaseBasePath = getFirebaseBasePath(portal, demo); // path to "classes" in Firebase

// Initialize Firestore collections
const documentsCollection = admin.firestore().collection(documentsPath);

async function queryDocuments() {
  let documentQuery = documentsCollection
    .where("unit", "==", unit)
    .where("context_id", "==", context_id)
    ;

  if (documentLimit) {
    documentQuery = documentQuery.limit(documentLimit);
  }

  try {
    const documentSnapshots = await documentQuery.get();

    // Filter out documents that have only ["Placeholder"] in their tools array
    const filteredDocuments = documentSnapshots.docs.filter((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const tools = data.tools || [];

      // Check if tools array is exactly ["Placeholder"]
      if (tools.length === 1 && tools[0] === "Placeholder") {
        return false; // Exclude this document
      }

      return true; // Include this document
    });

    const resultPromises = filteredDocuments.map(async (doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      return retrieve_document_from_firebase(data.context_id, data.uid, data.key);
    });

    const errors: string[] = [];
    const tileSummaries: string[] = [];
    for (const resultPromise of resultPromises) {
      const { content, error } = await resultPromise;
      if (content) {
        if (unique_tiles) {
          const newTileSummaries = summarizeTiles(content);
          tileSummaries.push(...newTileSummaries);
        } else {
          const { summary, error: summarizeError } = summarizeDocument(content);
          if (summary) {
            console.log(summary);
          }
          if (summarizeError) {
            errors.push(summarizeError);
          }
        }
      }
      if (error) {
        errors.push(error);
      }
    }

    if (unique_tiles) {
      const uniqueTileSummaries = [...new Set(tileSummaries)];
      console.log("\n# Unique tile summaries:");
      console.log(uniqueTileSummaries.join("\n\n"));
    }

    return { documentsCount: filteredDocuments.length - errors.length, errors };
  } catch (error) {
    const errMsg = "Error querying documents: " + error.message;
    return { documentsCount: 0, errors: [errMsg] };
  }
}

// Retrieve document content from Firebase Realtime Database
// Returns null if the document is successfully summarized, otherwise returns an error message
// The summary is written out via console.log()
async function retrieve_document_from_firebase(docContextId: string, uid: string, key: string):
    Promise<{ content: any | null, error: string | null }> {
  try {
    const documentPath = `${firebaseBasePath}/${docContextId}/users/${uid}/documents/${key}`;
    const documentSnapshot = await admin.database().ref(documentPath).once("value");
    const documentData = documentSnapshot.val();

    if (!documentData) {
      return({ content: null, error: `No document found at path: ${documentPath}` });
    }

    let parsedContent: any = null;
    if (documentData.content) {
      try {
        parsedContent = JSON.parse(documentData.content);
        return({ content: parsedContent, error: null });
      } catch (parseError) {
        return({ content: null, error: `Failed to parse document content: ${parseError}` });
      }
    } else {
      return({ content: null, error: "Document has no content field" });
    }

  } catch (error) {
    return({ content: null, error: `Error retrieving document from Firebase: ${error}` });
  }
}

function summarizeDocument(content: any): { summary: string | null, error: string | null } {
  if (content?.tileMap || content.tileMap.length > 0) {
    const summaryText = aiSimpleSummarizer(content, { includeModel: true });
    if (summaryText) {
      const summary = "\n## Document\n" + summaryText;
      return({ summary, error: null });
    } else {
      return({ summary: null, error: "Empty document: no summary" });
    }
  } else {
    return({ summary: null, error: "Empty document: no tiles" });
  }
}

// Main execution
async function main() {
  try {
    console.log("# Student document summaries:");
    const { documentsCount, errors } = await queryDocuments();
    console.log(`Documents summarized: ${documentsCount}`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.join("\n")}`);
    }

  } catch (error) {
    console.error(`Script failed:`, error);
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(`Script failed:`, error);
  process.exit(1);
});
