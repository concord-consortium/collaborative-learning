const admin = require("firebase-admin");
var _ = require("lodash");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://collaborative-learning-ec215.firebaseio.com"
});

const authedRef = admin.database().ref("/authed-copy/");
authedRef.once("value").then(snapshot => {
  const root = snapshot.val();
  _.forEach(root.portals, (portal, portalId) => {
    _.forEach(portal.users, (user, userId) => {
      const classHashes = [];
      _.forEach(user.documentMetadata, (metadata) => {
        const classHash = metadata.classHash;

        if (classHash && classHashes.indexOf(classHash) === -1) {
          const classUserRef = admin.database().ref(`/authed-copy/portals/${portalId}/classes/${classHash}/users/${userId}/`);
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