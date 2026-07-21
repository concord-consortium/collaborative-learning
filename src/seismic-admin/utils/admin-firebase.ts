import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import { initializeApp } from "../../lib/firebase-config";

/**
 * Initialize Firebase and sign in anonymously. Resolves when auth is ready.
 */
export async function initAdminFirebase(): Promise<void> {
  initializeApp();
  const auth = firebase.auth();
  if (!auth.currentUser) {
    await auth.signInAnonymously();
  }
}
