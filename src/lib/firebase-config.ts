import firebase from "firebase/app";

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

const configs = {
  production: {
    apiKey: keys.production,
    authDomain: "collaborative-learning-ec215.firebaseapp.com",
    databaseURL: "https://collaborative-learning-ec215.firebaseio.com",
    projectId: "collaborative-learning-ec215",
    storageBucket: "collaborative-learning-ec215.appspot.com",
    messagingSenderId: "112537088884",
    appId: "1:112537088884:web:c51b1b8432fff36faff221",
    measurementId: "G-XP472LRY18"
  },
  staging: {
    apiKey: keys.staging,
    authDomain: "collaborative-learning-staging.firebaseapp.com",
    databaseURL: "https://collaborative-learning-staging-default-rtdb.firebaseio.com",
    projectId: "collaborative-learning-staging",
    storageBucket: "collaborative-learning-staging.firebasestorage.app",
    messagingSenderId: "822807055414",
    appId: "1:822807055414:web:9e08fe0f4ffaf6130f9c97"
  }
};

export function firebaseConfig() {
  let { firebaseEnv } = urlParams;

  if (!isFirebaseEnv(firebaseEnv)) {
    firebaseEnv = "production";
  }

  return configs[firebaseEnv];
}

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
                          ? "http://localhost:5001" : urlParams.functions);
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
