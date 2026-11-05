import firebase from "firebase/app";

// https://medium.com/swlh/using-firestore-with-typescript-65bd2a602945
export const typeConverter = <T extends firebase.firestore.DocumentData>():
  firebase.firestore.FirestoreDataConverter<T> =>
({
  toFirestore: (data: T) => data,
  fromFirestore: (doc: firebase.firestore.QueryDocumentSnapshot) => doc.data() as T
});

// Firebase aborts a transaction outright when a set() lands on an overlapping path while the
// transaction is in flight, and reports it as an error whose message is exactly "set".
const kSetAbortMessage = "set";

const kDefaultRetries = 3;

/**
 * Runs a Firebase transaction, retrying if it is aborted by a concurrent `set()`.
 *
 * Re-running is safe for an update that reads the current value and applies a change to it: the
 * retry sees whatever the `set()` wrote and works from there. Any other failure is thrown straight
 * away rather than retried.
 */
export async function retryAbortedTransaction(
  runTransaction: () => Promise<unknown>, retries = kDefaultRetries
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await runTransaction();
      return;
    } catch (error) {
      const abortedBySet = error instanceof Error && error.message === kSetAbortMessage;
      if (!abortedBySet || attempt >= retries) throw error;
    }
  }
}
