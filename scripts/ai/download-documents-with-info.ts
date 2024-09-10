#!/usr/bin/node

// This script downloads documents from firebase and saves them as text files in src/public/ai
// It will ignore documents that are undefined, fail to parse, or have no tiles in them
// This script differs from download-documents.ts in that it saves more information than just the document content

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts/ai
// $ npx tsx download-documents-with-info.ts

import fs from "fs";
import admin from "firebase-admin";
import stringify from "json-stringify-pretty-compact";

import { datasetPath, networkFileName } from "./script-constants.js";
import { getFirebaseBasePath, getScriptRootFilePath, prettyDuration,
  remapFirebaseClassPublications, remapFirebaseProblemDocPublications } from "../lib/script-utils.js";

// Load the service account key JSON file.
import { getClassKeys } from "../lib/firebase-classes.js";

// The portal to get documents from. For example, "learn.concord.org".
const portal = "learn.concord.org";
// const portal = "learn.portal.staging.concord.org";
// The demo name to use. Make falsy to not use a demo.
// const demo = "TAGCLUE";
const demo = false;

// Make falsy to include all documents
const documentLimit = false;
// const documentLimit = 10000;

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

const targetDir = `dataset${startTime}`;
const targetPath = `${datasetPath}${targetDir}`;
await fs.mkdir(targetPath, error => {
  if (error) {
    console.log(`Failed to create ${targetPath}`, error);
  }
});
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

  // console.log(key);
  // console.log(`  - ${Object.keys(users).length} users`);
  // console.log(`  - ${Object.keys(offerings).length} offerings`);
  // personalPublications &&
  //   console.log(`  - ${Object.keys(personalPublications).length} personalPublications`);
  // learningLogPublications &&
  //   console.log(`  - ${Object.keys(learningLogPublications).length} learningLogPublications`);
  for (const [userId, user] of Object.entries<any>(users)) {
    if (documentLimit && documentsProcessed >= documentLimit) break;
    // console.log(`  ${userId}`);
    if (!user.documents) continue;
    for (const [docId, doc] of Object.entries<any>(user.documents)) {
      if (documentLimit && documentsProcessed >= documentLimit) break;

      const content = doc.content as string | undefined;
      let parsedContent;
      let tiles;
      if (!content) {
        // console.log(`    ${docId} - undefined content`);
        undefinedDocuments++;
      } else {
        try {
          parsedContent = JSON.parse(content);
          tiles = Object.values<any>(parsedContent.tileMap);
          if (tiles.length === 0) {
            // console.log(`      - no tiles`);
            emptyDocuments++;
          }
        } catch (e) {
          // console.log(`    ${docId} - error parsing content`);
          // console.log(`      ${e}`);
          failedDocuments++;
        }
      }

      const documentMetadata = user.documentMetadata[docId];
      const offeringId = documentMetadata?.offeringId;
      const offering = offeringId && offerings[offeringId];
      const problemDocPublication = offeringId && problemDocPublications[offeringId]?.[docId];
      const extraInfo = {} as any;

      // Set the visibility of the document based on type or existing visibility value.
      // The default values vary per document type.
      switch (documentMetadata?.type) {
        case "problem":
        case "planning":
          extraInfo.visibility = documentMetadata.visibility || "unknown";
          break;
        case "learningLog":
        case "personal":
          extraInfo.visibility = documentMetadata.visibility || "private";
          break;
        case "learningLogPublication":
        case "personalPublication":
        case "publication":
          extraInfo.visibility = "public";
          break;
        default:
          extraInfo.visibility = "unknown";
          break;
      }

      if (offering) {
        const offeringUser = offering.users?.[userId];
        const problemMetadata = offeringUser?.documents?.[docId];
        extraInfo.problemVisibility = problemMetadata?.visbility;
        const planningMetadata = offeringUser?.planning?.[docId];
        extraInfo.planningVisibility = planningMetadata?.visbility;
        // If there is a problemMetadata or planningMetadata, then the visibility value
        // previously set above should be overridden. Note that we use different default
        // values here than above for problem and planning.
        if (problemMetadata) {
          extraInfo.visibility = problemMetadata.visibility || "private";
        } else if (planningMetadata) {
          extraInfo.visibility = planningMetadata.visibility || "private";
        }
      }

      // It should really be published as one type or the other
      // TODO: add error checking to see if the documentType matches
      const classPublication = personalPublications?.[docId] || learningLogPublications?.[docId];

      extraInfo.documentTitle =
        user.personalDocs?.[docId]?.title ||
        user.learningLogs?.[docId]?.title ||
        classPublication?.title;

      if (classPublication) {
        extraInfo.originDoc = classPublication.originDoc;
        extraInfo.pubVersion = classPublication.pubVersion;
      }

      if (problemDocPublication) {
        extraInfo.pubVersion = problemDocPublication.pubVersion;
        extraInfo.groupId = problemDocPublication.groupId;
        extraInfo.groupUserConnections = problemDocPublication.groupUserConnections;
        // These problem document publications don't have originDoc keys. The originDoc
        // should be the problem doc for the same user and offering
      }

      // console.log(`    ${docId}`);
      const documentId = `documentInfo${docId}`;
      const documentFile = `${targetPath}/${documentId}.txt`;
      const documentType = documentMetadata?.type;
      const fileContent = {
        classId: key,
        offeringId,
        userId,
        documentId: docId,
        documentType,
        documentContent: parsedContent,
        contentStatus: !content ? "none" : !parsedContent ? "invalid" : !tiles?.length ? "empty" : "full",
        ...extraInfo
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
