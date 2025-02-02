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

import { datasetPath } from "./script-constants.js";
import { prettyDuration } from "../lib/script-utils.js";

const sourceDirectory = "dataset1706677550897";

// The number of files to process in parallel
const fileBatchSize = 8;

const sourcePath = `${datasetPath}${sourceDirectory}`;

console.log(`*** Starting Document Count ***`);

const startTime = Date.now();
let checkedFiles = 0;
let processedFiles = 0;
const typeCounts: Record<string, number> = {};
let titles = 0;

// Processes a file, counting the relevant tiles in it if it's a document
async function processFile(file: string) {
  const path = `${sourcePath}/${file}`;
  if (file.startsWith("documentInfo")) {
    // For files named like documentXXX.txt, read the file
    const content = fs.readFileSync(path, "utf8");
    const parsedContent = JSON.parse(content);
    const { documentContent, ...documentIds } = parsedContent;

    if (!Object.keys(typeCounts).includes(documentIds.documentType)) {
      typeCounts[documentIds.documentType] = 0;
    }
    typeCounts[documentIds.documentType]++;

    if (documentIds.documentTitle) titles++;

    processedFiles++;
  }
}

let fileBatch: string[] = [];
// Process a batch of files
async function processBatch() {
  await Promise.all(fileBatch.map(async f => processFile(f)));
  fileBatch = [];

  const currentDuration = Date.now() - startTime;
  console.log(`*** Time to count tiles in ${processedFiles} documents`, prettyDuration(currentDuration));
}

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
        // Write to an output file when all of the files have been processed
        // const fileName = `${annotationTypes.join("-")}.json`;
        // const filePath = `${sourcePath}/${fileName}`;
        // console.log(`**** Writing annotation info to ${filePath} ****`);
        // fs.writeFileSync(filePath, stringify(documentInfo, { maxLength: 100 }));
        // console.log(`**** Annotation info saved to ${filePath} ****`);
        // const outputFileProps = { documentInfo, fileName, sourceDirectory, azureMetadata };
        // const outputFunctions = { azure: outputAzureFile, vertexAI: outputVertexAIFile };
        // outputFunctions[aiService](outputFileProps);

        const endTime = Date.now();
        const finalDuration = endTime - startTime;
        console.log(`***** Finished in ${prettyDuration(finalDuration)} *****`);
        console.log(`*** Found ${titles} documents with titles ***`);
        console.log(`*** Document types ***`);
        Object.keys(typeCounts).forEach(type => {
          console.log(`${type}: ${typeCounts[type]}`);
        });

        process.exit(0);
      }
    }
  }
});
