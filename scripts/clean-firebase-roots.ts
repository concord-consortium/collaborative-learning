#!/usr/bin/node

// This script cleans the roots out of the QA or Dev sections of
// the Firebase Realtime database and Firestore.

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// $ npx tsx clean-firebase-roots.ts

import admin from "firebase-admin";
import { deleteApp } from "firebase-admin/app";
import {cleanFirebaseRoots} from "../shared/clean-firebase-roots.js";
import { getScriptRootFilePath } from "./lib/script-utils.js";

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
const credential = admin.credential.cert(serviceAccountFile);
// Initialize the app with a service account, granting admin privileges
const fbApp = admin.initializeApp({
  credential,
  databaseURL
});

await cleanFirebaseRoots({
  appMode: "qa",
  hoursAgo: 90.7,
  logger: console,
  dryRun: true
});

await deleteApp(fbApp);
