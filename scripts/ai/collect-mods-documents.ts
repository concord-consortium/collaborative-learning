import { mkdir, copyFile, readFile, writeFile } from "fs/promises";
import fsPath from "path";
import stringify from "json-stringify-pretty-compact";

import { processFiles } from "../lib/process-files.js";

// This file was generated from a spreadsheet that included the
// offeringId, classHash, and classId
// A similar file can be created using the offering-json-to-csv.ts
// script.
const modsOfferingsFiles = "mods-offerings.csv";
const modsOfferings = await readFile(modsOfferingsFiles, "utf8");
const offeringRows = modsOfferings.split('\n');
// remove the header
offeringRows.splice(0,1);
const offeringObjects = offeringRows.map(offering => {
  const [offeringId, classHash, classId] = offering.split('\t');
  return { offeringId, classHash, classId};
});

const classHashes = offeringObjects.map(offering => offering.classHash);
const classHashSet = new Set(classHashes);

const datasetFolder = "/Users/scytacki/Development/ai/dataset1720819925834/";
const targetFolder = "/Users/scytacki/Development/ai/dataset1720819925834-mods/";

// Create the target directories
await mkdir(targetFolder);
await mkdir(fsPath.join(targetFolder, "documentInfos"));
await mkdir(fsPath.join(targetFolder, "documents"));

async function processFile(file: string, path: string) {
  const content = await readFile(path, "utf8");
  const parsedContent = JSON.parse(content);

  if (!classHashSet.has(parsedContent.classId)) return;

  if (!parsedContent.documentContent) return;

  const { tileMap } = parsedContent.documentContent;
  if (!tileMap) return;

  let emptyDocument = true;
  const tiles = Object.values<any>(tileMap);
  for (const tile of tiles) {
    if (tile.content.type !== "Placeholder") {
      emptyDocument = false;
      break;
    }
  }
  if (emptyDocument) return;

  await copyFile(path, fsPath.join(targetFolder, "documentInfos", file));

  const documentFile = file.replace("documentInfo-", "document-");
  await writeFile(fsPath.join(targetFolder, "documents", documentFile), stringify(parsedContent.documentContent));
}

const stats = await processFiles({
  sourcePath: datasetFolder,
  processFile,
  fileNamePrefix: "documentInfo"
});

console.log(stats);
