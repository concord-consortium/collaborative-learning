import firebase from "firebase/app";

// https://medium.com/swlh/using-firestore-with-typescript-65bd2a602945
export const typeConverter = <T extends firebase.firestore.DocumentData>():
  firebase.firestore.FirestoreDataConverter<T> =>
({
  toFirestore: (data: T) => data,
  fromFirestore: (doc: firebase.firestore.QueryDocumentSnapshot) => doc.data() as T
});
