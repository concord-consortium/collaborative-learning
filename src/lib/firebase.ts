import firebase from "firebase";
import { UserModelType } from "../models/user";
import { DB } from "./db";

export class Firebase {
  public user: firebase.User | null = null;
  private db: DB;
  private groupOnDisconnect: firebase.database.OnDisconnect | null = null;
  private connectedRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public get userId() {
    return this.user ? this.user.uid : "no-user-id";
  }

  public get isConnected() {
    return this.user !== null;
  }

  public ref(path: string = "") {
    if (!this.isConnected) {
      throw new Error("ref() requested before db connected!");
    }
    return firebase.database().ref(this.getFullPath(path));
  }

  public firestore() {
    return firebase.storage();
  }

  public storeRef(path: string = "") {
    if (!this.isConnected) {
      throw new Error("storeRef() requested before firestore connected!");
    }
    return firebase.storage().ref(this.getFullPath(path));
  }

  public getFullPath(path: string = "") {
    return `${this.getRootFolder()}${path}`;
  }

  public getRootFolder() {
    // in the form of /(dev|test|demo|authed)/[<firebaseUserId> if dev or test]/portals/<escapedPortalDomain>
    const { appMode, user } = this.db.stores;
    const parts = [`${appMode}`];

    if ((appMode === "dev") || (appMode === "test")) {
      parts.push(this.userId);
    }
    parts.push("portals");
    parts.push(this.escapeKey(user.portal));

    return `/${parts.join("/")}/`;
  }

  public escapeKey(s: string): string {
    return s.replace(/[.$[\]#\/]/g, "_");
  }

  //
  // Paths
  //

  public getUserPath(user: UserModelType, userId?: string) {
    return `users/${userId || user.id}`;
  }

  public getUserDocumentPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/documents${suffix}`;
  }

  public getUserDocumentMetadataPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/documentMetadata${suffix}`;
  }

  public getLearningLogPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/learningLogs${suffix}`;
  }

  public getClassPath(user: UserModelType) {
    return `classes/${user.classHash}`;
  }

  public getOfferingPath(user: UserModelType) {
    return `${this.getClassPath(user)}/offerings/${user.offeringId}`;
  }

  public getOfferingUsersPath(user: UserModelType) {
    return `${this.getOfferingPath(user)}/users`;
  }

  public getOfferingUserPath(user: UserModelType, userId?: string) {
    return `${this.getOfferingUsersPath(user)}/${userId || user.id}`;
  }

  public getSectionDocumentPath(user: UserModelType, sectionId?: string, userId?: string) {
    const suffix = sectionId ? `/${sectionId}` : "";
    return `${this.getOfferingUserPath(user, userId)}/sectionDocuments${suffix}`;
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

  public getPublicationsPath(user: UserModelType) {
    return `${this.getOfferingPath(user)}/publications`;
  }

  //
  // Handlers
  //

  public setConnectionHandlers(userRef: firebase.database.Reference) {
    if (this.groupOnDisconnect) {
      this.groupOnDisconnect.cancel();
    }
    const groupDisconnectedRef = userRef.child("disconnectedTimestamp");
    this.groupOnDisconnect = groupDisconnectedRef.onDisconnect();
    this.groupOnDisconnect.set(firebase.database.ServerValue.TIMESTAMP);

    if (this.connectedRef) {
      this.connectedRef.off("value");
    }
    else if (!this.connectedRef) {
      this.connectedRef = firebase.database().ref(".info/connected");
    }
    // once() ensures that the connected timestamp is set before resolving
    return this.connectedRef.once("value", (snapshot) => {
        return this.handleConnectedRef(userRef, snapshot);
      })
      .then(() => {
        if (this.connectedRef) {
          this.connectedRef.on("value", (snapshot) => {
            this.handleConnectedRef(userRef, snapshot || undefined);
          });
        }
      });
  }

  public cancelGroupDisconnect() {
    if (this.groupOnDisconnect) {
      this.groupOnDisconnect.cancel();
    }
    this.groupOnDisconnect = null;
  }

  //
  // Refs
  //

  public getLatestGroupIdRef() {
    return this.ref(this.getUserPath(this.db.stores.user)).child("latestGroupId");
  }

  private handleConnectedRef = (userRef: firebase.database.Reference, snapshot?: firebase.database.DataSnapshot, ) => {
    if (snapshot && snapshot.val()) {
      return userRef.child("connectedTimestamp").set(firebase.database.ServerValue.TIMESTAMP);
    }
  }

}
