import fsPath from "path";
import { readFile, mkdir } from "fs/promises";

import { prettyDuration } from "../lib/script-utils.js";
import { makeCLUEScreenshot } from "../lib/screenshot.js";
import { IProcessFilesStats, processFiles } from "../lib/process-files.js";

// This script saves images of all the documents in a folder and updates its tags.csv with new folder and file names.
// It's intended to be used on the output of count-document-tiles.ts.

// to run this script:
// cf. https://stackoverflow.com/a/66626333/16328462
// Start a local CLUE server
// Then type the following in the terminal
// $ cd scripts/ai
// $ npx tsx screenshot-by-class.ts


const rootPath = "/Users/scytacki/Development/ai/dataset1720819925834-mods/";
const documentPath = fsPath.join(rootPath, "documentInfos");

// Fun the following command in the folder with the documents
// npx http-server --cors
const publicPath = `http://localhost:8081`;

let totalSnapshots = 0;
const targetDir = `screenshots`;
const targetPath = fsPath.join(rootPath, targetDir);

const failedFiles: string[] = [];

console.log(`***** Starting document screenshots *****`);

async function imageFileName(docInfoFileName: string, docInfoPath: string) {
  // Load the docInfo in order to figure out the class, user, and documentType
  const content = await readFile(docInfoPath, "utf8");
  const parsedContent = JSON.parse(content);
  const { classId, userId, documentType, documentId } = parsedContent;

  const imageDir = fsPath.join(targetPath, classId, userId);
  await mkdir(imageDir, {recursive: true});

  const fileName = [userId, documentType, documentId].join("-");
  return fsPath.join(imageDir, `${fileName}.png`);
}

// makeSnapshot loads document content at path in a CLUE standalone document editor, takes a snapshot of it,
// then saves it in the output directory as fileName
const urlRoot = `http://localhost:8080/editor/?appMode=dev&unit=example&document=`;

// Processes a file, usually making a screenshot but updating tags.csv when that file is encountered
async function processFile(docInfoFile: string, path: string) {
  const docFileName = docInfoFile.replace("documentInfo-", "document-");
  const docEditorPath = `${publicPath}/${docFileName}`;
  const screenshotFileName = await imageFileName(docInfoFile, path);
  try {
    await makeCLUEScreenshot({
      url: `${urlRoot}${docEditorPath}`,
      outputFile: screenshotFileName
    });
    totalSnapshots++;
  } catch (error) {
    failedFiles.push(docEditorPath);
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
  fileNamePrefix: "documentInfo-",
  // Uncomment to limit the number of files processed
  // fileLimit: 100
});

console.log(`***** Finished in ${prettyDuration(resultStats.duration)}`);
if (failedFiles.length > 0) {
  console.log(`Failed to get snapshots for the following files:`);
  console.log(failedFiles);
}
