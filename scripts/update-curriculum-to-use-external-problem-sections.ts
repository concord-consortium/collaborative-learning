#!/usr/bin/node

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// $ node --loader ts-node/esm update-curriculum-to-use-external-problem-sections.ts

import fs from "fs";
import stringify from "json-stringify-pretty-compact";

/* 
 * Iterates over unit content and updates any inline problem sections by
 * copying their data to a new external file and replacing the inline
 * data with a reference the external file.
 */
const processProblemSections = (content: any, subdir: string, isTeacherGuide: boolean) => {
  const curriculumCode = content.code;
  let sectionFileCount = 0;
  for (const investigation of content.investigations) {
    const investigationOrdinal = investigation.ordinal;
    for (const problem of investigation.problems) {
      const problemOrdinal = problem.ordinal;
      for (let i = 0; i < problem.sections.length; i++) {
        const section = problem.sections[i];
        const sectionFileName = isTeacherGuide
          ? `${curriculumCode}-tg-investigation-${investigationOrdinal}-problem-${problemOrdinal}-section-${i+1}.json`
          : `${curriculumCode}-investigation-${investigationOrdinal}-problem-${problemOrdinal}-section-${i+1}.json`;
        const sectionFilePath = `${subdir}/${sectionFileName}`;
        if (typeof section !== "string") { // don't update if it's already a reference to an external file
          const sectionData = section;
          fs.writeFileSync(sectionFilePath, stringify(sectionData, {maxLength: 300}));
          sectionFileCount++;
          problem.sections[i] = `${sectionFileName}`;
        }
      }
    }
  }
  console.log(`${sectionFileCount} section files added to ${subdir}`);
  return content;
};

const curriculumDir = "../src/public/curriculum";
const curriculumSubdirs = fs.readdirSync(curriculumDir).filter(name => !name.endsWith(".json"));
// If you're only updating a specific unit, add its directory name to this array (e.g. "bio4community")
const onlyUpdateUnits: string[] = [];

for (const subdirName of curriculumSubdirs) {
  if (onlyUpdateUnits.length === 0 || onlyUpdateUnits.includes(subdirName)) {
    const subdir = `${curriculumDir}/${subdirName}`;
    const files = fs.readdirSync(subdir).filter(name => name.toLowerCase().endsWith(".json"));

    for (const filename of files) {
      const isTeacherGuide = filename.toLowerCase().includes("-teacher-guide");
      const fileContent = fs.readFileSync(`${subdir}/${filename}`, "utf8");
      const fileData = JSON.parse(fileContent);
      // write data to original file
      const updatedFileData = processProblemSections(fileData, subdir, isTeacherGuide);
      fs.writeFileSync(`${subdir}/${filename}`, stringify(updatedFileData, {maxLength: 300}));
    }
  }
}
