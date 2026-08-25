import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/firestore";
import "firebase/functions";
import "firebase/storage";

import { urlParams } from "../utilities/url-params";

const validProjects = ["staging", "production"] as const;
export type FirebaseEnv = typeof validProjects[number];

const isFirebaseEnv = (env: unknown): env is FirebaseEnv => {
  return validProjects.includes(env as FirebaseEnv);
};

const keys = {
  production: atob("QUl6YVN5QVV6T2JMblZESURYYTB4ZUxmSVpLV3BiLTJZSWpYSXBJ"),
  staging: atob("QUl6YVN5Q0dKRjQybE15XzhjSFpkU0lQa0FvWE9WWFBHMmotSHAw")
};

/**
 * Everything that has to agree about which Firebase project this session talks to.
 *
 * `config` is the client's connection to the project. `portalFirebaseApp` is the name of the row in
 * the portal's `firebase_apps` table whose service account signs our JWT — the portal signs with that
 * row's credentials and the project in `config` verifies the signature, so the two must name the same
 * project. They are declared together for that reason: held apart, they can drift, and a drifted pair
 * fails at login with nothing to say which half is wrong.
 *
 * A portal that has no row of the given name refuses the request outright ("Unknown firebase app
 * name"), which is the failure worth having — a portal that has a row under the *wrong* name signs a
 * token the project then rejects for reasons that look nothing like the cause.
 */
const environments = {
  production: {
    portalFirebaseApp: "collaborative-learning",
    config: {
      apiKey: keys.production,
      authDomain: "collaborative-learning-ec215.firebaseapp.com",
      databaseURL: "https://collaborative-learning-ec215.firebaseio.com",
      projectId: "collaborative-learning-ec215",
      storageBucket: "collaborative-learning-ec215.appspot.com",
      messagingSenderId: "112537088884",
      appId: "1:112537088884:web:c51b1b8432fff36faff221",
      measurementId: "G-XP472LRY18"
    }
  },
  staging: {
    portalFirebaseApp: "collaborative-learning-staging",
    config: {
      apiKey: keys.staging,
      authDomain: "collaborative-learning-staging.firebaseapp.com",
      databaseURL: "https://collaborative-learning-staging-default-rtdb.firebaseio.com",
      projectId: "collaborative-learning-staging",
      storageBucket: "collaborative-learning-staging.firebasestorage.app",
      messagingSenderId: "822807055414",
      appId: "1:822807055414:web:9e08fe0f4ffaf6130f9c97"
    }
  }
};

function currentEnvironment() {
  const { firebaseEnv } = urlParams;
  return environments[isFirebaseEnv(firebaseEnv) ? firebaseEnv : "production"];
}

export function firebaseConfig() {
  return currentEnvironment().config;
}

/** The portal `firebase_apps` row to request a JWT from. See `environments` above. */
export function portalFirebaseApp() {
  return currentEnvironment().portalFirebaseApp;
}

export const localFunctionsHost = "http://localhost:5001";

export function initializeApp() {
  // check for already being initialized for tests
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig());
  }

  if (urlParams.firebase) {
    // pass `firebase=emulator` to test against firebase emulator instance
    const url = new URL(urlParams.firebase === "emulator"
                          ? "http://localhost:9000" : urlParams.firebase);
    if (url.hostname && url.port) {
      firebase.database().useEmulator(url.hostname, parseInt(url.port, 10));
    }
  }

  if (urlParams.firestore) {
    // pass `firestore=emulator` to test against firestore emulator instance
    const url = new URL(urlParams.firestore === "emulator"
                          ? "http://localhost:8088" : urlParams.firestore);
    if (url.hostname && url.port) {
      firebase.firestore().useEmulator(url.hostname, parseInt(url.port, 10));
    }
  }

  if (urlParams.functions) {
    // pass `functions=emulator` to test against functions running in the emulator
    const url = new URL(urlParams.functions === "emulator"
                          ? localFunctionsHost : urlParams.functions);
    if (url.hostname && url.port) {
      firebase.functions().useEmulator(url.hostname, parseInt(url.port, 10));
    }
  }

  if (urlParams.auth) {
    // pass `auth=emulator` to test against auth running in the emulator
    const url = new URL(urlParams.auth === "emulator"
                          ? "http://localhost:9099" : urlParams.auth);
    if (url.hostname && url.port) {
      // note: unlike the other useEmulator() methods this takes a full url
      firebase.auth().useEmulator(url.toString());
    }
  }
}
