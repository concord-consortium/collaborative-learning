import firebase from "firebase/app";

export function escapeKey(s: string): string {
  return s.replace(/[.$[\]#/]/g, "_");
}

export function firebaseRefPath(ref: firebase.database.Reference) {
  return ref.toString().replace(/^https:\/\/collaborative-learning-.*\.firebaseio\.com/, "");
}
