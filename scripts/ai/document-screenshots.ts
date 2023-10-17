import fs from "fs";
import readline from "readline";
import puppeteer from "puppeteer";

import { prettyDuration } from "./script-utils";

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

// Make falsy to include all documents
const documentLimit = 30;

const publicRoot = "ai";
const rootPath = `../../src/public/${publicRoot}`;
const documentPath = `${rootPath}/${documentDirectory}`;
const publicPath = `${publicRoot}/${documentDirectory}`;
const tagFileName = "tags.csv";

const DEFAULT_WIDTH = 1920;

const startTime = Date.now();
let totalSnapshots = 0;
let totalSnapshotTime = 0;
const targetDir = `screenshotDataset${startTime}`;
const targetPath = `${rootPath}/${targetDir}`;

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
const urlRoot = `http://localhost:8080/doc-editor.html?appMode=dev&unit=example&document=`;
async function makeSnapshot(path: string, fileName: string) {
  const snapshotStartTime = Date.now();
  const targetFile = `${targetPath}/${fileName}`;

  // View the document in the document editor
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const url = `${urlRoot}${path}`;
  await page.goto(url, {
    timeout: 30000, // 30 seconds
    waitUntil: 'networkidle0'
  });

  // Approximate the height of the document by adding up the heights of the rows and make the viewport that tall
  let pageHeight = 30;
  const rowElements = await page.$$(".tile-row");
  for (const rowElement of rowElements) {
    const boundingBox = await rowElement.boundingBox();
    pageHeight += boundingBox?.height ?? 0;
  }
  await page.setViewport({ width: DEFAULT_WIDTH, height: Math.round(pageHeight) });

  // Take a screenshot and save it to a file
  const buffer = await page.screenshot({ fullPage: true, type: 'png' });
  await page.close();
  await browser.close();
  fs.writeFileSync(targetFile, buffer);

  const snapshotEndTime = Date.now();
  const snapshotDuration = snapshotEndTime - snapshotStartTime;
  totalSnapshots++;
  totalSnapshotTime += snapshotDuration;
  console.log(`*** Snapshot ${totalSnapshots} finished in`, prettyDuration(snapshotDuration));
  console.log(`*   All snapshot time`, prettyDuration(totalSnapshotTime));
}

// Process every file in the source directory
fs.readdir(documentPath, async (error, files) => {
  // It would probably be better to run this in parallel, but I was having trouble with that so just made it sequential
  for (const file of files) {
    if (documentLimit && totalSnapshots >= documentLimit) break;

    const path = `${documentPath}/${file}`;
    if (file.startsWith("document")) {
      // For documents named like documentXXX.txt, make a snapshot and save it
      const docEditorPath = `${publicPath}/${file}`;
      const screenshotFileName = newFileName(file);
      await makeSnapshot(docEditorPath, screenshotFileName);
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
});
