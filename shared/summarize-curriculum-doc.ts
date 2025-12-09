#!/usr/bin/node

// to run this script on Node 20
// $ cd shared
// $ npx tsx summarize-curriculum-doc.ts

// This script is in the shared directory because it isn't easy
// for the scripts folder to import the the shared code. They have
// different package.json and tsconfig.json files. This causes
// module resolution

import fs from "fs";
import path from "path";
import { summarizeCurriculum } from "./ai-summarizer";

// Allow passing a file path as a CLI argument.
const argPath = process.argv[2];
const resolvedFile = path.resolve(argPath);

if (!fs.existsSync(resolvedFile)) {
  console.error(`Error: File not found: ${resolvedFile}`);
  console.error("Usage: npx tsx summarize-curriculum-doc.ts <path-to-content.json>");
  process.exit(1);
}

const fileContent = fs.readFileSync(resolvedFile, "utf8");
const fileData = JSON.parse(fileContent);

console.log(`*** Summarizing Curriculum Document: ${resolvedFile} ***`);
console.log(summarizeCurriculum(fileData.content));
