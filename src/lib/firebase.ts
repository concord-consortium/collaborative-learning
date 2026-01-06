import firebase from "firebase/app";
import {
  GroupDocument,
  LearningLogDocument, OtherDocumentType, PersonalDocument, PlanningDocument, ProblemDocument, ProblemPublication
} from "../models/document/document-types";
import { AudienceModelType, SectionTarget } from "../models/stores/supports";
import { UserModelType } from "../models/stores/user";
import { DB } from "./db";
import { escapeKey } from "./fire-utils";
import { urlParams } from "../utilities/url-params";
import { DocumentModelType } from "src/models/document/document";
import { getRootId } from "./root-id";

// Set this during database testing in combination with the urlParam testMigration=true to
// override the top-level Firebase key regardless of mode. For example, setting this to "authed-copy"
// will write to and read from the "authed-copy" key. Once the migration is performed, this should
// be reset to undefined so the test database is no longer referenced.
const FIREBASE_ROOT_OVERRIDE = undefined;

export class Firebase {
  private user: firebase.User | null = null;
  private db: DB;
  private groupOnDisconnect: firebase.database.OnDisconnect | null = null;
  private connectedRef: firebase.database.Reference | null = null;

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

  public get onlineStatusRef() {
    return firebase.database().ref(".info/connected");
  }

  public ref(path = "") {
    if (!this.isConnected) {
      throw new Error("ref() requested before db connected!");
    }
    return firebase.database().ref(this.getFullPath(path));
  }

  public firebaseStorage() {
    return firebase.storage();
  }

  public storeRef(path = "") {
    if (!this.isConnected) {
      throw new Error("storeRef() requested before firestore connected!");
    }
    return firebase.storage().ref(this.getFullPath(path));
  }

  public getFullPath(path = "") {
    return `${this.getRootFolder()}${path}`;
  }

  public getRootFolder() {
    // authed: /authed/portals/<escapedPortalDomain>
    // demo: /demo/<demoName>/portals/demo <as portalDomain>
    // dev: /dev/<firebaseUserId>/portals/localhost <as portalDomain>
    // qa: /qa/<firebaseUserId>/portals/qa <as portalDomain>
    // test: /test/<firebaseUserId>/portals/<arbitraryString as portalDomain>
    const { appMode, user } = this.db.stores;

    const parts = [];
    if (urlParams.testMigration === "true" && FIREBASE_ROOT_OVERRIDE) {
      parts.push(FIREBASE_ROOT_OVERRIDE);
    } else {
      parts.push(`${appMode}`);
      if (appMode !== "authed") {
        parts.push(getRootId(this.db.stores, this.userId));
      }
    }
    parts.push("portals");
    parts.push(escapeKey(user.portal));

    return `/${parts.join("/")}/`;
  }

  //
  // Paths
  //

  public getClassPath(user: UserModelType) {
    return `classes/${user.classHash}`;
  }

  public getFullClassPath(user: UserModelType) {
    return this.getFullPath(this.getClassPath(user));
  }

  public getUsersPath(user: UserModelType) {
    return `${this.getClassPath(user)}/users`;
  }

  public getUserPath(user: UserModelType, userId?: string) {
    return `${this.getClassPath(user)}/users/${userId || user.id}`;
  }

  public getUserExemplarsPath(user: UserModelType) {
    return `${this.getUserPath(user)}/exemplars`;
  }

  public getExemplarDataPath(user: UserModelType, exemplarId: string) {
    return `${this.getUserExemplarsPath(user)}/${exemplarId}`;
  }

  public getExemplarStatePath(user: UserModelType) {
    return `${this.getUserExemplarsPath(user)}/state`;
  }

  // Published learning logs metadata
  public getLearningLogPublicationsPath(user: UserModelType) {
    return `${this.getClassPath(user)}/publications`;
  }

  // Published personal documents metadata
  public getPersonalPublicationsPath(user: UserModelType) {
    return `${this.getClassPath(user)}/personalPublications`;
  }

  // Content of all documents associated with this user
  public getUserDocumentPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/documents${suffix}`;
  }

  public getDocumentPath(document: DocumentModelType, user: UserModelType) {
    if (document.isRemote) {
      return `classes/${document.remoteContext}/users/${document.uid}/documents/${document.key}`;
    } else {
      return this.getUserDocumentPath(user, document.key, document.uid);
    }
  }

  public getFullDocumentPath(document: DocumentModelType, user: UserModelType) {
    return this.getFullPath(this.getDocumentPath(document, user));
  }

  // all of the relevant paths for a given user document
  public getUserDocumentPaths(user: UserModelType, documentType: string, documentKey: string, userId?: string) {
    const content = this.getUserDocumentPath(user, documentKey, userId);
    const metadata = this.getUserDocumentMetadataPath(user, documentKey, userId);
    const typedMetadataMap: Record<string, () => string> = {
      [ProblemDocument]: () => {
        return this.getProblemDocumentPath(user, documentKey, userId);
      },
      [PlanningDocument]: () => this.getPlanningDocumentPath(user, documentKey, userId),
      [PersonalDocument]: () => this.getOtherDocumentPath(user, PersonalDocument, documentKey),
      [LearningLogDocument]: () => this.getOtherDocumentPath(user, LearningLogDocument, documentKey),
      [ProblemPublication]: () => `${this.getProblemPublicationsPath(user)}/${documentKey}`,
       // typed metadata for published personal documents and learning logs is stored under a different key
    };
    const typedMetadata = typedMetadataMap[documentType]?.() || "";
    return { content, metadata, typedMetadata };
  }

  /**
   *  Returns all of the relevant paths for a given document
   */
  public getDocumentPaths(currentUser: UserModelType, document: DocumentModelType)
    : { content: string; metadata?: string; typedMetadata?: string }
  {
    if (document.type === GroupDocument) {
      if (!document.groupId) {
        throw new Error("getDocumentPaths: group document missing groupId");
      }
      return { content: this.getGroupDocumentPath(currentUser, document.groupId!, document.key) };
    } else {
      return this.getUserDocumentPaths(currentUser, document.type, document.key, document.uid);
    }
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

  // Basic metadata for all document types (in addition to type-specific metadata stored elsewhere)
  public getUserDocumentMetadataPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/documentMetadata${suffix}`;
  }

  public getLastEditedMetadataPath(user: UserModelType, documentKey: string, userId?: string) {
    return `${this.getUserDocumentMetadataPath(user, documentKey, userId)}/lastEditedAt`;
  }

  // Returns the path to the evaluation type & timestamp for a document, if specified in the appConfig
  public getEvaluationMetadataPath(user: UserModelType, documentKey: string, userId?: string) {
    const evaluation = this.db.stores.appConfig.aiEvaluation;
    if (evaluation) {
      return `${this.getUserDocumentMetadataPath(user, documentKey, userId)}/evaluation/${evaluation}`;
    } else {
      return undefined;
    }
  }

  /**
   * Set up Firebase onDisconnect handlers.
   * All documents get one to update the lastEditedAt timestamp when the user disconnects.
   * If the appConfig specifies an AI Evaluation to be run, a metadata field is added to request that as well.
   */
  public setLastEditedOnDisconnect(user: UserModelType, documentKey: string, userId?: string):
      firebase.database.OnDisconnect[] {
    const onDisconnects: firebase.database.OnDisconnect[] = [];
    const ref = this.ref(this.getLastEditedMetadataPath(user, documentKey, userId));
    const onDisconnect = ref.onDisconnect();
    onDisconnect.set(firebase.database.ServerValue.TIMESTAMP);
    onDisconnects.push(onDisconnect);

    const evaluation = this.getEvaluationMetadataPath(user, documentKey, userId);
    if (evaluation) {
      const evaluationRef = this.ref(evaluation);
      const evaluationOnDisconnect = evaluationRef.onDisconnect();
      this.updateEvaluation(evaluationOnDisconnect);
      onDisconnects.push(evaluationOnDisconnect);
    }
    return onDisconnects;
  }

  /**
   * Set the lastEditedAt timestamp to the current time, optionally cancelling any onDisconnect handlers.
   * If the appConfig specifies an AI Evaluation to be run, that timestamp is set as well.
   */
  public setLastEditedNow(user: UserModelType, documentKey: string, userId: string|undefined,
      onDisconnects?: firebase.database.OnDisconnect[]) {

    if (onDisconnects) {
      onDisconnects.forEach((onDisconnect) => {
        onDisconnect.cancel();
      });
    }

    const promises: Promise<any>[] = [];
    promises.push(this.ref(this.getLastEditedMetadataPath(user, documentKey, userId))
      .set(firebase.database.ServerValue.TIMESTAMP));
    const evaluation = this.getEvaluationMetadataPath(user, documentKey, userId);
    if (evaluation) {
      const updatePromise = this.updateEvaluation(this.ref(evaluation));
      updatePromise && promises.push(updatePromise);
    }

    return Promise.all(promises);
  }

  public getLastEditedTimestamp(user: UserModelType, documentKey: string, userId?: string) {
    return this.ref(this.getLastEditedMetadataPath(user, documentKey, userId)).once("value").then((snapshot) => {
      return snapshot.val();
    });
  }

  // Unpublished personal document/learning log metadata
  public getOtherDocumentPath(user: UserModelType, documentType: OtherDocumentType, documentKey?: string) {
    const dir = documentType === PersonalDocument ? "personalDocs" : "learningLogs";
    const key = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user)}/${dir}${key}`;
  }

  // Unpublished learning log metadata
  public getLearningLogPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/learningLogs${suffix}`;
  }

  // Unpublished personal document metadata
  public getUserPersonalDocPath(user: UserModelType, documentKey?: string, userId?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getUserPath(user, userId)}/personalDocs${suffix}`;
  }

  public getImagesPath(user: UserModelType) {
    return `${this.getClassPath(user)}/images`;
  }

  public getOfferingsPath(user: UserModelType) {
    return `${this.getClassPath(user)}/offerings`;
  }

  public getOfferingPath(user: UserModelType) {
    return `${this.getClassPath(user)}/offerings/${user.offeringId}`;
  }

  public getOfferingUsersPath(user: UserModelType) {
    return `${this.getOfferingPath(user)}/users`;
  }

  public getPersistentUIPath(user: UserModelType){
    return `${this.getOfferingUserPath(user)}/persistentUI`;
  }

  // the path to the user folder for a particular problem (assignment)
  // metadata for each user document is in the class/offerings/users/userId path, but
  // the contents of all of a user's documents are in the class/users/userId/documents path.
  public getOfferingUserPath(user: UserModelType, userId?: string) {
    return `${this.getOfferingUsersPath(user)}/${userId || user.id}`;
  }

  // Unpublished problem document metadata
  public getProblemDocumentPath(user: UserModelType, documentKey: string, userId?: string) {
    return `${this.getOfferingUserPath(user, userId)}/documents/${documentKey}`;
  }

  // Unpublished problem documents metadata folder
  public getProblemDocumentsPath(user: UserModelType, userId?: string) {
    return `${this.getOfferingUserPath(user, userId)}/documents`;
  }

  // Planning document metadata
  public getPlanningDocumentPath(user: UserModelType, documentKey: string, userId?: string) {
    return `${this.getOfferingUserPath(user, userId)}/planning/${documentKey}`;
  }

  // Planning documents metadata folder
  public getPlanningDocumentsPath(user: UserModelType, userId?: string) {
    return `${this.getOfferingUserPath(user, userId)}/planning`;
  }

  // Unpublished section documents [deprecated]
  public getSectionDocumentPathDEPRECATED(user: UserModelType, sectionId?: string, userId?: string) {
    const suffix = sectionId ? `/${sectionId}` : "";
    return `${this.getOfferingUserPath(user, userId)}/sectionDocuments${suffix}`;
  }

  public getGroupsPath(user: UserModelType) {
    return `${this.getOfferingPath(user)}/groups`;
  }

  public getGroupPath(user: UserModelType, groupId: string) {
    return `${this.getGroupsPath(user)}/${groupId}`;
  }

  public getGroupDocumentPath(user: UserModelType, groupId: string, documentKey?: string) {
    const suffix = documentKey ? `/${documentKey}` : "";
    return `${this.getGroupPath(user, groupId)}/documents${suffix}`;
  }

  public getGroupUserPath(user: UserModelType, groupId: string, userId?: string) {
    return `${this.getGroupPath(user, groupId)}/users/${userId || user.id}`;
  }

  // Published section [deprecated] and problem document metadata
  public getProblemPublicationsPath(user: UserModelType) {
    return `${this.getOfferingPath(user)}/publications`;
  }

  public getSupportsPath(
    user: UserModelType,
    audience?: AudienceModelType,
    sectionTarget?: SectionTarget,
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

  /**
   * Get an server time offset. This is useful to create an estimated server timestamp.
   * See https://firebase.google.com/docs/database/web/offline-capabilities#clock-skew
   *
   * @returns
   */
  public async getServerTimeOffset() {
    const offsetRef = firebase.database().ref(".info/serverTimeOffset");
    const snap = await offsetRef.once("value");
    return snap.val();
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

  public getLastSupportViewTimestampPath() {
    return `${this.getUserPath(this.db.stores.user)}/lastSupportViewTimestamp`;
  }

  public getLastStickyNoteViewTimestampRef() {
    return this.ref(this.getUserPath(this.db.stores.user)).child("lastStickyNoteViewTimestamp");
  }

  private handleConnectedRef = (userRef: firebase.database.Reference, snapshot?: firebase.database.DataSnapshot, ) => {
    if (snapshot) {
      const connected: boolean = snapshot.val();
      if (connected) {
        userRef.child("connectedTimestamp").set(firebase.database.ServerValue.TIMESTAMP);
      }
      this.db.stores.user.setIsFirebaseConnected(connected);
    }
  };

private updateEvaluation = (targetRef: firebase.database.Reference | firebase.database.OnDisconnect) => {
  const { aiEvaluation, aiPrompt } = this.db.stores.appConfig;

  // If this unit uses "custom" evaluation, read and store the prompt strings if they're defined.
  if (aiEvaluation === "custom") {
    return aiPrompt
      ? targetRef.set({ aiPrompt, timestamp: firebase.database.ServerValue.TIMESTAMP })
      : undefined;
  }

  return targetRef.set({ timestamp: firebase.database.ServerValue.TIMESTAMP });
};

}
