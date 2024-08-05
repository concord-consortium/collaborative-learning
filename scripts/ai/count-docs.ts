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
import { readFile } from "fs/promises";
import { datasetPath } from "./script-constants.js";
import { prettyDuration } from "../lib/script-utils.js";
import { processFiles } from "../lib/process-files.js";

const sourceDirectory = "dataset1721072285516";

const sourcePath = `${datasetPath}${sourceDirectory}`;

console.log(`*** Starting Document Count ***`);

const typeCounts: Record<string, number> = {};
let titles = 0;

// Processes a file, counting the relevant tiles in it if it's a document
async function processFile(file: string, path: string) {
  const content = await readFile(path, "utf8");
  const parsedContent = JSON.parse(content);

  const { documentContent, ...documentIds } = parsedContent;

  if (!Object.keys(typeCounts).includes(documentIds.documentType)) {
    typeCounts[documentIds.documentType] = 0;
  }
  typeCounts[documentIds.documentType]++;

  if (documentIds.documentTitle) titles++;
}

const stats = await processFiles({
  sourcePath,
  processFile,
  fileNamePrefix: "documentInfo"
});

console.log(`***** Finished in ${prettyDuration(stats.duration)} *****`);
console.log(`*** Found ${titles} documents with titles ***`);
console.log(`*** Document types ***`);
Object.keys(typeCounts).forEach(type => {
  console.log(`${type}: ${typeCounts[type]}`);
});
