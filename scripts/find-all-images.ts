#!/usr/bin/node

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// $ node --loader ts-node/esm load-docs-example.ts

import admin from "firebase-admin";
import { getClassKeys } from "./lib/firebase-classes.js";

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

function buildFirebasePath(portal?: string) {
  return portal === "demo"
          ? `/demo/CLUE/portals/demo/classes`
          : `/authed/portals/${portal?.replace(/\./g, "_")}/classes`;
}

const firebaseBasePath = buildFirebasePath("learn.concord.org");

const {classKeys} = await getClassKeys(firebaseBasePath);

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
// const kImageUrlRegex = /(\\"url\\":|\\"target\\":\\"image\\",\\"parents\\":\[)\\"([^\\"]+)\\"/g;

// FIXME: we should type this
const urls = [] as any[];
for (const key of Object.keys(classKeys)) {
  const usersSnapshot = await admin.database().ref(`${firebaseBasePath}/${key}/users`).once("value");
  const users = usersSnapshot.val();
  if (!users) {
    console.log(`no users in class ${key}`);
    continue;
  }

  console.log(key);
  console.log(`  - ${Object.keys(users).length} users`);
  for (const [userId, user] of Object.entries<any>(users)) {
    console.log(`  ${userId}`);
    for (const [docId, doc] of Object.entries<any>(user.documents)) {
      const content = doc.content as string | undefined;
      if (!content) {
        console.log(`    ${docId} - undefined content`);
        break;
      }
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        console.log(`    ${docId} - error parsing content`);
        console.log(`      ${e}`);
        break;
      }
      // As far as I know we haven't changed the format of the document content but this will
      // be a good test.
      console.log(`    ${docId}`);
      const tiles = Object.values<any>(parsedContent.tileMap);
      for (const tile of tiles) {
        const recordUrl = (url: string) => {
          urls.push({url, key, userId, docId, tile: tile.id});
        };

        if (tile.content.type === "Placeholder") {
          continue;
        }
        console.log(`      tile: ${tile.content.type}`);
        if (tile.content.type === "Image") {
          if (tile.content.changes) {
            // Old style Image Tile state
            for (const change of tile.content.changes) {
              const changeObj = JSON.parse(change);
              if (changeObj.url) {
                recordUrl(changeObj.url);
              }
            }
          } else {
            // New Image Tile state
            recordUrl(tile.content.url);
          }
        }
        if (tile.content.type === "Drawing") {
          if (tile.content.changes) {
            // Old style Image Tile state
            // let finalUrl;
            // console.log(`        ${JSON.stringify(tile.content.changes).substring(0,200)}`);
            for (const change of tile.content.changes) {
              const changeObj = JSON.parse(change);
              if (changeObj.data.url) {
                // finalUrl = changeObj.url;
                // console.log(`        ${change.substring(0,300)}`);
                recordUrl(changeObj.data.url);
              }
            }
            // if (finalUrl) {
            //   urls.push(finalUrl);
            // }
          } else {
            for (const dObject of tile.content.objects) {
              if (dObject.url) {
                recordUrl(dObject.url);
                // console.log(`        ${JSON.stringify(dObject).substring(0,300)}`);
              }
            }
          }
        }
        if (tile.content.type === "Geometry") {
          // I think this is still using the change model
          if (tile.content.changes) {
            // Old style state
            // console.log(`        ${JSON.stringify(tile.content.changes).substring(0,300)}`);
            for (const change of tile.content.changes) {
              const changeObj = JSON.parse(change);
              if (changeObj.target === "image") {
                recordUrl(changeObj.parents[0]);
                // console.log(`        ${JSON.stringify(changeObj).substring(0,300)}`);
              }
            }
          } else {
            // New style state
            if (tile.content.bgImage) {
              recordUrl(tile.content.bgImage);
            }
            for (const gObject of Object.values<any>(tile.content.objects)) {
              // There is a possibility of an image type but I
              // could not find any of them
              console.log(`        ${gObject.type}`);
            }
            // console.log(`        ${JSON.stringify(tile.content.objects, undefined, 2).substring(0,1000)}`);
          }
        }
        // console.log(`        ${JSON.stringify(tile.content, undefined, 2)}`);
      }
    }
  }
  // console.log(`  - ${numDocs} docs`);
  // for (const url of urls) {
  //   console.log(`    ${url}`);
  // }
  // Only look at the first class
}
console.log("-------------------------");
console.log(`Total Urls: ${urls.length}`);
for (const url of urls) {
  console.log(`${url.url}, ${url.key}, ${url.userId}, ${url.docId}, ${url.tile}`);
}

// In order to not load everything at the same time we need to get a list of class hashes
// Then we probably want to start by just loading the generic metadata for the documents
// in the class.
// admin.database().ref()

process.exit(0);
