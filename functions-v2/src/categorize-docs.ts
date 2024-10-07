#!/usr/bin/env ts-node

// Sends each document in a folder to the AI service for categorization.
// The results are written to a CSV file.
//
// Before running, set the OPENAI_API_KEY environment variable to a valid value.
// The existing CLUE key is stored in 1Password.
// For separate tracking, a new API key can also be created at https://platform.openai.com/account/api-keys .
//
// Usage:
//   ts-node categorize-docs.ts source-directory  > output-file.csv

import fs from "fs";
import process from "node:process";
import {categorizeDocument} from "../lib/src/ai-categorize-document";

// API key
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Error: No OpenAI API key provided.");
  process.exit(1);
}

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
    const response = await categorizeDocument(fullFile, apiKey);
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
