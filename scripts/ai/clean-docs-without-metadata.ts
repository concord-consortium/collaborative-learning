#!/usr/bin/node

// This script finds documents without metadata in the realtime database.
// If the deleteTypes array is uncommented, it will delete these documents.

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts/ai
// $ npx tsx clean-docs-without-metadata.ts

import admin from "firebase-admin";

import { getFirebaseBasePath, getScriptRootFilePath, prettyDuration,
  remapFirebaseClassPublications, remapFirebaseProblemDocPublications } from "../lib/script-utils.js";

// Load the service account key JSON file.
import { getClassKeys } from "../lib/firebase-classes.js";

// The portal to get documents from. For example, "learn.concord.org".
const portal = "learn.concord.org";
// The demo name to use. Make falsy to not use a demo.
// const demo = "TAGCLUE";
const demo = false;

// Make falsy to include all documents
const documentLimit = false;
// const documentLimit = 10000;

// List of types to delete if they appear safe to do so.
const deleteTypes = [
  // "problem",
  // "planning",
  // "learningLog",
  // "publication"
];

// If a problem or planning doc doesn't have metadata and there is an offering for
// the user that also doesn't have type specific metadata for any problem or planning
// docs, perhaps the doc is supposed to go in this "empty slot".
// Or if there is a learningLog that doesn't have metadata and there is no learningLog
// metadata for this user.
// For the problem and planning docs this hasn't been practical to figure out.
// There are usually multiple empty slots.
// For learningLogs there haven't been any cases like this.
// Additionally these docs would not be accessible to the user
// after they were created. So there isn't much point in keeping them around.
const deleteDefaultDocsEvenIfThereIsEmptySlot = true;
// const deleteDefaultDocsEvenIfThereIsEmptySlot = false;

console.log(`*** Starting to Download Documents ***`);

const startTime = Date.now();
let documentsProcessed = 0;
let undefinedDocuments = 0;
let failedDocuments = 0;
let emptyDocuments = 0;

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

const firebaseBasePath = getFirebaseBasePath(portal, demo);

const {classKeys, accessTime, fetchTime} = await getClassKeys(firebaseBasePath);

// Fetch the service account key JSON file contents; must be in same folder as script
const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
const credential = admin.credential.cert(serviceAccountFile);
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const credentialTime = Date.now();

// CHECKME: what about cross class supports?
// They might be saved as a supportPublication with an offering but then there
// is a metadata file that has extra information about it.

for (const key of Object.keys(classKeys)) {
  const getClassValue = async (prop: string) => {
    const snapshot = await admin.database().ref(`${firebaseBasePath}/${key}/${prop}`).once("value");
    return snapshot.val();
  };

  if (documentLimit && documentsProcessed >= documentLimit) break;
  const users = await getClassValue("users");
  const offerings = await getClassValue("offerings");
  const fbPersonalPublications = await getClassValue("personalPublications");
  const personalPublications = remapFirebaseClassPublications(fbPersonalPublications);
  const fbLearningLogPublications = await getClassValue("publications");
  const learningLogPublications = remapFirebaseClassPublications(fbLearningLogPublications);

  const problemDocPublications = {};
  for (const [offeringId, offering] of Object.entries(offerings)) {
    const fbProblemDocPublications = (offering as any).publications;
    if (!fbProblemDocPublications) continue;
    problemDocPublications[offeringId] = remapFirebaseProblemDocPublications(fbProblemDocPublications);
  }

  for (const [userId, user] of Object.entries<any>(users)) {
    if (documentLimit && documentsProcessed >= documentLimit) break;
    if (!user.documents) continue;
    for (const [docId, doc] of Object.entries<any>(user.documents)) {
      if (documentLimit && documentsProcessed >= documentLimit) break;
      documentsProcessed++;

      const docPath = `${firebaseBasePath}/${key}/users/${userId}/documents/${docId}`;
      const content = doc.content as string | undefined;
      let parsedContent;
      let tiles;
      if (!content) {
        undefinedDocuments++;
      } else {
        try {
          parsedContent = JSON.parse(content);
          tiles = Object.values<any>(parsedContent.tileMap);
          if (tiles.length === 0) {
            emptyDocuments++;
          }
        } catch (e) {
          failedDocuments++;
        }
      }

      const documentMetadata = user.documentMetadata[docId];

      // We only care about docs without metadata
      if (documentMetadata) continue;

      const deleteDoc = async () => {
        if (deleteTypes.includes(doc.type)) {
          try {
            await admin.database().ref(docPath).remove();
            console.log("deleted", docPath);
          } catch (e) {
            console.log("failed to delete", docPath, e);
          }
        } else {
          console.log("would delete", docPath);
        }
      };

      const personalDocMetadata = user.personalDocs?.[docId];
      const learningLogMetadata = user.learningLogs?.[docId];

      const hasContent = !!tiles && (tiles.length > 0);
      const tools = new Set();
      if (hasContent) {
        for (const tile of tiles) {
          const { type } = tile.content;
          if (type === "Placeholder") continue;
          tools.add(type);
        }
      }

      console.log(documentsProcessed, "No metadata", `${key}/users/${userId}/documentMetadata/${docId}`,
        {type: doc.type, hasContent });

      if (tools.size) {
        console.log("tools", [...tools]);
      }

      const typeSpecificMetadata = { offerings: {}} as any;
      if (learningLogMetadata) typeSpecificMetadata.learningLogMetadata = learningLogMetadata;
      if (personalDocMetadata) typeSpecificMetadata.personalDocMetadata = personalDocMetadata;

      // Look for type specific metadata
      // We have to search through several places since we don't have an offering id
      for (const [offeringId, offering] of Object.entries(offerings)) {
        const offeringUser = (offering as any).users?.[userId];
        const problemMetadata = offeringUser?.documents?.[docId];
        const planningMetadata = offeringUser?.planning?.[docId];
        if (problemMetadata || planningMetadata) {
          typeSpecificMetadata.offerings[offeringId] = {};
        }
        if (problemMetadata) {
          typeSpecificMetadata.offerings[offeringId].problemMetadata = problemMetadata;
        }
        if (planningMetadata) {
          typeSpecificMetadata.offerings[offeringId].planningMetadata = planningMetadata;
        }
      }

      for (const [offeringId, problemDocPublicationsOffering] of Object.entries(problemDocPublications)) {
        const problemDocPublication = problemDocPublicationsOffering?.[docId];
        if (problemDocPublication) {
          if (typeSpecificMetadata.offerings[offeringId]) {
            typeSpecificMetadata.offerings[offeringId] = {};
          }
          typeSpecificMetadata.offerings[offeringId].problemDocPublication = problemDocPublication;
        }
      }

      const personalPublication = personalPublications?.[docId];
      if (personalPublication) {
        typeSpecificMetadata.personalPublication = personalPublication;
      }
      const learningLogPublication = learningLogPublications?.[docId];
      if (learningLogPublication) {
        typeSpecificMetadata.learningLogPublication = learningLogPublication;
      }

      if (Object.keys(typeSpecificMetadata).length > 1 || Object.keys(typeSpecificMetadata.offerings).length > 0) {
        // So far none of the docs without generic metadata have any typeSpecific Metadata
        console.log("typeSpecific", typeSpecificMetadata);

        // If there is type specific metadata don't try to delete this document
        continue;
      }

      // If the doc type is a problem or planning check to see if there is one configured for all
      // of the offerings of this user. If there isn't one, perhaps this doc should be saved.
      //
      if (["problem", "planning"].includes(doc.type)) {
        const offeringStats = {};
        for (const [offeringId, offering] of Object.entries(offerings)) {
          const offeringUser = (offering as any).users?.[userId];
          if (doc.type === "problem") {
            offeringStats[offeringId] = Object.keys(offeringUser?.documents || {}).length;
          }
          if (doc.type === "planning") {
            offeringStats[offeringId] = Object.keys(offeringUser?.planning || {}).length;
          }
        }
        console.log("offeringStats", offeringStats);
        if (deleteDefaultDocsEvenIfThereIsEmptySlot || !Object.values(offeringStats).includes(0)) {
          await deleteDoc();
        }

      }
      if (doc.type === "learningLog") {
        // undefined means there isn't even a learningLogs map in the database
        const numLearningLogs = user.learningLogs && Object.keys(user.learningLogs || {}).length;
        console.log("num learningLogs", numLearningLogs);
        if (deleteDefaultDocsEvenIfThereIsEmptySlot || numLearningLogs) {
          await deleteDoc();
        }
      }
      if (doc.type === "publication") {
        await deleteDoc();
      }
    }

  }
}

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

process.exit(0);
