#!/usr/bin/node

// This script uses the downloaded documents to get a list of document ids and the network info
// then creates or updates Firestore metadata documents

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ npx tsx ai/update-metadata.ts

import fs from "fs";
import admin from "firebase-admin";

import { datasetPath, networkFileName } from "./script-constants.js";
import { getFirestoreBasePath, getProblemDetails, getScriptRootFilePath } from "../lib/script-utils.js";

// The directory containing the documents you're interested in.
// This should be the output of download-documents.ts.
// Each document should be named like documentID.txt, where ID is the document's id in the database.
const sourceDirectory = "dataset1724185627549";

console.log(`*** Starting to Update Metadata ***`);

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

// Fetch the service account key JSON file contents
const credential = admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json"));
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const sourcePath = `${datasetPath}${sourceDirectory}`;

const processComment = (
  commentSnapshot: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>,
  strategies: string[]
) => {
  const commentSnapshotTags = commentSnapshot.data().tags;
  if (commentSnapshotTags != null && !Array.isArray(commentSnapshotTags)) {
    console.log("Found invalid comment tags", commentSnapshot.ref.path, commentSnapshotTags);
    return;
  }
  const commentTags = commentSnapshotTags ?? [];

  commentTags.forEach(tag => {
    if (tag) {
      if (!strategies.includes(tag)) {
        strategies.push(tag);
      }
    }
  });
};

// Get network info from portal file. This should have been created by download-documents.ts.
function getNetworkInfo() {
  const networkFile = `${sourcePath}/${networkFileName}`;
  if (fs.existsSync(networkFile)) {
    return JSON.parse(fs.readFileSync(networkFile, "utf8"));
  }
}
const { portal, demo } = getNetworkInfo();

console.log(`***** Reading doc and updating metadata *****`);
const collectionUrl = getFirestoreBasePath(portal, demo);
console.log(`*** Updating docs in ${collectionUrl} ***`);
const documentCollection = admin.firestore().collection(collectionUrl);

const offeringInfoFile = `${sourcePath}/offering-info.json`;
let offeringInfo;
if (!demo) {
  offeringInfo = JSON.parse(fs.readFileSync(offeringInfoFile, "utf8"));
}

let processedFiles = 0;
let metadataUpdated = 0;
let metadataCreated = 0;

interface UnitFields {
  problem?: string;
  investigation?: string;
  unit: null | string;
}

// Collect all of the unique offeringIds
async function processFile(file: string) {
  const filePath = `${sourcePath}/${file}`;
  if (file.startsWith("documentInfo")) {
    // For files named like documentXXX.txt, read the file
    const content = fs.readFileSync(filePath, "utf8");
    const parsedContent = JSON.parse(content);
    const {
      classId,
      documentContent,
      documentId,
      documentTitle,
      documentType,
      offeringId,
      originDoc,
      userId,
      visibility
    } = parsedContent;

    processedFiles++;

    const tiles = documentContent?.tileMap ? Object.values<any>(documentContent.tileMap) : [];
    const tools = [];
    for (const tile of tiles) {
      if (!tools.includes(tile.content.type)) {
        tools.push(tile.content.type);
      }
    }

    const annotations = documentContent?.annotations ? Object.values<any>(documentContent.annotations) : [];
    for (const annotation of annotations) {
      // for now we only want Sparrow annotations
      // we might want to change this if we want to count other types in the future
      if (annotation.type === "arrowAnnotation" && !tools.includes("Sparrow")) {
        tools.push("Sparrow");
      }
    }

    // If it has no offering we add a
    // unit: null field so it is easy to find these metadata documents without looking at what
    // type of document the metadata is for
    let unitFields: UnitFields = {
      unit: null
    };

    if (!demo) {
      const offering = offeringInfo[offeringId];
      if (offering) {
        const { activity_url } = offering;
        try {
          const { investigation, problem, unit } = getProblemDetails(activity_url);

          if (unit && !problem) {
            console.log("Found unit but not problem in activity_url", activity_url);
          }

          unitFields = {
            problem,
            investigation,
            unit
          };
        } catch (e) {
          console.error(e, {offeringId, offering});
          console.log("Skipping document because it has an invalid offering", {offeringId, offering});
          return;
        }
      }
    } else {
      if (offeringId) {
        // Extract the unit, investigation, and problem from the offeringId.
        // The `offeringId` structure can vary. In some cases, there is no unit code. There are also cases where
        // there is no investigation number. For example, in demo mode if the unit is not specified, there will
        // be no unit value. And in the case where the investigation is 0 (like with the Intro to CLUE
        // investigation in the Introduction to CLUE unit) the investigation will be undefined. In those cases,
        // we default to "sas" for the unit and "0" for the investigation.
        let unitCode = "";
        let investigation = "";
        let problem = "";
        const match = offeringId.match(/(.*?)(\d)(\d\d)$/);

        if (match) {
          [, unitCode, investigation, problem] = match;
        } else {
          investigation = "0";
          problem = offeringId.match(/\d+/)?.[0] || "";
        }

        if (!unitCode) unitCode = "sas";
        problem = stripLeadingZero(problem);

        unitFields = {
          problem,
          investigation,
          unit: unitCode
        };
      }
    }

    // TODO: download docs in batches instead of one at a time
    const documentSnapshots = await documentCollection.where("key", "==", documentId).select().get();

    const strategies = [];
    for (const _documentSnapshot of documentSnapshots.docs) {
      // Get the document's comments from firestore
      const commentsUrl = `${_documentSnapshot.ref.path}/comments`;
      const commentCollection = admin.firestore().collection(commentsUrl);
      const commentSnapshots = await commentCollection.get();
      for (const _commentSnapshot of commentSnapshots.docs) {
        processComment(_commentSnapshot, strategies);
      }
    }

    if (documentSnapshots.empty) {
      const metaData = {
        ...unitFields,
        key: documentId,

        // In metadata documents created by the CLUE runtime during a real Portal launch,
        // this value is the classHash not the portal classId.
        // The download-documents-with-info stores the CLUE class "key" as `classId`. It turns
        // out that this class "key" is the portal classHash. So we are setting it to the right
        // value here.
        // FIXME: rename the classId in download-documents-with-info to either be contextId or
        // classKey to hopefully prevent some confusion.
        context_id: classId,

        // When the CLUE runtime creates one of these metadata documents, this value is copied
        // from the CLUE document.  The createdAt field is stored in the document metadata in
        // Firebase. It is set when the document is first created in Firebase by `createDocument`
        // in `db.ts`.
        // FIXME: we should be saving this value in download-document script, then we can
        // use that createdAt time here when the metadata is created.
        createdAt: 0,

        // See https://docs.google.com/document/d/1VDr-nkthu333eVD0BQXPYPVD8kt60qkMYq2jRkXza9c/edit#heading=h.4flcr59qjnx1
        // for information on setting the network to null.
        network: null,

        // Make sure this is set to at least null.
        // Note that the published problem documents should have an originDoc but currently they
        // don't.
        originDoc: originDoc || null,

        // In some cases this has the pubVersion for a published document. For now we'll just
        // leave it as an empty object which is the most common case.
        properties: {},

        strategies,
        tools,
        title: documentTitle || null,
        type: documentType,
        uid: userId,
        visibility
      };

      if (!documentType) {
        console.log("Skipping document because it has no documentType", documentId);
        return;
      }

      // Use a prefix of `uid:[owner_uid]` for metadata documents that we create for more
      // info see:
      // https://docs.google.com/document/d/1VDr-nkthu333eVD0BQXPYPVD8kt60qkMYq2jRkXza9c/edit#heading=h.5t2tt6igiiou
      const metaDataDocId = `uid:${userId}_${documentId}`;

      const newMetaDataDoc = documentCollection.doc(metaDataDocId);
      await newMetaDataDoc.create(metaData);
      console.log(processedFiles, documentId, "Created new metadata", metaDataDocId);
      metadataCreated++;
    } else {
      // There can be multiple metadata documents for each actual document.
      // For now we just update all of these documents, but we should fix the runtime code so it
      // stops creating multiple copies. See:
      // https://docs.google.com/document/d/1VDr-nkthu333eVD0BQXPYPVD8kt60qkMYq2jRkXza9c/edit#heading=h.5t2tt6igiiou
      documentSnapshots.forEach(doc => {
        const newMetadata = {
          ...unitFields,
          strategies,
          tools,
          visibility
        };
        doc.ref.update(newMetadata as any);
        console.log(processedFiles, documentId, doc.id, "Updated metadata");
        metadataUpdated++;
      });
    }
  }
}

let fileBatch: string[] = [];
// Process a batch of files
async function processBatch() {
  await Promise.all(fileBatch.map(async f => processFile(f)));
  fileBatch = [];
}

console.log(`*** Loading downloaded CLUE documents with info ***`);

let checkedFiles = 0;
// The number of files to process in parallel
const fileBatchSize = 8;

await new Promise<void>((resolve) => {
  // Process every file in the source directory
  fs.readdir(sourcePath, async (_error, files) => {
    console.log(`*** Processing ${files.length} documents ***`);
    for (const file of files) {
      checkedFiles++;
      fileBatch.push(file);

      // We're finished if we've made it through all of the files
      const finished = checkedFiles >= files.length;
      if (fileBatch.length >= fileBatchSize || finished) {
        await processBatch();

        if (finished) {
          resolve();
        }
      }
    }
  });
});

function stripLeadingZero(input: string) {
  return Number(input).toString();
}

console.log(`*** Processed ${processedFiles} downloaded CLUE docs ***`);
console.log(`*** Created ${metadataCreated} metadata docs ***`);
console.log(`*** Updated ${metadataUpdated} metadata docs ***`);
