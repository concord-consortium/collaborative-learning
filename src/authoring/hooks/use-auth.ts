import { useState, useEffect } from "react";
import firebase from "firebase/app";
import "firebase/auth";

import { initializeApp } from "../../lib/firebase-config";

export interface Auth {
  user: firebase.User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
}

function useAuth(): Auth {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    initializeApp();

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

  const signIn = async (email: string, password: string) => {
    reset();
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
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
    setLoading(true);
    setError(null);
    setResetCount((count) => count + 1);
  };

  return { user, loading, error, signIn, signOut,reset };
}

export default useAuth;
