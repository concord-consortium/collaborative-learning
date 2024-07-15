#!/usr/bin/node

// This script counts documents downloaded with download-documents-with-info.ts,
// then prints the counts to the terminal.
// It is currently set up to count the types of documents in the document collection, as well as how many
// documents have titles.

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// Change sourceDirectory to be the name of the directory containing your documents
// Change targetTileTypes to be a list of the tile types you want to count (like ["Geometry", "Text", "Table"])
// Set aiService to be whichever service you're interested in. This will determine the format of the output file.
// $ cd scripts/ai
// $ npx tsx count-docs.ts

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

import { fetchOffering } from "../lib/fetch-offering.js";
import { prettyDuration } from "../lib/script-utils.js";

import { datasetPath } from "./script-constants.js";
// const sourceDirectory = "dataset1720814823478";
const sourceDirectory = "dataset1721059336040";
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

interface OfferingInfo {
  activity_url,
  clazz_id,
  clazz_hash
}
const offeringInfo: Record<string, OfferingInfo> = {};

const networkInfoContent = fs.readFileSync(path.resolve(sourcePath, "network.json"), "utf8");
const networkInfo = JSON.parse(networkInfoContent);

const { demo } = networkInfo;
if (demo) {
  for (const offeringId of offeringIds) {
    let [full, unitCode, investigation, problem] = offeringId.match(/(.*)(\d)(\d\d)/);
    if (!unitCode) unitCode = "sas";
    problem = stripLeadingZero(problem);
    console.log({unitCode, investigation, problem});
  }
} else {
  let numFetchedOfferings = 0;

  for (const offeringId of offeringIds) {
    const offering = await fetchOffering("https://learn.concord.org", offeringId);
    if (!offering) continue;
    const {activity_url, clazz_id, clazz_hash} = offering;
    offeringInfo[offeringId] = {
      activity_url, clazz_id, clazz_hash
    };
    numFetchedOfferings++;
    if (numFetchedOfferings % 100 === 0) {
      console.log(`Fetched ${numFetchedOfferings} offerings`);
    }
  }

  // Write a offering Info as a JSON file for use by later scripts
  const offeringInfoFile = `${sourcePath}/offering-info.json`;
  fs.writeFileSync(offeringInfoFile, stringify(offeringInfo));

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
