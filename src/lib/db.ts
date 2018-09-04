import * as firebase from "firebase";
import { AppMode } from "../models/stores";
import { UserModelType } from "../models/user";

export type IDBConnectOptions = IDBAuthConnectOptions | IDBNonAuthConnectOptions;
export interface IDBAuthConnectOptions {
  appMode: "authed";
  rawFirebaseToken: string;
}
export interface IDBNonAuthConnectOptions {
  appMode: "dev" | "test";
}

export class DB {
  private appMode: AppMode;
  private firebaseUser: firebase.User | null = null;

  public get isConnected() {
    return this.firebaseUser !== null;
  }

  public connect(options: IDBConnectOptions) {
    return new Promise<boolean>((resolve, reject) => {
      if (this.isConnected) {
        reject("Already connected to database!");
      }

      // check for already being initialized for tests
      if (firebase.apps.length === 0) {
        firebase.initializeApp({
          apiKey: "AIzaSyBKwTfDSxKRSTnOaAzI-mUBN78LiI2gM78",
          authDomain: "collaborative-learning-ec215.firebaseapp.com",
          databaseURL: "https://collaborative-learning-ec215.firebaseio.com",
          projectId: "collaborative-learning-ec215",
          storageBucket: "collaborative-learning-ec215.appspot.com",
          messagingSenderId: "112537088884"
        });
      }

      if (options.appMode === "authed") {
        firebase.auth()
          .signInWithCustomToken(options.rawFirebaseToken)
          .catch(reject);
      }
      else {
        firebase.auth()
          .signInAnonymously()
          .catch(reject);
      }

      firebase.auth().onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
          this.appMode = options.appMode;
          this.firebaseUser = firebaseUser;
          resolve(true);
        }
      });
    });
  }

  public disconnect() {
    if (this.appMode === "test") {
      // delete all test data (for this unique anonymous test user)
      return this.ref().set(null);
    }
  }

  public ref(path: string = ""): firebase.database.Reference {
    if (!this.isConnected) {
      throw new Error("ref() requested before db connected!");
    }
    return firebase.database().ref(this.getFullPath(path));
  }

  public getFullPath(path: string = "") {
    return `${this.getRootFolder()}${path}`;
  }

  public getRootFolder() {
    const { appMode } = this;
    const userSubFolder = appMode === "authed" ? "" : `${this.firebaseUser ? this.firebaseUser.uid : "no-user-id"}/`;
    return `/${appMode}/${userSubFolder}`;
  }

  public getUserGroupRef(user: UserModelType): firebase.database.Reference {
    return this.ref(`users/${user.id}/group`);
  }
}
