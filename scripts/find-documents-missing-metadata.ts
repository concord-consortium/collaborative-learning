#!/usr/bin/node

// This script aims to fix certain documents that were created in Firestore with missing metadata.
// The sympom is metadata documents that are missing their unit, investigation, and problem fields.
// In at least some cases, there is another document with the same document key (but different network)
// that has the correct metadata. This script will identify those documents and copy the metadata
// to the document where it is missing.

// Set dryRun to false below to actually make changes to the database.

// to run this script type the following in the terminal
// $ cd scripts
// $ npx tsx find-documents-missing-metadata.ts

import admin from "firebase-admin";
import { getFirestoreBasePath, getScriptRootFilePath } from "./lib/script-utils.js";

// The portal to get documents from. For example, "learn.concord.org".
const portal = "learn.concord.org";
// The demo name to use. Make falsy to not use a demo.
// const demo = "CLUE";
const demo = false;

// Limit number of documents returned from query; or set to false to include all documents
const documentLimit = false;

const dryRun = true;

const should_match_fields = [ "context_id", "key", "title", "type" ];
const fields_to_copy = [ "unit", "investigation", "problem" ];

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

// Fetch the service account key JSON file contents
const credential = admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json"));
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

console.log(`*** Starting to Scan Documents ***`);

const collectionUrl = getFirestoreBasePath(portal, demo);

const documentCollection = admin.firestore().collection(collectionUrl);

let documentQuery = documentCollection
  // Omit document types that are not expected to be associated with a unit, investigation, and problem
  .where("type", "not-in", ["personal", "personalPublication", "learningLog", "learningLogPublication"])
  .where("unit", "==", null);

if (documentLimit) {
  documentQuery = documentQuery.limit(documentLimit);
}

const singlesByType = { "problem": 0, "problemPublication": 0, "planning": 0 };
const triplets = new Set();
const pairs = new Set();
const mismatchDocs = new Set();
const fixableDocsByType = { "problem": 0, "problemPublication": 0, "planning": 0 };

const promises = [];

const documentSnapshots = await documentQuery.get();
documentSnapshots.forEach(doc => {
  const data = doc.data();
  // console.log(`Document ${doc.ref.path}: ${data.type} unit: ${data.unit}`);
  // Look for other documents with the same key
  const key = data.key;
  const keyQuery = documentCollection.where("key", "==", key);
  const query = keyQuery.get().then(async snapshot => {
    if (snapshot.size === 1) {
      singlesByType[snapshot.docs[0].data().type] += 1;
    } else if (snapshot.size > 2) {
      triplets.add(key);
    } else if (snapshot.size === 2) {
      if (!pairs.has(key)) {
        pairs.add(key);
        console.log(`Found ${snapshot.size} documents with key ${key}`);
        console.log(`  ${snapshot.docs[0].ref.path} and ${snapshot.docs[1].ref.path}`);
        let goodDoc, badDoc;
        let badRef: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>;
        if (snapshot.docs[0].data().unit) {
          goodDoc = snapshot.docs[0].data();
          badDoc = snapshot.docs[1].data();
          badRef = snapshot.docs[1];
        } else if (snapshot.docs[1].data().unit) {
          goodDoc = snapshot.docs[1].data();
          badDoc = snapshot.docs[0].data();
          badRef = snapshot.docs[0];
        } else {
          console.log(`   Neither document has metadata`);
        }
        if (goodDoc) {
          // console.log("good doc", goodDoc);
          // Make sure the main fields match in the two documents
          let match = true;
          should_match_fields.forEach(field => {
            // Treat undefined and null as equivalent
            const f1 = goodDoc[field] ?? null;
            const f2 = badDoc[field] ?? null;
            if (f1 !== f2) {
              console.log(`      ${field} does not match: ${f1} != ${f2}`);
              match = false;
            }
          });
          // Make sure that the bad document has only nulls in all of the fields to copy
          fields_to_copy.forEach(field => {
            if (badDoc[field]) {
              console.log(`      ${field} is not null: ${badDoc[field]}`);
              match = false;
            }
          });
          if (match) {
            fixableDocsByType[goodDoc.type] += 1;
            let logMsg = dryRun ? "    Would copy: " : "    Copy: ";
            const updateDoc = { };
            fields_to_copy.forEach(field => {
              if (!dryRun) {
                updateDoc[field] = goodDoc[field];
              }
              logMsg += ` ${field}: ${goodDoc[field]}  `;
            });
            if (dryRun) {
              console.log(logMsg);
            } else {
              // Update the values in the bad document
              try {
                await badRef.ref.set(updateDoc, { merge: true });
                console.log(logMsg, "...done");
              } catch (error) {
                console.error(`Error updating document ${badRef.ref.path}: ${error}`);
              }
            }
          } else {
            mismatchDocs.add(key);
          }
        }
      }
    }
  });
  promises.push(query);
});

await Promise.all(promises);
console.log(`*** Finished Scanning Documents ***`);

console.log(`Fixable documents:`);
Object.entries(fixableDocsByType).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

console.log(`Missing metadata but no other documents with the same key:`);
Object.entries(singlesByType).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});
console.log(`Mismatched documents: ${mismatchDocs.size}`);
console.log(`Triplets (or more): ${triplets.size}`);
