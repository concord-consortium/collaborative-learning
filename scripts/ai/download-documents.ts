#!/usr/bin/node

// This script downloads documents from firebase and saves them as text files in src/public/ai
// It will ignore documents that are undefined, fail to parse, or have no tiles in them

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts/ai
// $ npx tsx download-documents.ts

import fs from "fs";
import admin from "firebase-admin";
import stringify from "json-stringify-pretty-compact";

import { datasetPath, networkFileName } from "./script-constants.js";
import { getFirebaseBasePath, prettyDuration } from "../lib/script-utils.js";

import { getClassKeys } from "../lib/firebase-classes.js";

// set to true to add a timestamp to the dataset path
const datasetPathWithTimestamp = false;

// set to true to pretty print the JSON files
const prettyPrintJson = true;

// The portal to get documents from. For example, "learn.concord.org".
const portal = "learn.concord.org";
// The demo name to use. Make falsy to not use a demo.
// const demo = "TAGCLUE";
const demo = false;
// const demo = false;

// add classes to pull specific classes by their hash
const classHashes = [];
/*
  example:

  const classHashes = [
  "7ff18c547954b07fd73b6b6e8cff5e0cdc504de0c065ae8a",
  "bba7afa8ce8cd2e2b6d9887016da70b3ced4b920f7662be6",
  "9ae57f9d2fb22623404b30613e6a52dff18cb49db9e100b1",
  "bf8f4b397e0648313b4cc3d57059c64e42cd0a8f6ea1f968",
  "0d3e045b041e82fdea517b327d5bf8567300e8a79dc1dccd",
  "e14f8d033a3897f5b4def8fcb81e86fdbc51a8e625941f2c",
  "6d6b148ea3691538d7879333b4e626cd41e6ff8216e003a4",
  "69043f6c854df4cae3d5fa5c9e56b944de4d5c298639608f",
  "93313af148bb116f6682dcb03a12a2e83a09e8400f4aa0ac",
];
*/
const classKeyRecords: Record<string, boolean> = {};
for (const classHash of classHashes) {
  classKeyRecords[classHash] = true;
}

// Make falsy to include all documents
const documentLimit = false;

console.log(`*** Starting to Download Documents ***`);

const startTime = Date.now();
let documentsProcessed = 0;
let undefinedDocuments = 0;
let failedDocuments = 0;
let emptyDocuments = 0;

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

const firebaseBasePath = getFirebaseBasePath(portal, demo);

const {classKeys, accessTime, fetchTime} = classHashes.length === 0
  ? await getClassKeys(firebaseBasePath)
  : {classKeys: classKeyRecords, accessTime: Date.now(), fetchTime: Date.now()};

// Fetch the service account key JSON file contents; must be in same folder as script
const credential = admin.credential.cert('../serviceAccountKey.json');
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const credentialTime = Date.now();

const targetDir = datasetPathWithTimestamp ? `dataset${startTime}` : "dataset";
const targetPath = `${datasetPath}${targetDir}`;
await fs.mkdir(targetPath, error => {
  if (error) {
    console.log(`Failed to create ${targetPath}`, error);
  }
});
for (const key of Object.keys(classKeys)) {
  console.log(`Processing class: ${key}`);
  if (documentLimit && documentsProcessed >= documentLimit) break;
  const usersSnapshot = await admin.database().ref(`${firebaseBasePath}/${key}/users`).once("value");
  const users = usersSnapshot.val();
  // console.log(key);
  // console.log(`  - ${Object.keys(users).length} users`);
  for (const [_userId, user] of Object.entries<any>(users)) {
    if (documentLimit && documentsProcessed >= documentLimit) break;
    // console.log(`  ${userId}`);
    for (const [docId, doc] of Object.entries<any>(user.documents)) {
      if (documentLimit && documentsProcessed >= documentLimit) break;

      const content = doc.content as string | undefined;
      if (!content) {
        // console.log(`    ${docId} - undefined content`);
        undefinedDocuments++;
        break;
      }
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        // console.log(`    ${docId} - error parsing content`);
        // console.log(`      ${e}`);
        failedDocuments++;
        break;
      }
      // console.log(`    ${docId}`);
      const tiles = Object.values<any>(parsedContent.tileMap);
      if (tiles.length === 0) {
        // console.log(`      - no tiles`);
        emptyDocuments++;
        break;
      }
      const documentId = `document${docId}`;
      const documentFile = `${targetPath}/${documentId}.json`;
      fs.writeFileSync(documentFile, prettyPrintJson ? JSON.stringify(parsedContent, null, 2) : content);
      documentsProcessed++;

      if (documentsProcessed % 100 === 0) {
        console.log(`${documentsProcessed} documents processed in ${prettyDuration(Date.now() - startTime)}`);
      }
    }
  }
}

// Write a file that includes network information for future scripts
const networkFile = `${targetPath}/${networkFileName}`;
fs.writeFileSync(networkFile, stringify({ portal, demo }));
console.log(`*** Network information written to ${networkFile} ***`);

const endTime = Date.now();
console.log(`***** End script *****`);
console.log(`- Time to access token: ${prettyDuration(accessTime - startTime)}`);
console.log(`- Time to fetch documents: ${prettyDuration(fetchTime - startTime)}`);
console.log(`- Time to get credential: ${prettyDuration(credentialTime - startTime)}`);
console.log(`- Total Time: ${prettyDuration(endTime - startTime)}`);
console.log(`Documents downloaded: ${documentsProcessed}`);
console.log(`Undefined documents: ${undefinedDocuments}`);
console.log(`Empty documents: ${emptyDocuments}`);
console.log(`Failed to process: ${failedDocuments}`);
console.log(`Non-empty documents: ${documentsProcessed - undefinedDocuments - emptyDocuments - failedDocuments}`);
console.log(`*** Documents saved to ${targetPath} ***`);

process.exit(0);
