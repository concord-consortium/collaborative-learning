import fs from "fs";
import readline from "readline";

import { prettyDuration } from "../lib/script-utils.js";
import { makeCLUEScreenshot } from "../lib/screenshot.js";
import { IProcessFilesStats, processFiles } from "../lib/process-files.js";

// This script saves images of all the documents in a folder and updates its tags.csv with new folder and file names.
// It's intended to be used on the output of count-document-tiles.ts.

// to run this script:
// cf. https://stackoverflow.com/a/66626333/16328462
// Run count-document-tiles.ts (see that file for running instructions)
// Change documentDirectory (below) to be the name of the folder created by count-document-tiles.ts
// Start a local CLUE server
// Then type the following in the terminal
// $ cd scripts/ai
// $ npx tsx document-screenshots.ts

const documentDirectory = "dataset1697150265495";
// const documentDirectory = "dataset1";

const publicRoot = "ai";
const rootPath = `../../src/public/${publicRoot}`;
const documentPath = `${rootPath}/${documentDirectory}`;
const publicPath = `${publicRoot}/${documentDirectory}`;
const tagFileName = "tags.csv";

const startTime = Date.now();
let totalSnapshots = 0;
const targetDir = `screenshotDataset${startTime}`;
const targetPath = `${rootPath}/${targetDir}`;

const failedFiles: string[] = [];

console.log(`***** Starting document screenshots *****`);

// Create the target directory
await fs.mkdir(targetPath, error => {
  if (error) {
    console.log(`Failed to create ${targetPath}`, error);
  }
});

// This function switches a file named "documentXXX.txt" to "screenshotXXX.png"
function newFileName(oldFileName: string) {
  return oldFileName.replace("document", "screenshot").replace("txt", "png");
}

// makeSnapshot loads document content at path in a CLUE standalone document editor, takes a snapshot of it,
// then saves it in the output directory as fileName
const urlRoot = `http://localhost:8080/editor/?appMode=dev&unit=example&document=`;

// Processes a file, usually making a screenshot but updating tags.csv when that file is encountered
async function processFile(file: string, path) {
  if (file.startsWith("document")) {
    // For files named like documentXXX.txt, make a snapshot and save it
    const docEditorPath = `${publicPath}/${file}`;
    const screenshotFileName = newFileName(file);
    try {
      await makeCLUEScreenshot({
        url: `${urlRoot}${docEditorPath}`,
        outputFile: `${targetPath}/${screenshotFileName}`
      });
      totalSnapshots++;
    } catch (error) {
      failedFiles.push(docEditorPath);
    }
  } else if (file === tagFileName) {
    // For the tag.csv file, duplicate the file, modifying the directory and file names
    // Based on top answer at https://stackoverflow.com/questions/6156501/read-a-file-one-line-at-a-time-in-node-js
    const fileStream = fs.createReadStream(path);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    let tagFileContent = "";
    for await (const line of rl) {
      tagFileContent = tagFileContent + newFileName(line).replace(documentDirectory, targetDir) + "\n";
    }
    fs.writeFileSync(`${targetPath}/${tagFileName}`, tagFileContent);
  }
}

function batchComplete(stats: IProcessFilesStats) {
  const currentDuration = Date.now() - stats.startTime;
  console.log(`*** Time to process ${totalSnapshots} snapshots`, prettyDuration(currentDuration));
}

// Process every file in the source directory
const resultStats = await processFiles({
  sourcePath: documentPath,
  processFile,
  batchComplete,
  // Uncomment to limit the number of files processed
  // fileLimit: 100
});

console.log(`***** Finished in ${prettyDuration(resultStats.duration)}`);
if (failedFiles.length > 0) {
  console.log(`Failed to get snapshots for the following files:`);
  console.log(failedFiles);
}
