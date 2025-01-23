#!/usr/bin/node

// This script aims to fix certain documents that were created in Firestore with missing metadata.
// The sympom is metadata documents that are missing their unit, investigation, and problem fields.
// In at least some cases, there is another document with the same document key (but different network)
// that has the correct metadata. This script will identify those documents and copy the metadata
// to the document where it is missing. If there is no second document, it will look up the offering
// associated with the document and copy the metadata from the offering.

// Set dryRun to false below to actually make changes to the database.

// To run this script type the following in the terminal
// $ cd scripts
// $ npx tsx find-documents-missing-metadata.ts

import admin from "firebase-admin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { fetchPortalOffering } from "./lib/fetch-portal-entity.js";
import { getFirebaseBasePath, getFirestoreBasePath, getProblemDetails, getScriptRootFilePath }
  from "./lib/script-utils.js";

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

const firebaseBasePath = getFirebaseBasePath(portal, demo);
const documentsCollection = getFirestoreBasePath(portal, demo);

// Holds information on offerings that have been looked up previously
const offeringInfo = {};

async function updateBasedOnOffering(doc: QueryDocumentSnapshot) {
  const docdata = doc.data();
  if (docdata.context_id && docdata.uid && docdata.key) {
    const offeringId = await getOfferingIdFromFirebaseMetadata(docdata.context_id, docdata.uid, docdata.key);
    if (!offeringId) return false;
    if (offeringId in offeringInfo) {
      console.log("Already looked up offering info for", offeringId);
    } else {
      offeringInfo[offeringId] = await getOfferingInfo(offeringId);
    }
    const info = offeringInfo[offeringId];
    if (info) {
      if (updateMetadata(doc, info)) return true;
    } else {
      console.log("Failed to get offering info for", offeringId);
    }
  } else {
    console.log("Document has insufficient metadata:", docdata);
  }
  return false;
}

async function getOfferingInfo(offeringId: string) {
  const offering = await fetchPortalOffering(`https://${portal}`, offeringId);
  if (!offering) return undefined;
  const { activity_url } = offering;
  return getProblemDetails(activity_url);
}

async function getOfferingIdFromFirebaseMetadata(context_id: string, user_id: string, key: string) {
  // Path is like:
  //  /authed/portals/portal_name/classes/context_id/users/user_id/documentMetadata/key
  // and contains offeringId, etc.
  const firebasePath = `${firebaseBasePath}/${context_id}/users/${user_id}/documentMetadata/${key}`;
  try {
    const mdDoc = await admin.database().ref(firebasePath).once("value");
    if (mdDoc.exists() && mdDoc.val()) {
      return mdDoc.val().offeringId;
    } else {
      console.log(`No metadata found at ${firebasePath}`);
      return undefined;
    }
  } catch (error) {
    console.error(`Error fetching metadata at ${firebasePath}: ${error}`);
    return undefined;
  }
}

async function updateMetadata(docRef: QueryDocumentSnapshot, metadata: any) {
  let logMsg = ` Copy into: ${docRef.ref.path}: `;
  const updateDoc = { };
  fields_to_copy.forEach(field => {
    if (!dryRun) {
      updateDoc[field] = metadata[field];
    }
    logMsg += `${field}: ${metadata[field]} `;
  });
  if (dryRun) {
    console.log(logMsg, "...dry run");
  } else {
    // Update the values in the bad document
    try {
      await docRef.ref.set(updateDoc, { merge: true });
      console.log(logMsg, "...done");
    } catch (error) {
      console.error(`Error updating document ${docRef.ref.path}: ${error}`);
    }
  }
}


const documentCollection = admin.firestore().collection(documentsCollection);

let documentQuery = documentCollection
  // Omit document types that are not expected to be associated with a unit, investigation, and problem
  // Note that due to how Firestore queries work, this will not return any documents that are missing the type field
  .where("type", "not-in", ["personal", "personalPublication", "learningLog", "learningLogPublication", "exemplar"]);

if (documentLimit) {
  documentQuery = documentQuery.limit(documentLimit);
}

const singlesByType = { "problem": 0, "problemPublication": 0, "planning": 0 };
const pairs = new Set();
const failedDocs = new Set();
const fixableDocsByType = { "problem": 0, "problemPublication": 0, "planning": 0 };
let missingContextId = 0;

const promises = [];

const needUpdateBasedOnOffering = [];

console.log(`*** Starting to Scan Documents ***`);
const documentSnapshots = await documentQuery.get();
documentSnapshots.forEach(mainDoc => {
  const data = mainDoc.data();
  if ("unit" in data && data.unit) {
    return;
  }

  if (!data.context_id) {
    console.log(`Missing context_id for ${data.type}: ${mainDoc.ref.path}`);
    missingContextId++;
    return;
  }

  // Look for other documents with the same key
  const key = data.key;
  const keyQuery = documentCollection.where("key", "==", key);
  const query = keyQuery.get().then(async snapshot => {
    if (snapshot.size === 1) {
      needUpdateBasedOnOffering.push(mainDoc);
    } else if (snapshot.size > 2) {
      // Haven't seen the "triplet" case yet; don't attempt
      failedDocs.add(key);
    } else if (snapshot.size === 2) {
      if (!pairs.has(key)) {
        pairs.add(key);
        console.log(`Found ${snapshot.size} documents with key ${key}`);
        let goodDoc, badDoc;
        let badRef: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>;
        if (snapshot.docs[0].data().unit) {
          goodDoc = snapshot.docs[0].data();
          badDoc = snapshot.docs[1].data();
          badRef = snapshot.docs[1];
          console.log(`  ${snapshot.docs[0].ref.path} -> ${snapshot.docs[1].ref.path}`);
        } else if (snapshot.docs[1].data().unit) {
          goodDoc = snapshot.docs[1].data();
          badDoc = snapshot.docs[0].data();
          badRef = snapshot.docs[0];
          console.log(`  ${snapshot.docs[1].ref.path} -> ${snapshot.docs[0].ref.path}`);
        } else {
          console.log(`   Neither document has metadata`);
          needUpdateBasedOnOffering.push(mainDoc);
        }
        if (goodDoc) {
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
            updateMetadata(badRef, goodDoc);
          } else {
            failedDocs.add(key);
          }
        }
      }
    }
  });
  promises.push(query);
});

await Promise.all(promises);
console.log(`*** Finished Scanning Documents ***`);

console.log(`Updating ${needUpdateBasedOnOffering.length} documents based on offering info`);

for(const doc of needUpdateBasedOnOffering) {
  if (await updateBasedOnOffering(doc)) {
    singlesByType[doc.data().type] += 1;
  } else {
    failedDocs.add(doc.data().key);
  }
}

console.log(`Fixable from other doc with same key:`);
Object.entries(fixableDocsByType).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

console.log(`Fixable from offering:`);
Object.entries(singlesByType).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

console.log(`Failed to fix: ${failedDocs.size}`);

console.log(`Missing context_id: ${missingContextId}`);

process.exit(0);
