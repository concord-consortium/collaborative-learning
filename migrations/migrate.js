/**
 * Migrate.js
 * 
 * Edit this file to create a new migration which is run by npm run migrate. Once the migration is complete,
 * revert this file to its original form. View the history of the file for examples of past migrations.
 */

const admin = require("firebase-admin");
const Confirm = require('prompt-confirm');
const _ = require("lodash");

/**
 * A service account key is required to gain admin access to the database. To obtain a service account key,
 * log into the Firebase console, navigate to project settings, and then Service Accounts. Click on
 * "Generate new private key" to download a key. Rename the key file to serviceAccountKey.json and move it
 * into this folder (./migrations). It will be imported by the line below.
 * IMPORTANT: Never commit your private key! It should be ignored by .gitignore
 */
const serviceAccount = require("./serviceAccountKey.json");

/**
 * Set this to indicate the top-level key where the migration will be performed. If it is unset, the migration
 * will not be performed. During testing, a demo portion of Firebase e.g. "authed-copy" can be specified. To
 * run the migration on production, this should be set to "authed". This setting will trigger a confirmation
 * from the user when the script is run.
 */
const FIREBASE_ROOT = "authed-copy";

const runMigration = () => {
  console.log("Running migration...");

  const rootRef = admin.database().ref(`/${FIREBASE_ROOT}/`);
  rootRef.once("value").then(snapshot => {
    const root = snapshot.val();
    _.forEach(root.portals, (portal, portalId) => {
      _.forEach(portal.users, (user, userId) => {
        const classHashes = [];
        _.forEach(user.documentMetadata, (metadata) => {
          const classHash = metadata.classHash;
  
          if (classHash && classHashes.indexOf(classHash) === -1) {
            // Update all of the self keys
            _.forEach(user.documentMetadata, (docMetadata) => {
              docMetadata.self.classHash = classHash;
            });
            _.forEach(user.documents, (document) => {
              document.self.classHash = classHash;
            });
            _.forEach(user.learningLogs, (learningLog) => {
              learningLog.self.classHash = classHash;
            });
            const classUserRef = admin.database().ref(`/${FIREBASE_ROOT}/portals/${portalId}/classes/${classHash}/users/${userId}/`);
            classUserRef.set(user);
            classHashes.push(classHash);
          }
        });
  
        if (classHashes.length === 0) {
          const numLostDocs = _.size(user.documentMetadata); 
          console.log(`No class found for User ${userId} with ${numLostDocs} documents.`);
        }
      });
    });
    console.log("Wait for updates to finish before closing...");
  });
}

const setupMigration = () => {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://collaborative-learning-ec215.firebaseio.com"
  });
  
  console.log("Firebase connection initialized");
  
  if (!FIREBASE_ROOT) {
    console.log("No Firebase root given, aborting migration. See migrate.js for more details.");
    process.exit();
  } else if (FIREBASE_ROOT === "authed") {
    new Confirm({
      message: "This migration will update production data! Are you sure you wish to continue?",
      default: false
    }).run()
      .then(answer => {
        if (answer) {
          runMigration();
        } else {
          console.log("Aborting migration");
          process.exit();
        }
      });
  } else {
    runMigration();
  }
}

setupMigration();
