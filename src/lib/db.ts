import * as firebase from "firebase";
import { AppMode, IStores } from "../models/stores";
import { UserModelType } from "../models/user";
import { onSnapshot } from "mobx-state-tree";
import { IDisposer } from "mobx-state-tree/dist/utils";
import { observable, action } from "mobx";
import { DBOfferingGroup, DBOfferingGroupUser, DBOfferingGroupMap } from "./db-types";

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
export interface UserGroupMap {
  [key: string]: {
    group: number,
    initials: string
  };
}
export interface GroupUsersMap {
  [key: string]: string[];
}

export class DB {
  @observable public isListening = false;
  @observable public groups: GroupUsersMap = {};
  private appMode: AppMode;
  private firebaseUser: firebase.User | null = null;
  private stores: IStores;
  private latestGroupIdRef: firebase.database.Reference | null = null;
  private groupsRef: firebase.database.Reference | null = null;
  private groupOnDisconnect: firebase.database.OnDisconnect | null = null;
  private connectedRef: firebase.database.Reference | null = null;

  public get isConnected() {
    return this.firebaseUser !== null;
  }

  public connect(options: IDBConnectOptions) {
    return new Promise<void>((resolve, reject) => {
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
          this.startListeners().then(resolve).catch(reject);
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

  public joinGroup(groupId: string) {
    const {user} = this.stores;
    const groupRef = this.ref(this.getGroupPath(user, groupId));
    let userRef: firebase.database.Reference;

    return new Promise<void>((resolve, reject) => {
      groupRef.once("value")
        .then((snapshot) => {
          // if the group doesn't exist create it
          if (!snapshot.val()) {
            return groupRef.set({
              version: "1.0",
              self: {
                classHash: user.classHash,
                offeringId: user.offeringId,
                groupId,
              },
              users: {},
            } as DBOfferingGroup);
          }
        })
        .then(() => {
          // always add the user to the group, the listeners will sort out if the group is oversubscribed
          userRef = groupRef.child("users").child(user.id);
          return userRef.set({
            version: "1.0",
            self: {
              classHash: user.classHash,
              offeringId: user.offeringId,
              groupId,
              uid: user.id
            },
            connectedTimestamp: firebase.database.ServerValue.TIMESTAMP
          } as DBOfferingGroupUser);
        })
        .then(() => {
          this.setConnectionHandlers(userRef);
        })
        .then(() => {
          // remember the last group joined
          return this.getLatestGroupIdRef().set(groupId);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public leaveGroup() {
    const {user} = this.stores;
    const groupsRef = this.ref(this.getGroupsPath(user));

    if (this.groupOnDisconnect) {
      this.groupOnDisconnect.cancel();
    }
    this.groupOnDisconnect = null;

    return new Promise<void>((resolve, reject) => {
      groupsRef.once("value")
        .then((snapshot) => {
          // find all groups where the user is a member, this should be only 0 or 1 but just in case...
          const groups: DBOfferingGroupMap = snapshot.val() || {};
          const myGroupIds = Object.keys(groups).filter((groupId) => {
            const users = groups[groupId].users || {};
            return Object.keys(users).indexOf(user.id) !== -1;
          });

          // set out user in each group to null
          if (myGroupIds.length > 0) {
            const updates: any = {};
            myGroupIds.forEach((groupId) => {
              updates[this.getFullPath(this.getGroupUserPath(user, groupId))] = null;
            });
            return firebase.database().ref().update(updates);
          }
        })
        .then(() => {
          this.getLatestGroupIdRef().set(null);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public ref(path: string = "") {
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

  //
  // Paths
  //

  public getUserPath(user: UserModelType) {
    return `users/${user.id}`;
  }

  public getClassPath(user: UserModelType) {
    return `classes/${user.classHash}`;
  }

  public getOfferingPath(user: UserModelType) {
    return `${this.getClassPath(user)}/offerings/${user.offeringId}`;
  }

  public getGroupsPath(user: UserModelType) {
    return `${this.getOfferingPath(user)}/groups`;
  }

  public getGroupPath(user: UserModelType, groupId: string) {
    return `${this.getGroupsPath(user)}/${groupId}`;
  }

  public getGroupUserPath(user: UserModelType, groupId: string, userId?: string) {
    return `${this.getGroupPath(user, groupId)}/users/${userId || user.id}`;
  }

  //
  // Listeners
  //

  private startListeners() {
    return new Promise<void>((resolve, reject) => {
      // listeners must start in this order so we know the latest group joined so we can autojoin groups if needed
      this.startLatestGroupIdListener()
        .then(() => {
          return this.startGroupsListener();
        })
        .then(() => {
          this.isListening = true;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  private stopListeners() {
    this.stopLatestGroupIdListener();
    this.stopGroupListeners();
    this.isListening = false;
  }

  private startLatestGroupIdListener() {
    return new Promise<void>((resolve, reject) => {
      const {user} = this.stores;
      const latestGroupIdRef = this.latestGroupIdRef = this.getLatestGroupIdRef();
      // use once() so we are ensured that latestGroupId is set before we resolve
      latestGroupIdRef.once("value", (snapshot) => {
        this.handleLatestGroupIdRef(snapshot);
        latestGroupIdRef.on("value", this.handleLatestGroupIdRef);
      })
      .then(resolve)
      .catch(reject);
    });
  }

  private getLatestGroupIdRef() {
    return this.ref(this.getUserPath(this.stores.user)).child("latestGroupId");
  }

  private stopLatestGroupIdListener() {
    if (this.latestGroupIdRef) {
      this.latestGroupIdRef.off("value");
      this.latestGroupIdRef = null;
    }
  }

  private handleLatestGroupIdRef = (snapshot: firebase.database.DataSnapshot) => {
    this.stores.user.setLatestGroupId(snapshot.val() || undefined);
  }

  private startGroupsListener() {
    return new Promise<void>((resolve, reject) => {
      const {user, groups} = this.stores;
      const groupsRef = this.groupsRef = this.ref(this.getGroupsPath(user));

      // use once() so we are ensured that groups are set before we resolve
      groupsRef.once("value")
        .then((snapshot) => {
          this.handleGroupsRef(snapshot);

          const group = groups.groupForUser(user.id);
          if (group) {
            // update our connection time so we report as connected/disconnected
            const userRef = this.ref(this.getGroupUserPath(user, group.id));
            this.setConnectionHandlers(userRef);
          }
          else if (user.latestGroupId) {
            // if we are not currently in a group try to join the latest group
            return this.joinGroup(user.latestGroupId);
          }
        })
        .then(() => {
          groupsRef.on("value", this.handleGroupsRef);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  private stopGroupListeners() {
    if (this.groupsRef) {
      this.groupsRef.off("value", this.handleGroupsRef);
      this.groupsRef = null;
    }
  }

  private handleGroupsRef = (snapshot: firebase.database.DataSnapshot) => {
    const {user} = this.stores;
    const groups: DBOfferingGroupMap = snapshot.val() || {};
    const myGroupIds: string[] = [];
    const overSubsribedUserUpdates: any = {};

    // ensure that the current user is not in more than 1 group and groups are not oversubscribed
    Object.keys(groups).forEach((groupId) => {
      const userKeys = Object.keys(groups[groupId].users || {});
      if (userKeys.indexOf(user.id) !== -1) {
        myGroupIds.push(groupId);
      }
      if (userKeys.length > 4) {
        // sort the users by connected timestamp and find the newest users to kick out
        const users = userKeys.map((uid) => groups[groupId].users[uid]);
        users.sort((a, b) => a.connectedTimestamp - b.connectedTimestamp);
        users.splice(0, 4);
        users.forEach((userToRemove) => {
          const userPath = this.getFullPath(this.getGroupUserPath(user, groupId, userToRemove.self.uid));
          overSubsribedUserUpdates[userPath] = null;
        });
      }
    });

    // if there is a problem with the groups fix the problem in the next timeslice
    const numUpdates = Object.keys(overSubsribedUserUpdates).length;
    if ((numUpdates > 0) || (myGroupIds.length > 1)) {
      setTimeout(() => {
        if (numUpdates > 0) {
          firebase.database().ref().update(overSubsribedUserUpdates);
        }
        if (myGroupIds.length > 1) {
          this.leaveGroup();
        }
      }, 1);
    }
    else {
      // otherwise set the groups
      this.stores.groups.updateFromDB(user.id, groups, this.stores.class);
    }
  }

  private setConnectionHandlers(userRef: firebase.database.Reference) {
    if (this.connectedRef) {
      this.connectedRef.off("value");
    }
    else if (!this.connectedRef) {
      this.connectedRef = firebase.database().ref(".info/connected");
    }
    this.connectedRef.on("value", (snapshot) => {
      if (snapshot && snapshot.val()) {
        userRef.child("connectedTimestamp").set(firebase.database.ServerValue.TIMESTAMP);
      }
    });

    if (this.groupOnDisconnect) {
      this.groupOnDisconnect.cancel();
    }
    const groupDisconnectedRef = userRef.child("disconnectedTimestamp");
    this.groupOnDisconnect = groupDisconnectedRef.onDisconnect();
    this.groupOnDisconnect.set(firebase.database.ServerValue.TIMESTAMP);
  }
}
