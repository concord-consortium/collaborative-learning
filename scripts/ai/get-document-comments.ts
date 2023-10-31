#!/usr/bin/node

// This script downloads documents from firebase and saves them as text files in src/public/ai
// It will ignore documents that are undefined, fail to parse, or have no tiles in them

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts/ai
// $ npx tsx download-documents.ts

import fs from "fs";
import admin from "firebase-admin";

import { datasetPath } from "./script-constants";
import { prettyDuration } from "./script-utils";

// The directory containing the documents you're interested in.
// This should be the output of download-documents.ts.
// Each document should be named like documentID.txt, where ID is the document's id in the database.
const sourceDirectory = "dataset1698684356054";

// Number of documents to include in each query. I believe 10 is the max for this.
const queryLimit = 10;

// Make falsy to include all documents
// const documentLimit = 100;

console.log(`*** Starting to Compile Document Tags ***`);

const startTime = Date.now();

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

// Fetch the service account key JSON file contents; must be in same folder as script
const credential = admin.credential.cert('./serviceAccountKey.json');
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const credentialTime = Date.now();

const sourcePath = `${datasetPath}${sourceDirectory}`;

// Determine ids of relevant documents by looking at files in source directory
const documentTags: Record<string, string[]> = {};
fs.readdirSync(sourcePath).forEach(file => {
  if (file.startsWith("document") && file.endsWith(".txt")) {
    const id = file.split("document")[1].split(".txt")[0];
    documentTags[id] = [];
  }
});

console.log(`***** Getting document tags *****`);
const tagStartTime = Date.now();
const includedDocumentIds = Object.keys(documentTags);
const documentCollection = admin.firestore().collection("authed/learn_concord_org/documents");
for (let i = 0; i < includedDocumentIds.length; i += queryLimit) {
  console.log(`--- Checking documents ${i}-${i+queryLimit}`);
  const documentIdSubset = includedDocumentIds.slice(i, i + queryLimit);
  documentCollection.where("key", "in", documentIdSubset).get()
    .then(documentSnapshots => {
      const docRefTime = Date.now();
      console.log(` -- Time to get document info: ${prettyDuration(docRefTime - startTime)}`);
      documentSnapshots.forEach(documentSnapshot => {
        const documentData = documentSnapshot.data();
        console.log(`  - Document`, documentData);
      });
    });
  }
      // documentSnapshots.docs.find(doc => !!doc.data()?.classPath)?.data()?.classPath;
      // console.log(`  - documentDocRefs`, documentsDocRefs.length);
      // const docs = await Promise.all(documentsDocRefs.map((documentDocRef, docIndex) => new Promise((resolve, reject) => {
      //   documentDocRef.get()
      //     .then(doc => {
      //       const documentData = doc?.data();
      //       console.log(`--- Document key:`, documentData?.key);
      //       // if (includedDocumentIds.includes(documentData?.key)) {
      //         if (documentData?.comments) {
      //           console.log(` -- Document:`, documentData);
      //         }
      //         documentDocRef.collection("comments").listDocuments()
      //           .then(async commentsDocRef => {
      //             const comments =
      //             await Promise.all(commentsDocRef.map(
      //               (commentDocRef, commentDocIndex) => new Promise((resolve, reject) => {
      //               commentDocRef.get()
      //                 .then(commentDoc => {
      //                   const commentData = commentDoc?.data();
      //                   console.log(`!!! Comment data`, commentData);
      //                 });
      //             })));
      //           });
      //       // }
      //     });
      // })));
// }

    const endTime = Date.now();
    console.log(`***** End script *****`);
    console.log(`- Time to get credential: ${prettyDuration(credentialTime - startTime)}`);
    console.log(`- Time to download documents: ${prettyDuration(tagStartTime - startTime)}`);
    console.log(`- Time to get documents from firestore: ${prettyDuration(docRefTime - startTime)}`);
    console.log(`- Total Time: ${prettyDuration(endTime - startTime)}`);

    process.exit(0);
  // });
