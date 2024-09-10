#!/usr/bin/node

// This script parses documents downloaded with download-documents-with-info.ts, uses the information in them
// to fetch related offering and class data from a portal, and writes that data to local files that can be used by
// other scripts to update Firestore metadata documents.

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// Change sourceDirectory to be the name of the directory containing your documents
// $ cd scripts/ai
// $ npx tsx get-offering-info.ts

import fs from "fs";
import admin from "firebase-admin";
import path from "path";
import stringify from "json-stringify-pretty-compact";

import { fetchPortalClass, fetchPortalOffering } from "../lib/fetch-portal-entity.js";
import { getFirestoreUsersPath, getScriptRootFilePath, prettyDuration } from "../lib/script-utils.js";

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";
// Fetch the service account key JSON file contents
const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
const credential = admin.credential.cert(serviceAccountFile);
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

import { datasetPath } from "./script-constants.js";
const sourceDirectory = "dataset1724085367882";
// src/public/ai/dataset1720819925834
// The number of files to process in parallel
const fileBatchSize = 8;

const sourcePath = `${datasetPath}${sourceDirectory}`;

console.log(`*** Starting Fetch Problem Info ***`);

const startTime = Date.now();
let checkedFiles = 0;
let processedFiles = 0;
let filesWithOfferings = 0;

const offeringIds = new Set<string>();

// Collect all of the unique offeringIds
async function processFile(file: string) {
  const filePath = `${sourcePath}/${file}`;
  if (file.startsWith("documentInfo")) {
    // For files named like documentXXX.txt, read the file
    const content = fs.readFileSync(filePath, "utf8");
    const parsedContent = JSON.parse(content);
    const { offeringId } = parsedContent;

    processedFiles++;

    if (!offeringId) return;

    offeringIds.add(offeringId);
    filesWithOfferings++;
  }
}

let fileBatch: string[] = [];
// Process a batch of files
async function processBatch() {
  await Promise.all(fileBatch.map(async f => processFile(f)));
  fileBatch = [];
}

console.log(`*** Loading downloaded CLUE documents with info ***`);

await new Promise<void>((resolve) => {
  // Process every file in the source directory
  fs.readdir(sourcePath, async (_error, files) => {
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

const finishedLoading = Date.now();
const loadingDuration = finishedLoading - startTime;
console.log(`*** Loaded ${processedFiles} files in ${prettyDuration(loadingDuration)}s ***`);
console.log(`*** Found ${filesWithOfferings} documents with offerings ***`);
console.log(`*** Found ${offeringIds.size} unique offerings ***`);

// FIXME: To support the current usage of a teacher array in the metadata documents
// we should save the list of teachers of the offering. However it would be best to
// update this list in the Firestore <root>/classes/[class doc], and remove the
// teacher list from the metadata documents.
interface OfferingInfo {
  activity_url: string,
  clazz_id: string,
  clazz_hash: string
}

interface IClassTeacher {
  user_id: string
}

interface IPortalClassData {
  class_hash: string,
  name: string,
  teachers: IClassTeacher[],
  uri: string
}

interface ClassInfo {
  context_id: string,
  id: string,
  name: string,
  networks: string[],
  teachers: string[],
  uri: string
}

const offeringInfo: Record<string, OfferingInfo> = {};
const classInfo: Record<string, ClassInfo> = {};

const networkInfoContent = fs.readFileSync(path.resolve(sourcePath, "network.json"), "utf8");
const networkInfo = JSON.parse(networkInfoContent);

const { demo, portal } = networkInfo;
if (demo) {
  for (const offeringId of offeringIds) {
    const match = offeringId.match(/(.*)(\d)(\d\d)/);
    if (match) {
      let [full, unitCode, investigation, problem] = match;
      if (!unitCode) unitCode = "sas";
      problem = stripLeadingZero(problem);
      console.log({unitCode, investigation, problem});
    }
  }
} else {
  let numFetchedOfferings = 0;
  const clazzes = new Set<string>();

  for (const offeringId of offeringIds) {
    if (!offeringId) continue;
    const offering = await fetchPortalOffering(`https://${portal}`, offeringId);
    if (!offering) continue;
    const {activity_url, clazz_id, clazz_hash} = offering;
    if (!clazzes.has(clazz_id)) {
      clazzes.add(clazz_id);
    }
    offeringInfo[offeringId] = {
      activity_url, clazz_id, clazz_hash
    };
    numFetchedOfferings++;
    if (numFetchedOfferings % 100 === 0) {
      console.log(`Fetched ${numFetchedOfferings} offerings`);
    }
  }

  // Write offering info as a JSON file for use by later scripts
  console.log("Preparing to write offering file.");
  const offeringInfoFile = `${sourcePath}/offering-info.json`;
  fs.writeFileSync(offeringInfoFile, stringify(offeringInfo));

  const processedTeachers = new Map<string, string[]>();

  const collectionUrl = getFirestoreUsersPath(portal, demo);
  const documentCollection = admin.firestore().collection(collectionUrl);

  for (const clazz_id of clazzes) {
    if (!clazz_id) continue;

    const clazzData = await fetchPortalClass(`https://${portal}`, clazz_id);
    if (Object.keys(clazzData).length === 0) continue;

    const { class_hash, name, teachers, uri } = clazzData as IPortalClassData;
    const teacherNetworks = new Set<string>();
    const teacherIds: string[] = [];

    // Prepare an array of teacher user IDs that need to be fetched
    const teacherFetchPromises = teachers.map(async (classTeacher: IClassTeacher) => {
      const { user_id } = classTeacher;
      teacherIds.push(user_id);

      if (!processedTeachers.has(user_id)) {
        const userQuery = await documentCollection.where("uid", "==", String(user_id)).get();
          if (userQuery.empty) {
            console.log(`No user found with uid ${user_id}`);
            return;
          }

          const userDoc = userQuery.docs[0].data();
          const { networks } = userDoc;

          for (const network of networks) {
            teacherNetworks.add(network);
          }

          processedTeachers.set(user_id, networks);
        } else {
          const networks = processedTeachers.get(user_id);
          for (const network of networks) {
            teacherNetworks.add(network);
          }
        }
    });

    await Promise.all(teacherFetchPromises);

    classInfo[clazz_id] = {
        context_id: class_hash,
        id: clazz_id,
        name,
        networks: Array.from(teacherNetworks),
        teachers: teacherIds,
        uri
    };
  }

  // For each classInfo write class info as a JSON file for use by later scripts
  const classInfoFile = `${sourcePath}/class-info.json`;
  fs.writeFileSync(classInfoFile, stringify(classInfo));

  const finishedFetchingOfferings = Date.now();
  const fetchingDuration = finishedFetchingOfferings - finishedLoading;
  console.log(`*** Fetched ${numFetchedOfferings} offerings in ${prettyDuration(fetchingDuration)}s ***`);
}


// Write to an output file when all of the files have been processed
// const fileName = `${annotationTypes.join("-")}.json`;
// const filePath = `${sourcePath}/${fileName}`;
// console.log(`**** Writing annotation info to ${filePath} ****`);
// fs.writeFileSync(filePath, stringify(documentInfo, { maxLength: 100 }));
// console.log(`**** Annotation info saved to ${filePath} ****`);
// const outputFileProps = { documentInfo, fileName, sourceDirectory, azureMetadata };
// const outputFunctions = { azure: outputAzureFile, vertexAI: outputVertexAIFile };
// outputFunctions[aiService](outputFileProps);


function stripLeadingZero(input: string) {
  return Number(input).toString();
}

process.exit(0);
