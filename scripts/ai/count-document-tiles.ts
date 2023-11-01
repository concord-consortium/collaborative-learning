#!/usr/bin/node

// This script counts the tiles of specific types in documents downloaded with download-documents.ts,
// then saves the information as tags in an output file that can be used to train a model from a specified AI service.

// TODO Make sure there are at least 10 of a tag before including it

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// Change sourceDirectory to be the name of the directory containing your documents
// Change targetTileTypes to be a list of the tile types you want to count (like ["Geometry", "Text", "Table"])
// Set aiService to be whichever service you're interested in. This will determine the format of the output file.
// $ cd scripts/ai
// $ npx tsx count-document-tiles.ts

import fs from "fs";

import { outputAzureFile } from "./azure-utils";
import { AIService, cloudFileRoot, datasetPath, tagFileExtension } from "./script-constants";
import { DocumentInfo, IAzureMetadata } from "./script-types";
import { prettyDuration } from "./script-utils";

const sourceDirectory = "dataset1698192448944";
// const targetTileTypes = ["Geometry", "Text", "Table"];
const targetTileTypes = ["Geometry"];
const aiService: AIService = "azure";

// The number of files to process in parallel
const fileBatchSize = 8;

// The maximum number of tiles to count (if 5, this count or more will be tagged as 5+)
const maxTileCount = 5;

// Used for azure output files
const azureMetadata: IAzureMetadata = {
  projectName: `Count${targetTileTypes.join("")}`,
  storageInputContainerName: "tile-count",
  description: `Counts ${targetTileTypes.join(", ")} tiles in CLUE documents.`
};

const sourcePath = `${datasetPath}${sourceDirectory}`;

console.log(`*** Starting Tile Count ***`);
console.log(`* Counting ${targetTileTypes.join(", ")} Tiles *`);

const startTime = Date.now();
let checkedFiles = 0;
let processedFiles = 0;
const documentInfo: Record<string, DocumentInfo> = {};
const tagCounts = {};

// Porcesses a file, counting the relevant tiles in it if it's a document
async function processFile(file: string) {
  const path = `${sourcePath}/${file}`;
  if (file.startsWith("document")) {
    // For files named like documentXXX.txt, read the file
    const content = fs.readFileSync(path, "utf8");
    const parsedContent = JSON.parse(content);

    // Set up infrastructure to count tiles
    const tileCounts = {};
    targetTileTypes.forEach(tileType => tileCounts[tileType] = 0);

    // Check each tile in the document and count the relevant ones
    const tiles = Object.values<any>(parsedContent.tileMap);
    for (const tile of tiles) {
      const tileType = tile.content.type;
      if (targetTileTypes.includes(tileType)) {
        tileCounts[tileType]++;
      }
    }
    const tags: string[] = [];
    targetTileTypes.forEach(targetTileType => {
      const typeCount = tileCounts[targetTileType];
      const tagNumber = typeCount >= maxTileCount ? `${maxTileCount}+` : `${typeCount}`;
      const tag = `${targetTileType}${tagNumber}`;
      tags.push(tag);
      if (!tagCounts[tag]) tagCounts[tag] = 0;
      tagCounts[tag]++;
    });
    documentInfo[file] = {
      fileName: file,
      tags
    };

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
        const tagFileName = `${aiService}-${targetTileTypes.join("-")}${tagFileExtension[aiService]}`;
        let tagFileContent = "";
        if (aiService === "azure") {
          outputAzureFile({
            documentInfo,
            filename: tagFileName,
            sourceDirectory,
            azureMetadata
          });
        } else if (aiService === "vertexAI") {
          Object.values(documentInfo).forEach(info => {
            const fileName = `${cloudFileRoot}${info.fileName}`;
            const tagPart = info.tags.join(",");
            const comma = tagPart ? "," : "";
            const line = `${fileName}${comma}${tagPart}\n`;
            tagFileContent = `${tagFileContent}${line}`;
          });
        }

        const endTime = Date.now();
        const finalDuration = endTime - startTime;
        console.log(`***** Finished in ${prettyDuration(finalDuration)} *****`);
        console.log(`*** Final Tag Counts ***`);
        Object.keys(tagCounts).sort().forEach(tag => {
          console.log(`${tag}: ${tagCounts[tag]}`);
        });

        process.exit(0);
      }
    }
  }
});
