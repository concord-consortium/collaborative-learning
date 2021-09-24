import firebase from "firebase/app";
import "firebase/firestore";
import { DB } from "./db";
import { escapeKey } from "./fire-utils";
import { UserDocument } from "./firestore-schema";

export function isFirestoreError(e: any): e is firebase.firestore.FirestoreError {
  return (e instanceof Error) && !!(e as firebase.firestore.FirestoreError).code;
}

// security rules violations are signaled as permissions errors
// for instance, requesting a non-existent document whose security rules depend on its contents
// results in a permissions error, because the non-existent document can't satisfy the rules
export function isFirestorePermissionsError(e: any): e is firebase.firestore.FirestoreError {
  return isFirestoreError(e) && (e.code === "permission-denied");
}

export class Firestore {
  private user: firebase.User | null = null;
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  public setFirebaseUser(user: firebase.User) {
    this.user = user;
  }

  public get userId() {
    return this.user ? this.user.uid : "no-user-id";
  }

  public get isConnected() {
    return this.user !== null;
  }

  //
  // Firestore
  //

  public getRootFolder() {
    const { appMode, demo: { name: demoName }, user: { portal } } = this.db.stores;
    let rootDocId: string;
    const escapedPortal = portal ? escapeKey(portal) : portal;

    // `authed/${escapedPortalDomain}`
    if (appMode === "authed") {
      rootDocId = escapedPortal;
    }
    // `demo/${escapedDemoName}`
    else if ((appMode === "demo") && (demoName?.length > 0)) {
      const escapedDemoName = demoName ? escapeKey(demoName) : demoName;
      rootDocId = escapedDemoName || escapedPortal || "demo";
    }
    // `${appMode}/${userId}`
    else {  // (appMode === "dev") || (appMode === "test") || (appMode === "qa")
      rootDocId = this.userId;
    }

    return `/${appMode}/${rootDocId}/`;
  }

  public getFullPath(path = "") {
    return `${this.getRootFolder()}${path}`;
  }

  public getMulticlassSupportsPath() {
    return this.getFullPath("mcsupports");
  }

  public getMulticlassSupportsRef() {
    return this.collectionRef(this.getMulticlassSupportsPath());
  }

  public getMulticlassSupportDocumentPath(docId: string) {
    return `${this.getMulticlassSupportsPath()}/${docId}`;
  }

  public getMulticlassSupportDocumentRef(docId: string) {
    return this.documentRef(this.getMulticlassSupportDocumentPath(docId));
  }

  public collectionRef(fullPath: string) {
    return firebase.firestore().collection(fullPath);
  }

  public documentRef(collectionOrFullDocumentPath: string, documentPath?: string) {
    return documentPath
            ? firebase.firestore().collection(collectionOrFullDocumentPath).doc(escapeKey(documentPath))
            : firebase.firestore().doc(collectionOrFullDocumentPath);
  }

  public collection(partialPath: string) {
    return firebase.firestore().collection(`${this.getRootFolder()}${partialPath}`);
  }

  public doc(partialPath: string) {
    return firebase.firestore().doc(`${this.getRootFolder()}${partialPath}`);
  }

  public newDocumentRef(collectionPath: string) {
    return firebase.firestore().collection(collectionPath).doc();
  }

  public getDocument(collectionOrFullDocumentPath: string, documentPath?: string) {
    const docRef = this.documentRef(collectionOrFullDocumentPath, documentPath);
    return docRef.get();
  }

  public batch(fn: (b: firebase.firestore.WriteBatch) => void) {
    const batch = firebase.firestore().batch();
    fn(batch);
    return batch.commit();
  }

  public timestamp() {
    return firebase.firestore.FieldValue.serverTimestamp() as unknown as number;
  }

  public async getFirestoreUser(uid: string) {
    const userDoc = await this.doc(`users/${uid}`).get();
    return userDoc.data() as UserDocument | undefined;
  }
}
