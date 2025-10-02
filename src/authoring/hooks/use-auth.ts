import { useState, useEffect, useRef } from "react";
import firebase from "firebase/app";
import "firebase/auth";

import { initializeApp } from "../../lib/firebase-config";

export interface Auth {
  user: firebase.User | null;
  loading: boolean;
  error: string | null;
  firebaseToken: string | null;
  gitHubToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
}

// used during development to bypass GitHub auth - this is not a security risk
// since the auth api checks the GitHub token on every request unless the
// DANGEROUSLY_SKIP_AUTH_TOKEN_VALIDATION environment variable is set on the server
// which is only in dev mode using the emulator, and never in production
const fakeAuth = (new URLSearchParams(window.location.search)).get("fakeAuthoringAuth") === "true";
const fakeAuthUser = {
  uid: "fakeUid",
  displayName: "Fake User",
  email: "fakeuser@example.com",
} as unknown as firebase.User;
const fakeFirebaseToken = "fakeFirebaseToken";
const fakeGitHubToken = "fakeGitHubToken";

function useAuth(): Auth {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [gitHubToken, setGitHubToken] = useState<string | null>(null);
  const reAuthTimeoutRef = useRef<number | null>(null);

  const signInFakeUser = () => {
    return firebase.auth().signInAnonymously().then(() => {
      setUser(fakeAuthUser);
      setFirebaseToken(fakeFirebaseToken);
      setGitHubToken(fakeGitHubToken);
      setLoading(false);
    }).catch((err) => {
      setError(err.message ?? "An error occurred during fake sign-in.");
      console.error("Fake sign-in error:", err);
    });
  };

  useEffect(() => {
    if (resetCount === 0) {
      initializeApp();
    }

    if (fakeAuth) {
      // automatically sign in a fake user to avoid having to click the sign-in button
      // on each reload during development
      if (resetCount === 0) {
        signInFakeUser();
      }
      return;
    }

    // do not persist auth state between sessions as we need to get the GitHub token
    // and that is only available after the sign-in completes
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);

    const unsubscribe = firebase.auth().onAuthStateChanged((authUser) => {
      // do not allow anonymous users (which happens when running the main CLUE app directly before signing in here)
      if (authUser?.isAnonymous) {
        firebase.auth().signOut();
        setUser(null);
      } else {
        setUser(authUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [resetCount]);

  useEffect(() => {
    window.clearTimeout(reAuthTimeoutRef.current ?? undefined);

    if (user) {
      // re-authenticate every 7.5 hours (GitHub OAuth tokens last for 8 hours)
      // and we need a valid GitHub token to make API calls
      const reAuthTimeoutMs = 7.5 * 60 * 60 * 1000;
      reAuthTimeoutRef.current = window.setTimeout(() => {
        alert("For security reasons, please sign in again to continue using the authoring tool.");

        // to ensure everything is reset properly, just do a full reload
        window.location.reload();
      }, reAuthTimeoutMs);
    }
  }, [user]);

  const signIn = async () => {
    reset();

    if (fakeAuth) {
      await signInFakeUser();
      return;
    }

    try {
      const provider = new firebase.auth.GithubAuthProvider();
      provider.addScope("public_repo");
      const result = await firebase.auth().signInWithPopup(provider);
      if (result.credential) {
        const credential = result.credential as firebase.auth.OAuthCredential;
        setGitHubToken(credential.accessToken ?? null);
      }
      if (result.user) {
        const token = await result.user.getIdToken();
        setFirebaseToken(token);
      }
    } catch (err: any) {
      setError(err.message ?? "An error occurred during sign-in.");
      console.error("Sign-in error:", err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    reset();

    try {
      await firebase.auth().signOut();
    } catch (err: any) {
      setError(err.message ?? "An error occurred during sign-out.");
      console.error("Sign-out error:", err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUser(null);
    setFirebaseToken(null);
    setGitHubToken(null);
    setError(null);
    setLoading(true);
    setResetCount((count) => count + 1);
  };

  return { user, firebaseToken, gitHubToken, loading, error, signIn, signOut, reset };
}

export default useAuth;
