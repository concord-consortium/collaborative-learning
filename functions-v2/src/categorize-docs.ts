#!/usr/bin/env ts-node

// Sends each document in a folder to the AI service for categorization.
// The results are written to a CSV file.
//
// Usage:
//   ts-node categorize-docs.ts source-directory  > output-file.csv


import fs from "fs";
import process from "node:process";
import categorizeDocument from "../lib/src/ai-categorize-document";

// Read directory name from the command-line argument
const sourceDirectory = process.argv[2];

// Check if the source directory is provided
if (!sourceDirectory) {
  console.error("Error: No source directory provided.");
  process.exit(1);
}

// Process every file in the source directory
fs.readdir(sourceDirectory, async (_error, files) => {
  // quit if there's an error
  if (_error) {
    console.error(_error);
    return;
  }
  console.log("File,Category,Key Indicators,Discussion,Prompt Tokens,Completion Tokens");
  for (const file of files) {
    const fullFile = `${sourceDirectory}/${file}`;
    const response = await categorizeDocument(fullFile);
    const parsed = response?.choices[0].message.parsed;
    if (parsed) {
      // Output to standard output in CSV format
      // eslint-disable-next-line max-len
      console.log(`"${file}","${parsed.category}","${parsed.keyIndicators}","${parsed.discussion}",${response?.usage?.prompt_tokens},${response?.usage?.completion_tokens}`);
    } else {
      console.log(`"${file}","unknown","[]",,${response?.usage?.prompt_tokens},${response?.usage?.completion_tokens}`);
    }
  }
});
