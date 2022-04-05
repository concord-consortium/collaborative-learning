import firebase from "firebase";

// The problem with this approach is that it can't be used to clear a logged in
// user's data. So we should check if QA is ever used to store a logged in user's
// data.
export const clearFirebaseAnonQAUser = async () => {
  // FIXME: figure out how to share this with the db
  // check for already being initialized for tests
  if (firebase.apps.length === 0) {
    const key = atob("QUl6YVN5QVV6T2JMblZESURYYTB4ZUxmSVpLV3BiLTJZSWpYSXBJ");
    firebase.initializeApp({
      apiKey: key,
      authDomain: "collaborative-learning-ec215.firebaseapp.com",
      databaseURL: "https://collaborative-learning-ec215.firebaseio.com",
      projectId: "collaborative-learning-ec215",
      storageBucket: "collaborative-learning-ec215.appspot.com",
      messagingSenderId: "112537088884",
      appId: "1:112537088884:web:c51b1b8432fff36faff221",
      measurementId: "G-XP472LRY18"
    });
  }

  let firebaseUser: firebase.User | undefined;

  // FIXME: we might want to call the return value (authStateUnsubscribe) if there is 
  // an error
  firebase.auth().onAuthStateChanged((_firebaseUser) => {
    if (_firebaseUser) {
      firebaseUser = _firebaseUser;
    }
  });

  await firebase.auth().signInAnonymously();

  if (!firebaseUser) {
    throw new Error("Firebase User not set after sign in");
  }

  // FIXME: This path is defined in db.ts we should find a way to share that here 
  // so if the location changes we don't have to update it in 2 places. 
  // Note that the firebaseUser will be picked from the local indexedDb in the browser
  // this indexedDb is persistent across cypress test runs. 
  const qaUser = firebase.database().ref(`/qa/${firebaseUser.uid}`);
  if (qaUser) {
    await qaUser.remove();

    // If we made a firestore connection we should do the following things. So the 
    // firestore connections are cleaned up.
    // await firebase.firestore().terminate();
    // // This will probably blow away the anonymous user id stored in the indexedDb
    // await firebase.firestore().clearPersistence();
  }
};
