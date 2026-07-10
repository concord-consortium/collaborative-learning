#!/usr/bin/node

// Deletes an entire demo space from BOTH the Realtime Database and Firestore.
//
// A demo space lives under a single root in each store:
//   RTDB:      /demo/<demoName>
//   Firestore: demo/<demoName>   (a document whose subcollections hold all the data)
//
// The Realtime Database root is deleted first. If that fails partway, the
// Firestore data still identifies the space so the script can be re-run.
//
// Usage (from the scripts folder):
//   npx tsx delete-demo-space.ts <demoName> [--dry-run]
//
// Examples:
//   npx tsx delete-demo-space.ts CLUE --dry-run   # report what would be deleted
//   npx tsx delete-demo-space.ts CLUE             # actually delete it

import { readFileSync } from "fs";
import { google } from "googleapis";
import admin from "firebase-admin";
import { deleteApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { getScriptRootFilePath, prettyDuration } from "./lib/script-utils.js";

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

const demoName = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!demoName || demoName.startsWith("--")) {
  console.error("Usage: npx tsx delete-demo-space.ts <demoName> [--dry-run]");
  process.exit(1);
}

const startTime = Date.now();
function log(...args: any[]) {
  console.log(`[+${prettyDuration(Date.now() - startTime)}]`, ...args);
}

// Generate one OAuth access token we can reuse for the REST "shallow" reads.
// The Admin SDK has no shallow read, and a normal read of a demo root would
// download the entire space, so we list keys via the REST api instead.
async function getAccessToken() {
  const serviceAccount = JSON.parse(
    readFileSync(getScriptRootFilePath("serviceAccountKey.json"), "utf8")
  );
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    undefined,
    serviceAccount.private_key,
    [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/firebase.database"
    ]
  );
  const tokens = await jwtClient.authorize();
  if (!tokens.access_token) throw new Error("Failed to obtain an access token");
  return tokens.access_token;
}

// Return the immediate child keys of an RTDB path without downloading the data.
async function shallowChildKeys(accessToken: string, path: string): Promise<string[]> {
  const response = await fetch(`${databaseURL}${path}.json?shallow=true`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error(`Shallow read of ${path} failed: ${response.status} ${response.statusText}`);
  }
  const keys = await response.json() as Record<string, boolean> | null;
  return keys ? Object.keys(keys) : [];
}

async function deleteRealtimeDatabase(db: admin.database.Database) {
  const rootPath = `/demo/${demoName}`;
  log(`RTDB: examining ${rootPath} ...`);

  const accessToken = await getAccessToken();

  // Most of the data hangs off the per-class nodes, so delete class-by-class to
  // get incremental progress rather than one opaque, long-running remove().
  const portals = await shallowChildKeys(accessToken, `${rootPath}/portals`);
  log(`RTDB: found ${portals.length} portal(s): ${portals.join(", ") || "(none)"}`);

  for (const portal of portals) {
    const classesPath = `${rootPath}/portals/${portal}/classes`;
    const classHashes = await shallowChildKeys(accessToken, classesPath);
    log(`RTDB: portal "${portal}" has ${classHashes.length} class(es)`);

    let done = 0;
    for (const classHash of classHashes) {
      if (!dryRun) await db.ref(`${classesPath}/${classHash}`).remove();
      done++;
      // Log every class for small spaces, and every 10 once it gets large.
      if (done <= 10 || done % 10 === 0 || done === classHashes.length) {
        log(`RTDB: ${dryRun ? "would delete" : "deleted"} class ${done}/${classHashes.length}`);
      }
    }
  }

  // Remove the whole root to catch anything outside the class nodes (offerings,
  // user records, stray keys) and the now-empty portal structure.
  log(`RTDB: ${dryRun ? "would remove" : "removing"} remaining data at ${rootPath} ...`);
  if (!dryRun) await db.ref(rootPath).remove();
  log(`RTDB: done.`);
}

async function deleteFirestore(firestore: admin.firestore.Firestore) {
  const docPath = `demo/${demoName}`;
  const docRef = firestore.doc(docPath);
  log(`Firestore: examining ${docPath} ...`);

  // Preflight: list the top-level subcollections so we can see the space isn't
  // empty and confirm we're pointed at the expected data. (This firestore
  // version has no count() aggregation, so we don't total the documents up
  // front; the delete heartbeat below reports running progress instead.)
  const subcollections = await docRef.listCollections();
  if (subcollections.length === 0) {
    log(`Firestore: no subcollections under ${docPath}; nothing to delete.`);
    return;
  }
  log(`Firestore: subcollections to delete: ${subcollections.map(s => s.id).join(", ")}`);

  if (dryRun) {
    log(`Firestore: dry run, skipping recursiveDelete of ${docPath}.`);
    return;
  }

  // recursiveDelete walks the whole subtree. Feed it our own BulkWriter so we
  // can count completed deletes and emit a heartbeat: if the count keeps rising
  // the job is progressing; if the heartbeat prints but the count is frozen it
  // has stalled; if the heartbeat stops, the process died.
  let deleted = 0;
  let failed = 0;
  const bulkWriter = firestore.bulkWriter();
  bulkWriter.onWriteResult(() => { deleted++; });
  bulkWriter.onWriteError((error) => {
    if (error.failedAttempts < 5) return true; // let BulkWriter retry
    failed++;
    console.error(`Firestore: giving up on ${error.documentRef.path}: ${error.message}`);
    return false;
  });

  const heartbeat = setInterval(() => {
    log(`Firestore: deleting ... ${deleted} docs removed so far` + (failed ? `, ${failed} failed` : ""));
  }, 5000);

  log(`Firestore: recursively deleting ${docPath} ...`);
  try {
    await firestore.recursiveDelete(docRef, bulkWriter);
    await bulkWriter.close();
  } finally {
    clearInterval(heartbeat);
  }
  log(`Firestore: done. ${deleted} docs removed` + (failed ? `, ${failed} failed` : "") + ".");
}

async function main() {
  log(`Deleting demo space "${demoName}"${dryRun ? " (DRY RUN)" : ""}`);

  const credential = admin.credential.cert(getScriptRootFilePath("serviceAccountKey.json"));
  const fbApp = admin.initializeApp({ credential, databaseURL });

  try {
    // RTDB first: if it fails, the Firestore record remains so we can re-run.
    await deleteRealtimeDatabase(getDatabase());
    await deleteFirestore(getFirestore());
    log(`All done${dryRun ? " (DRY RUN — nothing was actually deleted)" : ""}.`);
  } finally {
    await deleteApp(fbApp);
  }
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
