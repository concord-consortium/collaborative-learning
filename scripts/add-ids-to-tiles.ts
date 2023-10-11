#!/usr/bin/node

// to run this script on Node 20
// $ cd scripts
// $ npx tsx add-ids-to-tiles.ts
// I think this will also work on Node 16 and higher.

import fs from "fs";
import path from "path";

import stringify from "json-stringify-pretty-compact";
import { nanoid } from "nanoid";

/*
 * typedId()
 *
 * returns a unique id string prepended with a supplied prefix
 * Note: this is copied from js-utils.ts, for some reason that file couldn't be imported
 */
function typedId(type: string, idLength = 12): string {
  // cf. https://zelark.github.io/nano-id-cc/
  return `${type}${nanoid(idLength)}`;
}

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
    const newIds: string[] = [];
    const updateId = (_tile: any) => {
      if (!_tile.id) {
        _tile.id = typedId("TILE");
        newIds.push(`${_tile.id}: ${_tile.content?.type}`);
      }
    };

    for (const tile of fileData.content.tiles) {
      if (Array.isArray(tile)) {
        // This a row of tiles
        for (const subTile of tile) {
          updateId(subTile);
        }
      } else {
        updateId(tile);
      }
    }
    if (newIds.length > 0) {
      // This stringify setting was the same used when the content was migrated to
      // split sections out of the units. Using the same setting reduced the amount
      // of changes
      fs.writeFileSync(file, stringify(fileData, {maxLength: 300}));
      console.log(`updated ${newIds.length} tiles in: ${file}`);
      console.log(`  ids: ${newIds}`);
    }
  }
})();
