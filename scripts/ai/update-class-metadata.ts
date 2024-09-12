#!/usr/bin/node

// This script uses the downloaded documents to get class and network info
// then creates or updates Firestore class metadata documents

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ npx tsx ai/update-class-metadata.ts

import fs from "fs";
import admin from "firebase-admin";

import { datasetPath, networkFileName } from "./script-constants.js";
import { getFirestoreClassesPath, getScriptRootFilePath } from "../lib/script-utils.js";

// The directory containing the documents you're interested in.
// This should be the output of download-documents-with-info.ts.
const sourceDirectory = "dataset1724113771908";
const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

// Fetch the service account key JSON file contents
const credential = admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json"));
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const sourcePath = `${datasetPath}${sourceDirectory}`;

// Get network info from portal file. This should have been created by download-documents-with-info.ts.
function getNetworkInfo() {
  const networkFile = `${sourcePath}/${networkFileName}`;
  if (fs.existsSync(networkFile)) {
    return JSON.parse(fs.readFileSync(networkFile, "utf8"));
  }
}
const { portal, demo } = getNetworkInfo();

const collectionUrl = getFirestoreClassesPath(portal, demo);
const documentCollection = admin.firestore().collection(collectionUrl);

let processedClasses = 0;
let metadataUpdated = 0;
let metadataCreated = 0;

async function saveCurrentMetadata() {
  const timestamp = new Date().toISOString().replace(/:|T/g, "-").replace(/\.\d{3}Z$/, "");
  const documentSnapshots = await documentCollection.get();
  const metadata = {};
  documentSnapshots.forEach(doc => {
    metadata[doc.id] = doc.data();
  });
  const metadataFilePath = `${sourcePath}/class-metadata-backup-${timestamp}.json`;
  fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));
}

async function processFile() {
  const filePath = `${sourcePath}/class-info.json`;
  const content = fs.readFileSync(filePath, "utf8");
  const parsedContent = JSON.parse(content);

  for (const classId in parsedContent) {
    const {
      context_id,
      name,
      networks,
      uri
    } = parsedContent[classId];
    const id = String(parsedContent[classId].id);
    const teachers = parsedContent[classId].teachers.map(teacher => String(teacher));

    processedClasses++;

    const documentSnapshots = await documentCollection.where("id", "==", id).get();

    const createClassDoc = async () => {
      const metaData = {
        context_id,
        id,
        teachers,
        name,
        networks,
        uri
      };
      const metaDataDocId = context_id;
      const newMetaDataDoc = documentCollection.doc(metaDataDocId);
      await newMetaDataDoc.create(metaData);
      console.log("Created new class metadata", metaDataDocId);
      metadataCreated++;
    };

    // There can be multiple class metadata documents for each actual class. Note that the name/path for these
    // Firestore documents may be "[network name]_[class hash]" and/or simply "[class hash]".
    // For now we just update all of these documents.

    let hasClassDocWithSimpleId = false;
    for (const doc of documentSnapshots.docs) {
      if (doc.id === context_id) hasClassDocWithSimpleId = true;

      const requiredMatches = [
        { field: "context_id", expected: context_id, actual: doc.data().context_id },
        { field: "id", expected: id, actual: doc.data().id },
        { field: "uri", expected: uri, actual: doc.data().uri }
      ];

      let hasMismatch = false;
      for (const { field, expected, actual } of requiredMatches) {
        if (expected !== actual) {
          console.error(`Skipping update of ${doc.id} due to ${field} mismatch. Expected ${expected}, got ${actual}.`);
          hasMismatch = true;
        }
      }
      if (hasMismatch) continue;

      await doc.ref.update({ name, networks, teachers } as any);
      console.log(context_id, doc.id, "Updated existing class metadata with", { name, networks, teachers });
      metadataUpdated++;
    }

    if (!hasClassDocWithSimpleId) {
      await createClassDoc();
    }
  }
}

console.log("*** Recording current Firestore class metadata to local file ***");
await saveCurrentMetadata();
console.log("*** Finished recording current Firestore class metadata to local file ***");

console.log(`*** Loading downloaded CLUE class info ***`);
await processFile();

console.log(`*** Processed ${processedClasses} classes ***`);
console.log(`*** Created ${metadataCreated} metadata docs ***`);
console.log(`*** Updated ${metadataUpdated} metadata docs ***`);
