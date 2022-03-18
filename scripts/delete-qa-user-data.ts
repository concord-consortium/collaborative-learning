#!/usr/bin/node

// to run this script type the following in the terminal
// cf. https://stackoverflow.com/a/66626333/16328462
// $ cd scripts
// $ node --loader ts-node/esm delete-qa-user-data.ts

import admin from "firebase-admin";

const credential = admin.credential.cert('../serviceAccountKey.json');
admin.initializeApp({
  credential,
  databaseURL: 'https://collaborative-learning-ec215.firebaseio.com'
});

admin.database().ref("qa").remove()
                          .then(() => {console.log("Remove succeeded.");
                                       process.exit(0);
                                      })
                          .catch(error => {console.log("Remove failed: " + error.message);
                                           process.exit(1);
                                          });
