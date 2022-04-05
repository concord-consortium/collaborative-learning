import firebase from "firebase";
import { firebaseConfig } from "./firebase-config";

// The problem with this approach is that it can't be used to clear a logged in
// user's data. So we should check if QA is ever used to store a logged in user's
// data.
export const clearFirebaseAnonQAUser = async () => {

  // check for already being initialized for tests
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig());
  }

  let firebaseUser: firebase.User | undefined;

  // We are ignoring the unsubscribe method returned because this function is only
  // used in a one-off way. 
  firebase.auth().onAuthStateChanged((_firebaseUser) => {
    if (_firebaseUser) {
      firebaseUser = _firebaseUser;
    }
  });

  await firebase.auth().signInAnonymously();

  if (!firebaseUser) {
    throw new Error("Firebase User not set after sign in");
  }

  // Notes: 
  // 1. This path is defined in firebase.ts, there isn't an easy way to use the
  //    Firebase class without causing additional Firestore connections So it is
  //    duplicated here.
  // 2. Firebase looks up the user from the browser's indexedDb. In cypress this
  //    is not cleared between test runs. So the same anonymous user will be
  //    used each time.
  const qaUser = firebase.database().ref(`/qa/${firebaseUser.uid}`);
  if (qaUser) {
    await qaUser.remove();
  }
};
