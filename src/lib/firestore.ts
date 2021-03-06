import firebase from "firebase/app";
import "firebase/firestore";
import { DB } from "./db";
import { escapeKey } from "./fire-utils";

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
    const { appMode, demo: { name: demoName }, user } = this.db.stores;
    let rootDocId: string;

    // `authed/${escapedPortalDomain}`
    if (appMode === "authed") {
      rootDocId = escapeKey(user.portal);
    }
    // `demo/${escapedDemoName}`
    else if ((appMode === "demo") && (demoName?.length > 0)) {
      rootDocId = escapeKey(demoName);
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

  public collectionRef(path: string) {
    return firebase.firestore().collection(path);
  }

  public documentRef(collectionOrFullDocumentPath: string, documentPath?: string) {
    return documentPath
            ? firebase.firestore().collection(collectionOrFullDocumentPath).doc(escapeKey(documentPath))
            : firebase.firestore().doc(collectionOrFullDocumentPath);
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
}
