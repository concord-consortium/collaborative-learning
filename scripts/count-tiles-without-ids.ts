#!/usr/bin/node

// to run this script on Node 20
// $ cd scripts
// $ npx tsx count-tiles-without-ids.ts
// I think this will also work on Node 16 and higher.

import fs from "fs";
import path from "path";

// Taken from here:
// https://stackoverflow.com/a/45130990
async function* getFiles(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

let fileCount = 0;
let tileCount = 0;
const unitCount: Record<string, number> = {};

function getUnit(file: string) {
  const result = file.match(/\/curriculum\/([^/]+)\//);
  return result && result[1];
}

function updateUnitCount(file: string) {
  const unit = getUnit(file);
  if (!unit) return;
  if (!unitCount[unit]) {
    unitCount[unit] = 0;
  }
  unitCount[unit]++;
}

(async () => {
  for await (const file of getFiles('../../clue-curriculum/curriculum')) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const fileContent = fs.readFileSync(file, "utf8");
    const fileData = JSON.parse(fileContent);
    if (!fileData.content?.tiles) {
      // This isn't a section file
      continue;
    }
    let hasIdLessTile = false;
    const checkTile = (_tile) => {
      if (!_tile.id) {
        tileCount++;
        hasIdLessTile = true;
      }
    };

    for (const tile of fileData.content.tiles) {
      if (Array.isArray(tile)) {
        for (const subTile of tile) {
          checkTile(subTile);
        }
      } else {
        checkTile(tile);
      }
    }
    if (hasIdLessTile) {
      fileCount++;
      updateUnitCount(file);
      // console.log(file);
    }
  }

  const unitCountEntries = Object.entries(unitCount);
  // find longest unit name
  let longestName = 0;
  for (const entry of unitCountEntries) {
    if (entry[0].length > longestName) {
      longestName = entry[0].length;
    }
  }

  function padRight(value: string) {
    const paddingValue = " ".repeat(longestName);
    return String(value + paddingValue).slice(0, paddingValue.length);
  }

  for (const entry of unitCountEntries) {

    console.log(`${padRight(entry[0])}: ${entry[1]} files`);
  }

  console.log({fileCount, tileCount});
})();
