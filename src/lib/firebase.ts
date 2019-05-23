import * as firebase from "firebase/app";
import { UserModelType } from "../models/stores/user";
import { DB } from "./db";
import { urlParams } from "../utilities/url-params";
import { TeacherSupportSectionTarget, AudienceModelType, AudienceEnum } from "../models/stores/supports";

// Set this during database testing in combination with the urlParam testMigration=true to
// override the top-level Firebase key regardless of mode. For example, setting this to "authed-copy"
// will write to and read from the "authed-copy" key. Once the migration is performed, this should
// be reset to undefined so the test database is no longer referenced.
const FIREBASE_ROOT_OVERRIDE = undefined;

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

  public firebaseStorage() {
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
    const parts = [];
    if (urlParams.testMigration === "true" && FIREBASE_ROOT_OVERRIDE) {
      parts.push(FIREBASE_ROOT_OVERRIDE);
    } else {
      parts.push(`${appMode}`);
      if ((appMode === "dev") || (appMode === "test") || (appMode === "qa")) {
        parts.push(this.userId);
      }
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

  public getClassPath(user: UserModelType) {
    return `classes/${user.classHash}`;
  }

  public getUserPath(user: UserModelType, userId?: string) {
    return `${this.getClassPath(user)}/users/${userId || user.id}`;
  }

  public getClassPublicationsPath(user: UserModelType) {
    return `${this.getClassPath(user)}/publications`;
  }

  public getUserDocumentPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/documents${suffix}`;
  }

  public getUserDocumentCommentsPath(user: UserModelType, documentKey?: string, tileId?: string, commentKey?: string) {
    const docSuffix = documentKey ? `/${documentKey}` : "";
    const tileSuffix = tileId ? `/${tileId}` : "";
    const commentSuffix = commentKey ? `/${commentKey}` : "";
    return `${this.getOfferingPath(user)}/commentaries/comments${docSuffix}${tileSuffix}${commentSuffix}`;
  }

  public getUserDocumentStarsPath(user: UserModelType, documentKey?: string, starKey?: string) {
    const docSuffix = documentKey ? `/${documentKey}` : "";
    const starSuffix = starKey ? `/${starKey}` : "";
    return `${this.getOfferingPath(user)}/commentaries/stars${docSuffix}${starSuffix}`;
  }

  public getUserDocumentMetadataPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/documentMetadata${suffix}`;
  }

  public getLearningLogPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/learningLogs${suffix}`;
  }

  public getImagesPath(user: UserModelType) {
    return `${this.getClassPath(user)}/images`;
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

  public getSupportsPath(
    user: UserModelType,
    audience?: AudienceModelType,
    sectionTarget?: TeacherSupportSectionTarget,
    key?: string
  ) {
    const audienceSuffix = audience
      ? audience.identifier
        ? `/${audience.type}/${audience.identifier}`
        : `/${audience.type}`
      : "";
    const sectionTargetSuffix = sectionTarget ? `/${sectionTarget}` : "";
    const keySuffix = key ? `/${key}` : "";
    return `${this.getOfferingPath(user)}/supports${audienceSuffix}${sectionTargetSuffix}${keySuffix}`;
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
  // Firebase Storage
  //

  public getPublicUrlFromStore(storePath?: string, storeUrl?: string): Promise<any> {
    const ref = storeUrl ? this.firebaseStorage().refFromURL(storeUrl) : this.firebaseStorage().ref(storePath);
    // Get the download URL - returns a url with an authentication token for the current session
    return ref.getDownloadURL().then((url) => {
      return url;
    }).catch((error) => {
      switch (error.code) {
        case "storage/object-not-found":
          // File doesn't exist
          break;

        case "storage/unauthorized":
          // User doesn't have permission to access the object
          break;

        case "storage/canceled":
          // User canceled the upload
          break;

        case "storage/unknown":
          // Unknown error occurred, inspect the server response
          break;
      }
      return null;
    });
  }

  public uploadImage(storePath: string, file: File, imageData?: Blob): Promise<any> {
    const ref = this.firebaseStorage().ref(storePath);
    const fileData = imageData ? imageData : file;
    return ref.put(fileData).then((snapshot) => {
      return snapshot.ref.fullPath;
    }).catch((error) => {
      return error.code;
    });
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
