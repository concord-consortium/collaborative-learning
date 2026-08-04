#!/usr/bin/node

// Read-only check that every Firestore metadata document is reachable by a get-by-id at
// documents/{escapeKey(key)} — the read CLUE now uses (DocumentMetadataStore.pointReadMetadata)
// instead of a `where key == ...` query. A leftover prefixed doc from before the Sep 2025
// consolidation ("[network]_[key]" or "uid:[user]_[key]") would have been found by the old query
// but is invisible to a get-by-id.
//
// $ cd scripts
// $ npx tsx check-metadata-doc-ids.ts                 # production (learn.concord.org)
// $ npx tsx check-metadata-doc-ids.ts --demo BORIS    # a single demo space
//
// Reads every doc in the collection with a `key` projection: ~99k reads for production, a few
// cents. Writes nothing.

import admin from "firebase-admin";
import { getFirestoreBasePath, getScriptRootFilePath } from "./lib/script-utils.js";

const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

const demoIndex = process.argv.indexOf("--demo");
const demo = demoIndex >= 0 ? process.argv[demoIndex + 1] : undefined;
const portal = "learn.concord.org";

const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
const credential = admin.credential.cert(serviceAccountFile);
const fbApp = admin.initializeApp({ credential, databaseURL });
const firestore = fbApp.firestore();

// Same patterns the consolidation script used, so this classifies documents the same way it did.
const keyPattern = "[a-zA-Z0-9_\\-]{20}";
const unprefixedPattern = new RegExp("^" + keyPattern + "$");
const prefixedPattern = new RegExp("^.+_(" + keyPattern + ")$");

const documentsRoot = getFirestoreBasePath(portal, demo);
const documentsRef = firestore.collection(documentsRoot);

console.log("Checking", documentsRoot);

const counts = { total: 0, reachable: 0, curriculum: 0, prefixed: 0, mismatched: 0 };
// The doc id a prefixed doc's contents would have to live under to stay reachable.
const prefixedKeys: { id: string, key: string }[] = [];
const mismatched: { id: string, key: string }[] = [];

let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
const batchSize = 1000;

// eslint-disable-next-line no-constant-condition
while (true) {
  let query = documentsRef.select("key").limit(batchSize);
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  const snapshot = await query.get();
  if (snapshot.empty) break;

  for (const doc of snapshot.docs) {
    counts.total++;
    const key = doc.data().key;
    if (doc.id.startsWith("curriculum:")) {
      counts.curriculum++;
    } else if (prefixedPattern.test(doc.id)) {
      counts.prefixed++;
      if (prefixedKeys.length < 50) prefixedKeys.push({ id: doc.id, key });
    } else if (unprefixedPattern.test(doc.id) && doc.id === key) {
      counts.reachable++;
    } else {
      counts.mismatched++;
      if (mismatched.length < 50) mismatched.push({ id: doc.id, key });
    }
  }

  lastDoc = snapshot.docs[snapshot.docs.length - 1];
  process.stdout.write(`\r${counts.total} docs scanned`);
  if (snapshot.docs.length < batchSize) break;
}
console.log("");
console.log(counts);

// A leftover prefixed doc only breaks the get-by-id if there is no unprefixed doc for that key.
// If the unprefixed doc exists, the prefixed one is a harmless duplicate the migration left behind.
for (const { id, key } of prefixedKeys) {
  const unprefixed = await documentsRef.doc(key).get();
  console.log(unprefixed.exists
    ? `duplicate (unprefixed doc exists, get-by-id still works): ${id}`
    : `UNREACHABLE (no unprefixed doc for this key): ${id}`);
}
for (const { id, key } of mismatched) {
  console.log(`unexpected id: '${id}' with key field '${key}'`);
}

if (counts.prefixed > prefixedKeys.length || counts.mismatched > mismatched.length) {
  console.log("(listing truncated at 50 each)");
}
