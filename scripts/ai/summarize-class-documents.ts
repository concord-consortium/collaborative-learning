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

import { aiSimpleSummarizer } from "./simple-ai-summarizer";

// Configuration
const portal = "learn.concord.org";
const demo = false; // Set to a demo name like "TAGCLUE" to use demo data
const unit = "mods"; // Find documents in this unit
const context_id = "be6203f1e39e32472ee652a05f0ecc829255294909cd66f5"; // Find documents in this class

// Query configuration
const documentLimit = 10; // Set to false to query all documents

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
    console.log(`Found ${documentSnapshots.size} documents before filtering`);

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

    await Promise.all(filteredDocuments.map(async (doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      console.log(`Document contents: ${JSON.stringify(data, null, 2)}`);
      await retrieve_document_from_firebase(data.context_id, data.uid, data.key);
      console.log(`  ---`);
    }));

    return filteredDocuments.length;
  } catch (error) {
    console.error(`Error querying documents:`, error);
    return 0;
  }
}

// Function to retrieve document content from Firebase Realtime Database
async function retrieve_document_from_firebase(docContextId: string, uid: string, key: string) {
  try {
    const documentPath = `${firebaseBasePath}/${docContextId}/users/${uid}/documents/${key}`;
    const documentSnapshot = await admin.database().ref(documentPath).once("value");
    const documentData = documentSnapshot.val();

    if (!documentData) {
      console.log(`  No document found at path: ${documentPath}`);
      return null;
    }

    let parsedContent = null;
    if (documentData.content) {
      try {
        parsedContent = JSON.parse(documentData.content);
        if (parsedContent.tileMap) {
          const tileCount = Object.keys(parsedContent.tileMap).length;
          console.log(`Read ${key} and found ${tileCount} tiles`);
          const summary = aiSimpleSummarizer(parsedContent, { includeModel: true });
          console.log(`  Summary: ${summary}`);
        }
      } catch (parseError) {
        console.log(`  Failed to parse document content: ${parseError}`);
        console.log(`  Raw content length: ${documentData.content.length} characters`);
      }
    } else {
      console.log(`  Document has no content field`);
      return null;
    }

    return documentData;
  } catch (error) {
    console.error(`Error retrieving document from Firebase: ${error}`);
    return null;
  }
}

// Main execution
async function main() {
  try {
    const documentsCount = await queryDocuments();
    console.log(`- Documents retrieved: ${documentsCount}`);

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
