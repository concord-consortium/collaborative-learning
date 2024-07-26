#!/usr/bin/node

// This script downloads documents from firebase and saves them as text files in src/public/ai
// It will ignore documents that are undefined, fail to parse, or have no tiles in them

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts/ai
// $ npx tsx download-documents.ts

import fs from "fs";
import admin from "firebase-admin";

import { outputAzureFile } from "./azure-utils.js";
import { AIService, datasetPath, networkFileName, tagFileExtension } from "./script-constants.js";
import { DocumentInfo, IAzureMetadata } from "./script-types.js";
import { getFirestoreBasePath, prettyDuration } from "../lib/script-utils.js";
import { outputVertexAIFile } from "./vertexai-utils.js";

// The directory containing the documents you're interested in.
// This should be the output of download-documents.ts.
// Each document should be named like documentID.txt, where ID is the document's id in the database.
const sourceDirectory = "dataset1699369801517";
const aiService: AIService = "vertexAI";

// Number of documents to include in each query. I believe 10 is the max for this.
const queryLimit = 10;

// Used for azure output files
const azureMetadata: IAzureMetadata = {
  projectName: `Comment Tags`,
  storageInputContainerName: "comment-tags",
  description: `Uses tags specified in comments.`
};

console.log(`*** Starting to Compile Document Tags ***`);

const startTime = Date.now();
const documentInfo: Record<string, DocumentInfo> = {};

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

// Fetch the service account key JSON file contents; must be in same folder as script
const credential = admin.credential.cert('../serviceAccountKey.json');
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const credentialTime = Date.now();

const sourcePath = `${datasetPath}${sourceDirectory}`;

// Get network info from portal file. This should have been created by download-documents.ts.
function getNetworkInfo() {
  const networkFile = `${sourcePath}/${networkFileName}`;
  if (fs.existsSync(networkFile)) {
    return JSON.parse(fs.readFileSync(networkFile, "utf8"));
  }
}
const { portal, demo } = getNetworkInfo() ?? { portal: "learn.concord.org" };

// Determine ids of relevant documents by looking at files in source directory
const tagCounts: Record<string, number> = {};
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
const collectionUrl = getFirestoreBasePath(portal, demo);
const documentCollection = admin.firestore().collection(collectionUrl);

let documentsProcessed = 0;
let commentsProcessed = 0;
let tagsProcessed = 0;
let tagsIncluded = 0;
let emptyTags = 0;

// Look through all documents
for (let i = 0; i < includedDocumentIds.length; i += queryLimit) {
  // Documents are retrieved from firestore in batches so we can use the where query, which has a limit of 10.
  console.log(`--- Checking documents ${i}-${i+queryLimit}`);
  const documentIdSubset = includedDocumentIds.slice(i, i + queryLimit);
  const documentSnapshots = await documentCollection.where("key", "in", documentIdSubset).get();

  const processDocument =
    async (documentSnapshot: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>) => {
      const documentStartTime = Date.now();
      const documentId = documentSnapshot.data().key;

      // Get the document's comments from firestore
      const commentsUrl = `${documentSnapshot.ref.path}/comments`;
      const commentCollection = admin.firestore().collection(commentsUrl);
      const commentSnapshots = await commentCollection.get();

      // Process each comment in series
      const processComment =
        (commentSnapshot: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>) => {
          const commentTags = commentSnapshot.data().tags ?? [];
          commentTags.forEach(tag => {
            if (tag) {
              // Don't include empty tags
              if (!documentTags[documentId].includes(tag)) {
                // For now, just add all tags to the document.
                // In the future we might want to refine this behavior, for example only including the last tag applied.
                documentTags[documentId].push(tag);

                tagsIncluded++;
                if (!tagCounts[tag]) tagCounts[tag] = 0;
                tagCounts[tag]++;
              }
              tagsProcessed++;
            } else {
              emptyTags++;
            }
          });
          commentsProcessed++;
        };
      for (const _commentSnapshot of commentSnapshots.docs) {
        processComment(_commentSnapshot);
      }

      documentInfo[documentId] = {
        fileName: `document${documentId}.txt`,
        tags: documentTags[documentId]
      };

      documentsProcessed++;
      const documentEndTime = Date.now();
      console.log(`  - Processed document ${documentId} in ${prettyDuration(documentEndTime - documentStartTime)}`);
  };
  // It would be better to process documents in parallel, but I wasn't able to figure out how to do it in time.
  for (const _documentSnapshot of documentSnapshots.docs) {
    await processDocument(_documentSnapshot);
  }
}

// Write output file
const fileName = `${aiService}-comment-tags${tagFileExtension[aiService]}`;
const outputFileProps = { documentInfo, fileName, sourceDirectory, azureMetadata };
const outputFunctions = { azure: outputAzureFile, vertexAI: outputVertexAIFile };
outputFunctions[aiService](outputFileProps);

const endTime = Date.now();
console.log(`***** End script *****`);
console.log(`*** Tags used ***`);
Object.keys(tagCounts).forEach(tag => {
  console.log(`* ${tag}: ${tagCounts[tag]}`);
});
console.log(`- Time to get credential: ${prettyDuration(credentialTime - startTime)}`);
console.log(`- Time to download documents: ${prettyDuration(tagStartTime - startTime)}`);
console.log(`- Total Time: ${prettyDuration(endTime - startTime)}`);
console.log(`+ Documents processed: ${documentsProcessed}`);
console.log(`+ Comments processed: ${commentsProcessed}`);
console.log(`+ Tags processed: ${tagsProcessed}`);
console.log(`+ Tags included: ${tagsIncluded}`);
console.log(`+ Empty tags ignored: ${emptyTags}`);

process.exit(0);
