#!/usr/bin/node

// This script downloads documents from firebase and saves them as text files in src/public/ai
// It will ignore documents that are undefined, fail to parse, or have no tiles in them
// This script differs from download-documents.ts in that it saves more information than just the document content

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts/ai
// $ npx tsx download-documents.ts

import fs from "fs";
import admin from "firebase-admin";
import {google} from "googleapis";
import stringify from "json-stringify-pretty-compact";
import fetch from 'node-fetch';

import { datasetPath, networkFileName } from "./script-constants";
import { getFirebaseBasePath, prettyDuration } from "./script-utils";

// Load the service account key JSON file.
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

// The portal to get documents from. For example, "learn.concord.org".
const portal = "learn.concord.org";
// The demo name to use. Make falsy to not use a demo.
// const demo = "TAGCLUE";
const demo = false;

// Make falsy to include all documents
const documentLimit = 100;

console.log(`*** Starting to Download Documents ***`);

const startTime = Date.now();
let documentsProcessed = 0;
let undefinedDocuments = 0;
let failedDocuments = 0;
let emptyDocuments = 0;

// Define the required scopes.
const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/firebase.database"
];

console.log("Creating Google JWT Client");

// Authenticate a JWT client with the service account.
const jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  undefined,
  serviceAccount.private_key,
  scopes
);

console.log("Generating an access token");

// Use the JWT client to generate an access token.
// this is using a toplevel await which might be a problem
const accessToken = await new Promise<string|undefined>((resolve, reject) => {
  jwtClient.authorize(function(error, tokens) {
    if (error || !tokens) {
      console.log("Error making request to generate access token:", error);
      reject();
    } else if (tokens.access_token === null) {
      console.log("Provided service account does not have permission to generate access tokens");
      reject();
    } else {
      resolve(tokens.access_token);
    }
  });
});

const accessTime = Date.now();

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

const firebaseBasePath = getFirebaseBasePath(portal, demo);
const fetchURL = `${databaseURL}${firebaseBasePath}.json?shallow=true`;
console.log(`Fetching URL: ${fetchURL}`);

const response = await fetch(fetchURL,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);
const classKeys  = await response.json() as Record<string, boolean>;

const fetchTime = Date.now();

// Fetch the service account key JSON file contents; must be in same folder as script
const credential = admin.credential.cert('./serviceAccountKey.json');
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const credentialTime = Date.now();

const targetDir = `dataset${startTime}`;
const targetPath = `${datasetPath}${targetDir}`;
await fs.mkdir(targetPath, error => {
  if (error) {
    console.log(`Failed to create ${targetPath}`, error);
  }
});
for (const key of Object.keys(classKeys)) {
  if (documentLimit && documentsProcessed >= documentLimit) break;
  const usersSnapshot = await admin.database().ref(`${firebaseBasePath}/${key}/users`).once("value");
  const users = usersSnapshot.val();
  // console.log(key);
  // console.log(`  - ${Object.keys(users).length} users`);
  for (const [userId, user] of Object.entries<any>(users)) {
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
      const documentId = `documentInfo${docId}`;
      const documentFile = `${targetPath}/${documentId}.txt`;
      const documentMetadata = user.documentMetadata[docId];
      const offeringId = documentMetadata?.offeringId;
      const documentType = documentMetadata?.type;
      const documentTitle = ["learningLog", "personal"].includes(documentType) ? user[documentType]?.title : undefined;
      const fileContent = {
        classId: key, offeringId, userId, documentId: docId, documentType, documentTitle, documentContent: parsedContent
      };
      fs.writeFileSync(documentFile, stringify(fileContent));
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
console.log(`*** Documents saved to ${targetPath} ***`);

process.exit(0);
