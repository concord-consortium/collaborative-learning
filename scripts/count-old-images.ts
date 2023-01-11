#!/usr/bin/node

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// $ node --loader ts-node/esm count-old-images.ts
// It takes about 30s to process all of them

import admin from "firebase-admin";
import {google} from "googleapis";
import fetch from 'node-fetch';

// Load the service account key JSON file.
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

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

// regular expression for identifying image urls in document content
// capture group 1: "url" (Drawing, Image) or "parents" (Geometry)
//                       |--------------------------------------------------|
// capture group 2: image url                                                     |-----|
const kImageUrlRegex = /(\\"url\\":|\\"target\\":\\"image\\",\\"parents\\":\[)\\"([^\\"]+)\\"/g;

let numUrls = 0;
for (const key of Object.keys(classKeys)) {
  const usersSnapshot = await admin.database().ref(`${firebaseBasePath}/${key}/users`).once("value");
  const users = usersSnapshot.val();
  console.log(key);
  console.log(`  - ${Object.keys(users).length} users`);
  let numDocs = 0;
  for (const [userId, user] of Object.entries<any>(users)) {
    console.log(`  ${userId}`);
    numDocs += Object.keys(user.documents).length;
    for (const [docId, doc] of Object.entries<any>(user.documents)) {
      const content = doc.content as string | undefined;
      const imageMatches = content?.matchAll(kImageUrlRegex);
      const urls = [];
      for (const imageMatch of imageMatches || []) {
        const [full, ,] = imageMatch;
        numUrls++;
        urls.push(full);
      }
      if (urls.length > 0) {
        console.log(`    ${docId}`);
        for (const urlMatch of urls) {
          console.log(`      ${urlMatch.substring(0, 200)}`);
        }
      }
    }
  }
  // console.log(`  - ${numDocs} docs`);
  // for (const url of urls) {
  //   console.log(`    ${url}`);
  // }
  // Only look at the first class
}
console.log(`Total Urls: ${numUrls}`);

// In order to not load everything at the same time we need to get a list of class hashes
// Then we probably want to start by just loading the generic metadata for the documents
// in the class.
// admin.database().ref()

process.exit(0);
