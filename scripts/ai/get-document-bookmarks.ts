#!/usr/bin/node

// This script gets bookmark info for each document

// Possible References:
// src/lib/db-listeners/db-bookmarks-listener.ts, src/lib/firebase.ts,
// src/models/stores/bookmarks.ts, src/models/stores/stores.ts

import fs from "fs";
import admin from "firebase-admin";

import { DocumentInfo } from "./script-types";
import { datasetPath, networkFileName } from "./script-constants";

const sourceDirectory = "";
const queryLimit = 10;
const startTime = Date.now();
const documentInfo: Record<string, DocumentInfo> = {};

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

// Fetch the service account key JSON file contents; must be in same folder as script
const credential = admin.credential.cert('./serviceAccountKey.json');
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

const credentialTime = Date.now();

const sourcePath = `${datasetPath}${sourceDirectory}`;

// Get network info from portal file. This should have been created by download-documents.ts.
function getNetworkInfo() {
  const networkFile = `${sourcePath}/${networkFileName}`;
  if (fs.existsSync(networkFile)) {
    return JSON.parse(fs.readFileSync(networkFile, "utf8"));
  }
}
const { portal, demo } = getNetworkInfo() ?? { portal: "learn.concord.org" };

// in src/lib/firebase.ts:
// public getUserDocumentStarsPath(user: UserModelType, documentKey?: string, starKey?: string) {
//   const docSuffix = documentKey ? `/${documentKey}` : "";
//   const starSuffix = starKey ? `/${starKey}` : "";
//   return `${this.getOfferingPath(user)}/commentaries/stars${docSuffix}${starSuffix}`;
// }
