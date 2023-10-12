#!/usr/bin/node

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// ---- outdated ---- $ node --loader ts-node/esm load-docs-example.ts
// $ npx tsx load-docs-example.ts

import admin from "firebase-admin";
import {google} from "googleapis";
import fetch from 'node-fetch';

// Load the service account key JSON file.
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

console.log(`*** Starting Tile Count ***`);

const targetTileType = "Geometry";

console.log(`* Counting ${targetTileType} Tiles *`);

const startTime = Date.now();
let documentsProcessed = 0;
let undefinedDocuments = 0;
let failedDocuments = 0;
const tileCounts = {};

// Define the required scopes.
const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/firebase.database"
];

console.log("Creating Google JWT Client");

// Authenticate a JWT client with the service account.
const jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  undefined,
  serviceAccount.private_key,
  scopes
);

console.log("Generating an access token");

// Use the JWT client to generate an access token.
// this is using a toplevel await which might be a problem
const accessToken = await new Promise<string|undefined>((resolve, reject) => {
  jwtClient.authorize(function(error, tokens) {
    if (error || !tokens) {
      console.log("Error making request to generate access token:", error);
      reject();
    } else if (tokens.access_token === null) {
      console.log("Provided service account does not have permission to generate access tokens");
      reject();
    } else {
      resolve(tokens.access_token);
    }
  });
});

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

function buildFirebasePath(portal?: string) {
  return portal === "demo"
          ? `/demo/CLUE/portals/demo/classes`
          : `/authed/portals/${portal?.replace(/\./g, "_")}/classes`;
}

const firebaseBasePath = buildFirebasePath("learn.concord.org");
const fetchURL = `${databaseURL}${firebaseBasePath}.json?shallow=true`;
console.log(`Fetching URL: ${fetchURL}`);

const response = await fetch(fetchURL,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);
const classKeys  = await response.json() as Record<string, boolean>;

// Fetch the service account key JSON file contents; must be in same folder as script
const credential = admin.credential.cert('./serviceAccountKey.json');
// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential,
  databaseURL
});

for (const key of Object.keys(classKeys)) {
  const usersSnapshot = await admin.database().ref(`${firebaseBasePath}/${key}/users`).once("value");
  const users = usersSnapshot.val();
  // console.log(key);
  // console.log(`  - ${Object.keys(users).length} users`);
  for (const [userId, user] of Object.entries<any>(users)) {
    // console.log(`  ${userId}`);
    for (const [docId, doc] of Object.entries<any>(user.documents)) {
      const content = doc.content as string | undefined;
      if (!content) {
        // console.log(`    ${docId} - undefined content`);
        undefinedDocuments++;
        break;
      }
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        // console.log(`    ${docId} - error parsing content`);
        // console.log(`      ${e}`);
        failedDocuments++;
        break;
      }
      // console.log(`    ${docId}`);
      let tileCount = 0;
      const tiles = Object.values<any>(parsedContent.tileMap);
      for (const tile of tiles) {

        if (tile.content.type === targetTileType) {
          tileCount++;
        }
      }
      if (!tileCounts[tileCount]) {
        tileCounts[tileCount] = 0;
      }
      tileCounts[tileCount] = tileCounts[tileCount] + 1;
      console.log(`  ${tileCount}`);
      documentsProcessed++;
    }
  }
}

const endTime = Date.now();
const duration = endTime - startTime;
const miliseconds = duration % 1000;
const totalSeconds = Math.floor(duration / 1000);
const seconds = totalSeconds % 60;
const totalMinutes = Math.floor(totalSeconds / 60);
const minutes = totalMinutes % 60;
const hours = Math.floor(totalMinutes / 60);
const hourPart = hours > 0 ? `${hours}:` : "";
const minutePart = hourPart || minutes > 0 ? `${minutes}:` : "";
const secondPart = minutePart || seconds > 0 ? `${seconds}:` : "";
console.log(`***** End script *****`);
console.log(`Documents processed: ${documentsProcessed}`);
console.log(`Undefined documents: ${undefinedDocuments}`);
console.log(`Failed to process: ${failedDocuments}`);
console.log(`Total Time: ${hourPart}${minutePart}${secondPart}${miliseconds}`);
console.log(`*** Final counts ***`);
console.log(tileCounts);

process.exit(0);
