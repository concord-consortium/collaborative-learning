import firebase from "firebase/app";
import "firebase/firestore";
import { DB } from "./db";
import { getRootId } from "./root-id";
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
    const { appMode } = this.db.stores;
    return `/${appMode}/${getRootId(this.db.stores, this.userId)}/`;
  }

  public getFullPath(path = "") {
    return `${this.getRootFolder()}${path}`;
  }

  public getMulticlassSupportsPath() {
    return this.getFullPath("mcsupports");
  }

  public getClassInfoPath(unit: string, classHash: string) {
    return this.getFullPath(`exemplars/${unit}/classes/${classHash}`);
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

  public runTransaction(fn: (t: firebase.firestore.Transaction) => Promise<any>) {
    return firebase.firestore().runTransaction(fn);
  }

  /*
   * Guarantees the existence of the specified document by reading it first and then
   * creating it if it doesn't already exist. Optionally, client can specify a
   * `shouldUpdate()` function which determines whether the document should be written
   * even if it already exists (e.g. because the contents have changed). When either
   * creating or updating the document, the client's `writeContent()` function is called
   * to determine the content to be written. Returns the read content in the case of
   * preexisting documents that are not updated or the promise returned from the `set()`
   * function in the case of documents created or updated.
   */
  public async guaranteeDocument<T>(
    partialPath: string, writeContent: () => Promise<T>, shouldUpdate?: (content?: T) => boolean)
  {
    const docRef = this.doc(partialPath);
    try {
      const content: T | undefined = (await docRef.get()).data() as T | undefined;
      if (shouldUpdate?.(content)) {
        // update the document if client indicates the need to do so
        const _content = await writeContent();
        return _content ? docRef.set(_content, { merge: true }) : undefined;
      }
      return content;
    }
    catch(e) {
      // security rules violations (e.g. requests for non-existent documents whose security
      // rules depend on the contents of the document) are signaled as permissions errors
      if (isFirestorePermissionsError(e)) {
        // create the document if it doesn't already exist
        const _content = await writeContent();
        return _content ? docRef.set(_content) : undefined;
      }
    }
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

  /**
   * Record the lastLaunchTime in the Firestore root.
   *
   * This is only recorded for dev, qa, test, and demo appModes.
   * In the dev, qa, and test modes each user has their own root or a new root
   * is created on each test.
   * In the demo mode there could be lots of users launching in the same root
   * but this number should be manageable, and it will be useful to keep track
   * of how old various demo roots are.
   * In the auth (portal launch) case lots of users will be launching the same
   * root so the lastLaunchTime would be updated too frequently. Also we can use
   * logs and portal information to find the last portal launch.
   *
   * @returns a promise that resolves when the lastLaunchTime has been updated
   */
  public async recordLaunchTime() {
    const { appMode } = this.db.stores;

    if (!["dev", "qa", "test", "demo"].includes(appMode)) {
      return;
    }

    return this.doc("").set({lastLaunchTime: this.timestamp()}, {merge: true});
  }
}
