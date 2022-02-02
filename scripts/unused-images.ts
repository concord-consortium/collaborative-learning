#!/usr/bin/node

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// $ node --loader ts-node/esm unused-images.ts

import enquirer from "enquirer";
import escapeStringRegexp from "escape-string-regexp";
import fs from "fs";

const curriculumDir = "../src/public/curriculum/stretching-and-shrinking";
const kDryRun = true;

const curriculumFilenames = fs.readdirSync(curriculumDir).filter(name => name.toLowerCase().endsWith(".json"));
const curriculumFiles = curriculumFilenames.map(name => fs.readFileSync(`${curriculumDir}/${name}`, "utf8"));
const unusedFilenames = fs.readdirSync(`${curriculumDir}/images`).filter(name => {
  const regex = new RegExp(escapeStringRegexp(name), "i");
  return !curriculumFiles.some(content => regex.test(content));
});

enquirer.prompt<{ confirm: boolean }>({
  type: "confirm",
  name: "confirm",
  message: `Delete ${unusedFilenames.length} unused files?`
}).then(response => {
  if (response.confirm) {
    unusedFilenames.forEach(name => {
      const imageFilePath = `${curriculumDir}/images/${name}`;
      if (kDryRun) {
        console.log(`"${imageFilePath}" is unused`);
      }
      else {
        fs.rm(imageFilePath, () => null);
      }
    });
  }
});
