import * as firebase from "firebase";
import { AppMode, IStores } from "../models/stores";
import { UserModelType } from "../models/user";
import { onSnapshot } from "mobx-state-tree";
import { IDisposer } from "mobx-state-tree/dist/utils";
import { observable, action } from "mobx";

export type IDBConnectOptions = IDBAuthConnectOptions | IDBNonAuthConnectOptions;
export interface IDBAuthConnectOptions {
  appMode: "authed";
  rawFirebaseJWT: string;
  stores: IStores;
}
export interface IDBNonAuthConnectOptions {
  appMode: "dev" | "test";
  stores: IStores;
}

export class DB {
  @observable public isListening = false;
  private appMode: AppMode;
  private firebaseUser: firebase.User | null = null;
  private stores: IStores;
  private groupRef: firebase.database.Reference | null = null;
  private groupSnapshotDisposer: IDisposer | null = null;

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

      this.stores = options.stores;

      if (options.appMode === "authed") {
        firebase.auth()
          .signInWithCustomToken(options.rawFirebaseJWT)
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
          this.stopListeners();
          this.startListeners().then(() => resolve(true)).catch(reject);
        }
      });
    });
  }

  public disconnect() {
    this.stopListeners();

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

  private startListeners() {
    return new Promise<void>((resolve, reject) => {
      this.startGroupListener()
        .then(() => {
          this.isListening = true;
          resolve();
        })
        .catch(reject);
    });
  }

  private stopListeners() {
    this.stopGroupListener();
    this.isListening = false;
  }

  private startGroupListener() {
    return new Promise<void>((resolve, reject) => {
      const {user, ui} = this.stores;
      const groupRef = this.groupRef = this.getUserGroupRef(user);

      // use once() so we can get a promise
      groupRef.once("value")
        .then((snapshot) => {
          this.handleGroupRef(snapshot);
          groupRef.on("value", this.handleGroupRef);

          this.groupSnapshotDisposer = onSnapshot(user, (newUser) => {
            if (this.groupRef) {
              this.groupRef.set(newUser.group).catch((error) => {
                ui.setError(error);
              });
            }
          });

          resolve();
        })
        .catch(reject);
    });
  }

  private stopGroupListener() {
    if (this.groupRef) {
      this.groupRef.off("value", this.handleGroupRef);
      this.groupRef = null;
    }
    if (this.groupSnapshotDisposer) {
      this.groupSnapshotDisposer();
      this.groupSnapshotDisposer = null;
    }
  }

  private handleGroupRef = (snapshot: firebase.database.DataSnapshot) => {
    this.stores.user.setGroup(snapshot.val());
  }
}
