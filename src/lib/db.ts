import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/firestore";
import "firebase/functions";
import "firebase/storage";
import { observable, makeObservable } from "mobx";
import { getSnapshot } from "mobx-state-tree";
import {
  DBOfferingGroup, DBOfferingGroupUser, DBOfferingGroupMap, DBOfferingUser, DBDocumentMetadata, DBDocument,
  DBGroupUserConnections, DBPublication, DBPublicationDocumentMetadata, DBDocumentType, DBImage, DBTileComment,
  DBUserStar, DBOfferingUserProblemDocument, DBOtherDocument, IDocumentProperties, DBOtherPublication, DBSupport,
  DBGroupDocument
} from "./db-types";
import { DocumentModelType, createDocumentModel } from "../models/document/document";
import {
  DocumentType, LearningLogDocument, LearningLogPublication, OtherDocumentType, OtherPublicationType,
  PersonalDocument, PersonalPublication, PlanningDocument, ProblemDocument, ProblemOrPlanningDocumentType,
  ProblemPublication, SupportPublication, GroupDocument
} from "../models/document/document-types";
import { SectionModelType } from "../models/curriculum/section";
import { SupportModelType } from "../models/curriculum/support";
import { ImageModelType } from "../models/image";
import {
  DocumentContentSnapshotType, DocumentContentModelType, cloneContentWithUniqueIds
} from "../models/document/document-content";
import { logDocumentEvent } from "../models/document/log-document-event";
import { createDefaultSectionedContent } from "../models/document/sectioned-content";
import { Firebase } from "./firebase";
import { Firestore } from "./firestore";
import { DBListeners } from "./db-listeners";
import { Logger } from "./logger";
import { LogEventName } from "./logger-types";
import { getSimpleDocumentPath, IFirestoreMetadataDocumentParams, IDocumentMetadata, IGetImageDataParams,
         IPublishSupportParams } from "../../shared/shared";
import { getFirebaseFunction } from "../hooks/use-firebase-function";
import { IStores } from "../models/stores/stores";
import { TeacherSupportModelType, SectionTarget, AudienceModelType } from "../models/stores/supports";
import { safeJsonParse } from "../utilities/js-utils";
import { typeConverter } from "../utilities/db-utils";
import { initializeApp } from "./firebase-config";
import { UserModelType } from "../models/stores/user";
import { logExemplarDocumentEvent } from "../models/document/log-exemplar-document-event";
import { AppMode } from "../models/stores/store-types";
import { DEBUG_FIRESTORE } from "./debug";
import { firebaseRefPath } from "./fire-utils";

export type IDBConnectOptions = IDBAuthConnectOptions | IDBNonAuthConnectOptions;
export interface IDBBaseConnectOptions {
  stores: IStores;

  // for unit tests
  dontStartListeners?: boolean;
  authPersistence?: firebase.auth.Auth.Persistence;
}
export interface IDBAuthConnectOptions extends IDBBaseConnectOptions {
  appMode: "authed";
  rawFirebaseJWT: string;
}
export interface IDBNonAuthConnectOptions extends IDBBaseConnectOptions {
  appMode: Exclude<AppMode, "authed">;
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

export interface ICreateOtherDocumentParams {
  title?: string;
  properties?: IDocumentProperties;
  content?: DocumentContentModelType;
}

export interface ICopyOtherDocumentParams {
  title?: string;
  asTemplate?: boolean;
}

export interface OpenDocumentOptions {
  documentKey: string;
  type: DocumentType;
  userId: string;
  createdAt?: number;
  groupId?: string;
  sectionId?: string;
  visibility?: "public" | "private";
  title?: string;
  properties?: IDocumentProperties;
  groupUserConnections?: Record<string, unknown>;
  originDoc?: string;
  pubVersion?: number;
  problem?: string;
  investigation?: string;
  unit?: string;
}

// Allow createdAt to be a server timestamp value
// This approach allows us to still discriminate the union of DBDocumentMetadata
export type CreateFirestoreMetadata<T extends DBDocumentMetadata = DBDocumentMetadata> =
  T extends any ? Omit<T, 'createdAt'> & { createdAt: number | firebase.firestore.FieldValue } : never;

export class DB {
  @observable public groups: GroupUsersMap = {};
  public firebase: Firebase;
  public firestore: Firestore;
  public listeners: DBListeners;
  public stores: IStores;

  private authStateUnsubscribe?: firebase.Unsubscribe;
  private documentFetchPromiseMap = new Map<string, Promise<DocumentModelType>>();

  constructor() {
    makeObservable(this);
    this.firebase = new Firebase(this);
    this.firestore = new Firestore(this);
    this.listeners = new DBListeners(this);
  }

  public isAuthStateSubscribed() {
    return !!this.authStateUnsubscribe;
  }

  public connect(options: IDBConnectOptions) {
    if (DEBUG_FIRESTORE) {
      firebase.firestore.setLogLevel('debug');
    }
    return new Promise<void>((resolve, reject) => {
      if (this.firebase.isConnected) {
        reject("Already connected to database!");
      }

      initializeApp();

      this.stores = options.stores;

      this.authStateUnsubscribe = firebase.auth().onAuthStateChanged((firebaseUser) => {
        // always stop existing listeners when firebase user changes
        this.listeners.stop();
        if (firebaseUser) {
          this.firebase.setFirebaseUser(firebaseUser);
          this.firestore.setFirebaseUser(firebaseUser);
          if (!options.dontStartListeners) {
            const { persistentUI, user, db, unitLoadedPromise, exemplarController} = this.stores;

            // Record launch time in Firestore
            this.firestore.recordLaunchTime();

            // Start fetching the persistent UI. We want this to happen as early as possible.
            persistentUI.initializePersistentUISync(user, db);

            // Resolve after listeners have started.
            // Before they can be started  we need to wait for the unit to be loaded,
            // since it includes the list of tile types being registered.
            // We need those types to be registered so the listeners can safely create documents.
            unitLoadedPromise.then(() => {
              this.listeners.start().then(resolve).catch(reject);
              exemplarController.initialize(this.stores);
            });
          }
        }
      });

      // SESSION auth persistence is used so each new tab or window gets its own Firebase authentication
      // Unless overridden this applies to all app modes (qa, dev, app, auth, test)
      firebase.auth().setPersistence(options.authPersistence || firebase.auth.Auth.Persistence.SESSION);

      if (options.appMode === "authed") {
        firebase.auth()
          .signOut()
          .then(() => firebase.auth().signInWithCustomToken(options.rawFirebaseJWT))
          // resolve once we're authenticated if we're not supposed to start listeners
          .then(() => options.dontStartListeners && resolve())
          .catch(reject);
      }
      else {
        firebase.auth()
          .signInAnonymously()
          // resolve once we're authenticated if we're not supposed to start listeners
          .then(() => options.dontStartListeners && resolve())
          .catch(reject);
      }
    });
  }

  public disconnect() {
    this.listeners.stop();
    this.authStateUnsubscribe?.();
    this.authStateUnsubscribe = undefined;
  }

  public joinGroup(groupId: string) {
    const {user} = this.stores;
    const groupRef = this.firebase.ref(this.firebase.getGroupPath(user, groupId));
    let userRef: firebase.database.Reference;

    return new Promise<void>((resolve, reject) => {
      groupRef.once("value")
        .then((snapshot) => {
          // FIXME: we need to watch out for this. When we make a group document
          // we are going to assume the user has already joined the group so this
          // group document will already exist. But if for some reason this group info
          // isn't set yet, then adding the "documents" child will prevent `snapshot.val()`
          // from being null, so then the group info won't get set.
          // And if this group info gets set later it will overwrite the group documents.
          // This should probably be in a transaction anyhow, since another user might have
          // already created and joined the group between when we read it and then update it.
          //
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
          return this.firebase.setConnectionHandlers(userRef);
        })
        .then(() => {
          // remember the last group joined
          return this.firebase.getLatestGroupIdRef().set(groupId);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public leaveGroup() {
    const {user} = this.stores;
    const groupsRef = this.firebase.ref(this.firebase.getGroupsPath(user));

    this.firebase.cancelGroupDisconnect();

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
              updates[this.firebase.getFullPath(this.firebase.getGroupUserPath(user, groupId))] = null;
            });
            return firebase.database().ref().update(updates);
          }
        })
        .then(() => {
          this.firebase.getLatestGroupIdRef().set(null);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public async guaranteeOpenDefaultDocument(documentType: typeof ProblemDocument | typeof PersonalDocument,
                                            defaultContent?: DocumentContentModelType) {
    const {documents} = this.stores;

    // problem document
    if (documentType === ProblemDocument) {
      const requiredProblemDocument = documents.requiredDocuments[ProblemDocument];
      if (requiredProblemDocument) {
        const problemDocument = await requiredProblemDocument.promise;
        return problemDocument ||
                this.createProblemOrPlanningDocument(ProblemDocument, defaultContent);
      }
      else {
        console.error("ERROR: Can't create required problem document without an appropriate promise!");
        return Promise.resolve(null);
      }
    }

    // personal document
    const requiredPersonalDocument = documents.requiredDocuments[PersonalDocument];
    if (requiredPersonalDocument) {
      // The promise is resolved with the first non-deleted personal document. More work will be
      // required if we are to, for instance, return the most recently created/modified document.
      const personalDocument = await requiredPersonalDocument.promise;
      return personalDocument ||
              this.createPersonalDocument({ content: defaultContent });
    }
    else {
      console.error("ERROR: Can't create required personal document without an appropriate promise!");
      return Promise.resolve(null);
    }
  }

  public async guaranteePlanningDocument(sections?: SectionModelType[]) {
    const {appConfig, documents} = this.stores;

    const requiredPlanningDocument = documents.requiredDocuments[PlanningDocument];
    if (requiredPlanningDocument) {
      const planningDocument = await requiredPlanningDocument.promise;
      if (planningDocument) return planningDocument;
      const content = appConfig.planningTemplate;
      const docContent = createDefaultSectionedContent({ sections, content });
      return this.createProblemOrPlanningDocument(PlanningDocument, docContent);
    }
    else {
      console.error("ERROR: Can't determine required planning document without an appropriate promise!");
    }
  }

  public async guaranteeLearningLog(initialTitle?: string, defaultContent?: DocumentContentModelType) {
    const {documents} = this.stores;

    const requiredLearningLogDocument = documents.requiredDocuments[LearningLogDocument];
    if (requiredLearningLogDocument) {
      const learningLogDocument = await requiredLearningLogDocument.promise;
      return learningLogDocument ||
              this.createOtherDocument(LearningLogDocument, { title: initialTitle, content: defaultContent });
    }
    else {
      console.error("ERROR: Can't determine required learning log document without an appropriate promise!");
    }
  }

  public createProblemOrPlanningDocument(type: ProblemOrPlanningDocumentType, content?: DocumentContentModelType) {
    return new Promise<DocumentModelType | null>((resolve, reject) => {
      const {user, documents} = this.stores;
      const offeringUserRef = this.firebase.ref(this.firebase.getOfferingUserPath(user));

      return offeringUserRef.once("value")
        .then((snapshot) => {
          // ensure the offering user exists
          const candidateSnapshot = snapshot.val();
          if (!candidateSnapshot?.version || !candidateSnapshot?.self){
            const offeringUser: DBOfferingUser = {
              version: "1.0",
              self: {
                classHash: user.classHash,
                offeringId: user.offeringId,
                uid: user.id,
              }
            };
            return offeringUserRef.update(offeringUser);
          }
         })
        .then(() => {
          // create the new document
          return this.createDocument({ type, content: JSON.stringify(content) })
            .then(({document, metadata}) => {
                const newDocument: DBOfferingUserProblemDocument = {
                  version: "1.0",
                  self: {
                    classHash: user.classHash,
                    offeringId: user.offeringId,
                    uid: user.id
                  },
                  visibility: "private",
                  documentKey: document.self.documentKey,
                };
                const newDocumentPath = type === PlanningDocument
                                          ? this.firebase.getPlanningDocumentPath(user, document.self.documentKey)
                                          : this.firebase.getProblemDocumentPath(user, document.self.documentKey);
                const newDocumentRef = this.firebase.ref(newDocumentPath);
                return newDocumentRef.set(newDocument).then(() => newDocument);
            });
        })
        .then((newDocument) => {
          // reset the (presumably null) promise for this document type
          documents.addRequiredDocumentPromises([type]);
          // return the promise, which will be resolved by the DB listener
          return documents.requiredDocuments[type].promise;
        })
        .then(resolve)
        .catch(reject);
    });
  }


  async createFirestoreMetadataDocument(
    metadata: CreateFirestoreMetadata,
    documentKey: string
  ) {
    const userContext = this.stores.userContextProvider.userContext;

    if (!this.stores.userContextProvider || !this.firestore || !userContext?.uid) {
      console.error("cannot create Firestore metadata document because environment is not valid",
        { userContext, firestore: this.firestore });
      throw new Error("cannot create Firestore metadata document because environment is not valid");
    }

    const documentPath = getSimpleDocumentPath(documentKey);
    const documentRef = this.firestore.doc(documentPath);
    const docSnapshot = await documentRef.get();


    if (!docSnapshot.exists) {
      const { classHash, self, version, ...cleanedMetadata } = metadata as DBDocumentMetadata & { classHash: string };

      let problemInfo: {unit:string|null, investigation?: string, problem?: string} = {unit: null};
      if ("offeringId" in metadata && metadata.offeringId != null) {
        problemInfo = this.currentProblemInfo;
      }

      // Group documents don't use a real uid, but instead a fake one based on the group id.
      const uid = metadata.type === GroupDocument ? metadata.self.uid : userContext.uid;

      // Add the groupId for group documents to make then easier to query.
      const groupInfo: { groupId?: string } = {};
      if (metadata.type === GroupDocument) {
        groupInfo.groupId = metadata.self.groupId;
      }

      const firestoreMetadata: IDocumentMetadata & { contextId: string } = {
        ...cleanedMetadata,
        // The createFirestoreMetadataDocument firebase function currently deployed to production is out of date.
        // It requires contextId to be defined, but doesn't check its value.
        contextId: "ignored",
        key: documentKey,
        properties: {},
        uid,
        ...problemInfo,
        ...groupInfo
      };
      const createFirestoreMetadataDocument =
        getFirebaseFunction<IFirestoreMetadataDocumentParams>("createFirestoreMetadataDocument_v2");
      createFirestoreMetadataDocument({context: userContext, document: firestoreMetadata});

      // FIXME: we are hacking this to get something working.
      // Either we should stop using a firebase function to make the metadata document,
      // or we should wait for the function to finish making the document before returning its
      // contents.
      return firestoreMetadata;
    } else {
      return docSnapshot.data() as IDocumentMetadata;
    }
  }

  private get currentProblemInfo() {
    const { investigation, problem, unit } = this.stores;
    return {
      investigation: String(investigation.ordinal),
      problem: String(problem.ordinal),
      unit: unit.code
    };
  }

  public async createDocument(params: { type: DBDocumentType, content?: string, title?: string }) {
    const { type, content, title } = params;
    const { user } = this.stores;

    return new Promise<{document: DBDocument, metadata: DBDocumentMetadata}>((resolve, reject) => {
      const documentRef = this.firebase.ref(this.firebase.getUserDocumentPath(user)).push();
      const documentKey = documentRef.key!;
      const metadataRef = this.firebase.ref(this.firebase.getUserDocumentMetadataPath(user, documentKey));
      const version = "1.0";
      const createdAt = firebase.database.ServerValue.TIMESTAMP as number;
      const {classHash, offeringId} = user;
      const self = {uid: user.id, documentKey, classHash};
      const document: DBDocument = {version, self, type};
      if (content) {
        document.content = content;
      }

      let metadata: DBDocumentMetadata;

      switch (type) {
        case PersonalDocument:
        case LearningLogDocument:
        case PersonalPublication:
        case LearningLogPublication:
          metadata = {version, self, createdAt, type, title};
          break;
        case PlanningDocument:
        case ProblemDocument:
        case ProblemPublication:
        case SupportPublication:
          metadata = {version, self, createdAt, type, classHash, offeringId};
          break;
      }

      return documentRef.set(document)
        .then(() => {
          metadataRef.set(metadata);
          return metadataRef.once("value");
        })
        .then((metadataValue) => {
          // This approach of reading the value that was written in the metadata
          // causes the createdAt timestamp to be populated with a value
          this.createFirestoreMetadataDocument(metadataValue.val(), documentKey);
        })
        .then(() => {
          resolve({document, metadata});
        })
        .catch(reject);
    });
  }

  public createPersonalDocument(params: ICreateOtherDocumentParams) {
    return this.createOtherDocument(PersonalDocument, params);
  }

  public async findFirestoreMetadata(documentKey: string) {
    console.log("DB.findFirestoreMetadata");
    const { user } = this.stores;

    const converter = typeConverter<IDocumentMetadata>();
    const docByKey = this.firestore.collection("documents")
      .withConverter(converter)
      .where("context_id", "==", user.classHash)
      .where("key", "==", documentKey);

    // TODO: I suspect I'll need an new index for this to work
    const maybeDoc = await docByKey.get();

    if (maybeDoc.empty) {
      return undefined;
    } else {
      return maybeDoc.docs[0].data();
    }
  }

  public async getOrCreateGroupDocument() {
    console.log("DB.getOrCreateGroupDocument");
    const { user } = this.stores;
    const groupId = user.currentGroupId;
    if (!groupId) {
      return Promise.reject("Cannot create group document because user is not in a group.");
    }

    const converter = typeConverter<IDocumentMetadata>();
    const findCurrentGroupDoc = this.firestore.collection("documents")
      .withConverter(converter)
      .where("context_id", "==", user.classHash)
      .where("offeringId", "==", user.offeringId)
      .where("groupId", "==", groupId);

    const maybeGroupDoc = await findCurrentGroupDoc.get();

    let firestoreMetadata: IDocumentMetadata | undefined;

    // FIXME: this should be done in a transaction so if someone else
    // creates a group document before we won't get two group docs
    // I'm pretty sure doing this requires the creation of the firestore
    // metadata document to be done using client side firestore instead
    // of having a firebase function create it.
    if (maybeGroupDoc.empty) {

      // This is generating a new document key with the push method.
      const path = this.firebase.getGroupDocumentPath(user, groupId);
      console.log("group document path:", path);
      const documentRef = this.firebase.ref(path).push();
      const documentKey = documentRef.key!;
      const version = "1.0";
      // FIXME: This value is currently passed to a firebase function which actually creates the
      // document if necessary. In the past the value was based on the a firebase realtime db timestamp
      // that was generated when the metadata was written to the realtime db. In this case we are
      // trying to skip the firebase realtime db metadata. Because this is going through a function it
      // doesn't handle a client side created serverTimestamp value properly.
      // I can think of a couple ways to fix this:
      // 1) change the firebase function to not require createdAt to be passed in and then generate it
      // if it isn't set.
      // 2) bypass the function and just create the firestore document directly in the database. There
      // might be some other server side code that is relying on the function though, so we have to
      // check this first.
      // In the meantime we are just going to make a client side timestamp.
      // const createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const createdAt = Date.now();
      const {classHash, offeringId} = user;
      const self = {
        // We use a fake uid for group documents so this field is always defined.
        uid: `group_${user.offeringId}_${groupId}`,
        // We also include the groupId here for easier querying
        groupId,
        documentKey,
        classHash
      };
      const document: DBGroupDocument = {version, self, type: GroupDocument};

      await documentRef.set(document);
      const metadata: CreateFirestoreMetadata = {
        version,
        self,
        createdAt,
        type: GroupDocument,
        classHash,
        offeringId
      };
      firestoreMetadata = await this.createFirestoreMetadataDocument(metadata, documentKey);
    } else {
      firestoreMetadata = maybeGroupDoc.docs[0].data();
      if (!firestoreMetadata) {
        throw new Error("Could not retrieve firestore metadata for existing group document.");
      }
    }

    return await this.openGroupDocument(firestoreMetadata);
  }

  public publishProblemDocument(documentModel: DocumentModelType) {
    const {user, groups} = this.stores;
    // JSON content with modified unique ids which will break the history
    const content = documentModel.content?.publish();
    if (!content) {
      throw new Error("Could not publish the specified document because its content is not available.");
    }
    let pubCount = documentModel.getNumericProperty("pubCount");
    documentModel.setNumericProperty("pubCount", ++pubCount);
    return new Promise<{document: DBDocument, metadata: DBPublicationDocumentMetadata}>((resolve, reject) => {
      this.createDocument({ type: ProblemPublication, content }).then(({document, metadata}) => {
        const publicationRef = this.firebase.ref(this.firebase.getProblemPublicationsPath(user)).push();
        const userGroup = groups.getGroupById(user.currentGroupId);
        const groupUserConnections: DBGroupUserConnections | undefined = userGroup && userGroup.activeUsers
          .filter(groupUser => groupUser.id !== user.id)
          .reduce((allUsers: DBGroupUserConnections, groupUser) => {
            allUsers[groupUser.id] = groupUser.connected;
            return allUsers;
          }, {});
        const groupProps = userGroup ? { groupId: userGroup.id, groupUserConnections } : {};
        const publication: DBPublication = {
          version: "1.0",
          self: {
            classHash: user.classHash,
            offeringId: user.offeringId,
          },
          documentKey: document.self.documentKey,
          userId: user.id,
          pubVersion: pubCount,
          ...groupProps
        };

        publicationRef.set(publication)
          .then(() => {
            logDocumentEvent(LogEventName.PUBLISH_DOCUMENT, { document: documentModel });
            resolve({document, metadata: metadata as DBPublicationDocumentMetadata});
          })
          .catch(reject);
      });
    });
  }

  public publishOtherDocument(documentModel: DocumentModelType) {
    const {user} = this.stores;
    const content = documentModel.content?.publish();
    if (!content) {
      throw new Error("Could not publish the specified document because its content is not available.");
    }
    const publicationType = documentModel.type + "Publication" as DBDocumentType;
    let pubCount = documentModel.getNumericProperty("pubCount");
    documentModel.setNumericProperty("pubCount", ++pubCount);
    return new Promise<{document: DBDocument, metadata: DBPublicationDocumentMetadata}>((resolve, reject) => {
      this.createDocument({ type: publicationType, content, title: documentModel.title })
      .then(({document, metadata}) => {
        const publicationPath = publicationType === "personalPublication"
                                ? this.firebase.getPersonalPublicationsPath(user)
                                : this.firebase.getLearningLogPublicationsPath(user);
        const publicationRef = this.firebase.ref(publicationPath).push();
        const publication: DBOtherPublication = {
          version: "1.0",
          self: {
            classHash: user.classHash,
            documentKey: document.self.documentKey,
          },
          uid: user.id,
          title: documentModel.title || "",
          properties: documentModel.copyProperties(),
          originDoc: documentModel.key,
          pubVersion: pubCount,
        };
        publicationRef.set(publication)
          .then(() => {
            logDocumentEvent(LogEventName.PUBLISH_DOCUMENT, { document: documentModel });
            resolve({document, metadata: metadata as DBPublicationDocumentMetadata});
          })
          .catch(reject);
      });
    });
  }

  public publishDocumentAsSupport(documentModel: DocumentModelType, caption: string) {
    const publishSupport = getFirebaseFunction<IPublishSupportParams>("publishSupport_v1");
    const { problemPath, user } = this.stores;
    const { offeringId: resource_link_id, activityUrl: resource_url = "" } = user;
    const content = documentModel.content?.publish();
    let pubCount = documentModel.getNumericProperty("pubCount");
    documentModel.setNumericProperty("pubCount", ++pubCount);
    if (!content) {
      throw new Error("Could not publish the specified document because its content is not available.");
    }
    return publishSupport?.({
      context: this.stores.userContextProvider.userContext,
      caption,
      problem: problemPath,
      classes: user.classHashesForProblemPath(problemPath),
      properties: documentModel.copyProperties(),
      originDoc: documentModel.key,
      originDocType: documentModel.type,
      content,
      resource_link_id,
      resource_url,
      pubVersion: pubCount,
    });
  }

  public openDocument(options: OpenDocumentOptions) {
    const { documents } = this.stores;
    const {documentKey, type, title, properties, userId, groupId, visibility, originDoc, pubVersion,
           problem, investigation, unit} = options;
    const existingPromise = this.documentFetchPromiseMap.get(documentKey);
    if (existingPromise) return existingPromise;

    const documentFetchPromise = new Promise<DocumentModelType>((resolve, reject) => {
      const {user} = this.stores;
      const documentPath = this.firebase.getUserDocumentPath(user, documentKey, userId);
      const metadataPath = this.firebase.getUserDocumentMetadataPath(user, documentKey, userId);
      const documentRef = this.firebase.ref(documentPath);
      const metadataRef = this.firebase.ref(metadataPath);

      return Promise.all([documentRef.once("value"), metadataRef.once("value")])
        .then(([documentSnapshot, metadataSnapshot]) => {
          const document: DBDocument|null = documentSnapshot.val();
          const metadata: DBDocumentMetadata|null = metadataSnapshot.val();
          if (!metadata) {
            // if we have no metadata, there's nothing we can do
            const msg = `Error retrieving metadata for ` +
                        `document '${documentKey}' of type '${type}' for user '${userId}' ` +
                        `at '${firebaseRefPath(metadataRef)}'`;
            throw new Error(msg);
          }
          if (!document) {
            // If we have metadata but no document content, we can return a valid empty document.
            // This has been seen to occur in the wild, presumably as a result of a prior bug.
            const msg = "Warning: Reconstituting empty contents for " +
                        `document '${documentKey}' of type '${type}' for user '${userId}' ` +
                        `at '${firebaseRefPath(documentRef)}'`;
            console.warn(msg);
            return createDocumentModel({
                                  type, title, properties, groupId, visibility, uid: userId, originDoc, pubVersion,
                                  key: documentKey, createdAt: metadata.createdAt, content: {}, changeCount: 0 });
          }

          const content = this.parseDocumentContent(document);
          try {
            return createDocumentModel({
              type,
              title,
              properties: { ...properties, ...metadata.properties },
              groupId,
              visibility: visibility || metadata.visibility,
              uid: userId,
              originDoc,
              key: document.self.documentKey,
              createdAt: metadata.createdAt,
              content: content ? content : {},
              changeCount: document.changeCount,
              pubVersion,
              problem,
              investigation,
              unit
            });
          } catch (e) {
            const msg = "Could not open " +
                        `document '${documentKey}' of type '${type}' for user '${userId}'.` +
                        "This is because DocumentModel.create failed.\n";
            console.error(msg, e);
            throw e;
          }
        })
        .then((document) => {
          documents.add(document);
          resolve(document);
        })
        .catch((msg) => {
          // TODO: this rejected promise is not handled by the callers of openDocument. Most of those
          // callers trace back to firebase listeners. The listener is triggered by some existing or new
          // entry representing a document. The listener then tries to create a document from the
          // information. If an error happens this document is likely not added to the documents list.
          // The document will likely not ever be seen by the user.
          // The best thing to do here seems to be to add error handling in these listeners so they can
          // print out a useful error message. Ideally the message should include the paths in firebase
          // that were accessed, and what data was missing or invalid. Getting all of this information
          // will probably require additional logging a lower level.
          // After this is changed, the updated error reporting should be tested to make sure it
          // continues show a stack trace pointing at the original error site.
          // For example just calling console.error(msg) here will hide the original stack trace.
          reject(msg);
        });
    });

    this.documentFetchPromiseMap.set(documentKey, documentFetchPromise);
    return documentFetchPromise;
  }

  public openGroupDocument(firestoreMetadata: IDocumentMetadata) {
    const { documents } = this.stores;
    const { key: documentKey, type, title, properties, uid: userId, groupId, visibility,
           originDoc,
           problem, investigation, unit,
           createdAt } = firestoreMetadata;
    const existingPromise = this.documentFetchPromiseMap.get(documentKey);
    if (existingPromise) return existingPromise;

    if (type !== GroupDocument) {
      throw new Error(`Cannot open group document with type '${type}'`);
    }

    const documentFetchPromise = new Promise<DocumentModelType>((resolve, reject) => {
      const {user} = this.stores;
      const documentPath = this.firebase.getGroupDocumentPath(user, groupId!, documentKey);
      const documentRef = this.firebase.ref(documentPath);

      return documentRef.once("value").then((documentSnapshot) => {
        const document: DBGroupDocument|null = documentSnapshot.val();
        if (!document) {
          const msg = `Error retrieving group document '${documentKey}' of type '${type}' ` +
                      `for group '${groupId}' at '${firebaseRefPath(documentRef)}'`;
          throw new Error(msg);
        }
        const content = this.parseDocumentContent(document);
        try {
          return createDocumentModel({
            type,
            properties,
            groupId,
            visibility: visibility || "private",
            uid: userId, // TODO: this could be computed instead of needing to be passed in, see createGroupDocument
            key: document.self.documentKey,
            createdAt,
            content: content ? content : {},
            changeCount: document.changeCount,

            // The following props are sometimes null in Firestore on the metadata docs.
            // For consistency we make them undefined which is what openDocument
            // expects.
            title: title ?? undefined,
            originDoc: originDoc ?? undefined,
            problem: problem ?? undefined,
            investigation: investigation ?? undefined,
            unit: unit ?? undefined
          });
        } catch (e) {
          const msg = "Could not open " +
                      `group document '${documentKey}' of type '${type}' for group '${groupId}'.` +
                      "This is because DocumentModel.create failed.\n";
          console.error(msg, e);
          throw e;
        }
      })
      .then((document) => {
        // Not clear if we should add group documents to the main documents store.
        // For now we do, to keep the behavior similar to other document types.
        documents.add(document);
        resolve(document);
      })
      .catch((msg) => {
        // See comment in openDocument about unhandled rejected promises.
        reject(msg);
      });
    });

    this.documentFetchPromiseMap.set(documentKey, documentFetchPromise);
    return documentFetchPromise;
  }


  public createLearningLogDocument(title?: string) {
    return this.createOtherDocument(LearningLogDocument, { title });
  }

  // personal documents and learning logs
  public createOtherDocument(documentType: OtherDocumentType, params: ICreateOtherDocumentParams = {}) {
    const { title, properties, content } = params;
    const {appConfig, documents, user} = this.stores;
    const baseTitle = documentType === PersonalDocument
                        ? appConfig.defaultDocumentTitle
                        : appConfig.defaultLearningLogTitle;
    const docTitle = title || documents.getNextOtherDocumentTitle(user, documentType, baseTitle);

    return new Promise<DocumentModelType | null>((resolve, reject) => {
      return this.createDocument({ type: documentType, content: JSON.stringify(content), title: docTitle })
        .then(({document, metadata}) => {
          const {documentKey} = document.self;
          const newDocument: DBOtherDocument = {
            version: "1.0",
            self: {
              documentKey,
              uid: user.id,
              classHash: user.classHash
            },
            title: docTitle,
            properties: properties || {}
          };
          return this.firebase.ref(this.firebase.getOtherDocumentPath(user, documentType, documentKey))
                  .set(newDocument)
                  .then(() => newDocument);
        })
        .then(async (newDocument) => {
          const logEventName = documentType === PersonalDocument
                                ? LogEventName.CREATE_PERSONAL_DOCUMENT
                                : LogEventName.CREATE_LEARNING_LOG;
          Logger.log(logEventName, {
            title: newDocument.title
          });
          // reset the (presumably null) promise for this document type
          documents.addRequiredDocumentPromises([documentType]);
          // return the promise, which will be resolved by the DB listener
          return documents.requiredDocuments[documentType].promise;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public copyOtherDocument(document: DocumentModelType, options?: ICopyOtherDocumentParams) {
    const content = cloneContentWithUniqueIds(document.content, options?.asTemplate);
    const copyType = document.type === ProblemDocument ? PersonalDocument : document.type as OtherDocumentType;
    const originTitle = document.title
                          ? { properties: { originTitle: document.title } }
                          : undefined;
    const titleProps = options?.title
                        ? { title: options?.title, ...originTitle }
                        : undefined;
    return this.createOtherDocument(copyType, { content, ...titleProps });
  }

  public async destroyFirebaseDocument(document: DocumentModelType) {
    const { content, metadata, typedMetadata } =
      this.firebase.getDocumentPaths(this.stores.user, document);

    const destroyPromises = [this.firebase.ref(content).set(null)];
    if (metadata) {
      destroyPromises.push(this.firebase.ref(metadata).set(null));
    }
    if (typedMetadata) {
      destroyPromises.push(this.firebase.ref(typedMetadata).set(null));
    }
    await Promise.all(destroyPromises);
    this.stores.documents.resolveRequiredDocumentPromiseWithNull(document.type);
  }

  public createDocumentModelFromProblemMetadata(
          type: ProblemOrPlanningDocumentType, userId: string,
          metadata: DBOfferingUserProblemDocument) {
    const {documentKey} = metadata;
    const group = this.stores.groups.groupForUser(userId);
    const problemInfo = this.currentProblemInfo;
    return this.openDocument({
      type,
      userId,
      groupId: group?.id,
      documentKey,
      visibility: metadata.visibility,
      ...problemInfo
    });
  }

  public updateDocumentFromProblemDocument(document: DocumentModelType,
                                           problemDocument: DBOfferingUserProblemDocument) {
    document.setVisibility(problemDocument.visibility);
  }
  // handles personal documents and learning logs
  public createDocumentModelFromOtherDocument(dbDocument: DBOtherDocument, type: OtherDocumentType) {
    const {title, properties, self: {uid, documentKey}} = dbDocument;
    const group = this.stores.groups.groupForUser(uid);
    const groupId = group && group.id;
    return this.openDocument({type, userId: uid, documentKey, groupId, title, properties});
  }

  // handles published personal documents and published learning logs
  public createDocumentModelFromOtherPublication(publication: DBOtherPublication, type: OtherPublicationType) {
    const {title, properties, uid, originDoc, self: {documentKey}, pubVersion} = publication;

    const group = this.stores.groups.groupForUser(uid);
    const groupId = group && group.id;
    return this.openDocument({type, userId: uid, documentKey, groupId, title, properties, originDoc, pubVersion});
  }

  public createDocumentFromPublication(publication: DBPublication) {
    const {groupId, groupUserConnections, userId, documentKey, pubVersion} = publication;
    // groupUserConnections returns as an array and must be converted back to a map
    const groupUserConnectionsMap = Object.keys(groupUserConnections || [])
      .reduce((allUsers, groupUserId) => {
        if (groupUserConnections && groupUserConnections[groupUserId]) {
          allUsers[groupUserId] = groupUserConnections[groupUserId];
        }
        return allUsers;
      }, {} as DBGroupUserConnections);

    const problemInfo = this.currentProblemInfo;
    return this.openDocument({
      documentKey,
      type: "publication",
      userId,
      groupId,
      visibility: "public",
      groupUserConnections: groupUserConnectionsMap,
      pubVersion,
      ...problemInfo
    });
  }

  public parseDocumentContent(document: DBDocument) {
    return safeJsonParse<DocumentContentSnapshotType>(document.content);
  }

  public addImage(imageModel: ImageModelType) {
    const { user } = this.stores;
    return new Promise<{ image: DBImage }>((resolve, reject) => {
      const imageRef = this.firebase.ref(this.firebase.getImagesPath(user)).push();
      const imageKey = imageRef.key!;
      const version = "1.0";
      const self = {
        uid: user.id,
        classHash: user.classHash,
        imageKey
      };

      const createdAt = firebase.database.ServerValue.TIMESTAMP as number;
      const image: DBImage = {
        version,
        self,
        imageData: imageModel.imageData,
        title: imageModel.title || "unknown",
        originalSource: imageModel.originalSource || "unknown",
        createdAt,
        createdBy: user.id
      };

      return imageRef.set(image)
        .then(() => {
          resolve({ image });
        })
        .catch(reject);
    });
  }

  public getImage(imageKey: string) {
    const { user } = this.stores;
    return new Promise<DBImage>((resolve, reject) => {
      const imagePath = this.firebase.getImagesPath(user) + "/" + imageKey;
      const imageRef = this.firebase.ref(imagePath);
      return imageRef.once("value")
        .then((snapshot) => {
          resolve(snapshot.val());
        })
        .catch(reject);
    });
  }

  public getImageBlob(imageKey: string) {
    return this.getImage(imageKey)
            .then(image => {
              if (!image) throw new Error("Error: getImageBlob received invalid image!");
              return fetch(image.imageData);
            })
            .then(response => response.blob())
            .then(blob => URL.createObjectURL(blob));
  }

  public async getCloudImage(url: string) {
    const context = this.stores.userContextProvider.userContext;
    const getImageData = getFirebaseFunction<IGetImageDataParams>("getImageData_v1");
    const result = await getImageData({ context, url });
    return result?.data;
  }

  public getCloudImageBlob(url: string) {
    return this.getCloudImage(url)
            .then(image => image && fetch(image.imageData))
            .then(response => response?.blob())
            .then(blob => blob && URL.createObjectURL(blob));
  }

  public createLegacyTileComment(document: DocumentModelType, tileId: string, content: string, selectionInfo?: string) {
    const { user } = this.stores;
    const { key: docKey } = document;
    const commentsRef = this.firebase.ref(
      this.firebase.getUserDocumentCommentsPath(user, docKey, tileId)
    );
    const commentRef = commentsRef.push();
    const comment: DBTileComment = {
      timestamp: firebase.database.ServerValue.TIMESTAMP as number,
      uid: user.id,
      content,
    };
    if (selectionInfo) {
      comment.selectionInfo = selectionInfo;
    }
    commentRef.set(comment);
  }

  public deleteLegacyTileComment(docKey: string, tileId: string, commentKey: string) {
    const { user } = this.stores;
    const updateRef = this.firebase.ref(
      this.firebase.getUserDocumentCommentsPath(user, docKey, tileId, commentKey)
    );
    updateRef.update({
      deleted: true
    });
  }

  public createUserStar(docKey: string, starred: boolean) {
    const { user } = this.stores;
    const starsRef = this.firebase.ref(
      this.firebase.getUserDocumentStarsPath(user, docKey)
    );
    const starRef = starsRef.push();
    const star: DBUserStar = {
      timestamp: firebase.database.ServerValue.TIMESTAMP as number,
      uid: user.id,
      starred
    };
    starRef.set(star);
  }

  public setUserStarState(docKey: string, starKey: string, starred: boolean) {
    const { user } = this.stores;
    const updateRef = this.firebase.ref(
      this.firebase.getUserDocumentStarsPath(user, docKey, starKey)
    );
    updateRef.update({
      starred
    });
  }

  public createSupport(supportModel: SupportModelType,
                       sectionTarget: SectionTarget, audience: AudienceModelType) {
    const { user } = this.stores;
    const classSupportsRef = this.firebase.ref(
      this.firebase.getSupportsPath(user, audience, sectionTarget)
    );
    const supportRef = classSupportsRef.push();
    const support: DBSupport = {
      version: "1.0",
      self: {
        classHash: user.classHash,
        offeringId: user.offeringId,
        audienceType: audience.type,
        audienceId: audience.identifier || "",
        sectionTarget,
        key: supportRef.key!
      },
      uid: user.id,
      properties: {},
      originDoc: "",
      timestamp: firebase.database.ServerValue.TIMESTAMP as number,
      ...getSnapshot(supportModel),
      deleted: false
    };
    supportRef.set(support);
  }

  public deleteSupport(support: TeacherSupportModelType) {
    const { user } = this.stores;
    const { audience, key } = support;
    const dbSupportType: SectionTarget = support.sectionTarget;
    const updateRef = this.firebase.ref(this.firebase.getSupportsPath(user, audience, dbSupportType, key));
    updateRef.update({
      deleted: true
    });
  }

  public setLastStickyNoteViewTimestamp() {
    this.firebase.getLastStickyNoteViewTimestampRef().set(Date.now());
  }

  /**
   * Which students have gained access to this exemplar?
   * @param exemplarId
   * @returns a promise whose value will be a map from student IDs to visibility booleans.
   */
  public getExemplarVisibilityForClass(exemplarId: string): Promise<Record<string,boolean>> {
    // Search for records with paths like /classes/CLASS_ID/users/USER_ID/exemplars/EXEMPLAR_ID
    const { user } = this.stores;
    const myClass = this.stores.class;
    const classRef = this.firebase.ref(this.firebase.getClassPath(user));
    // Promises that will either return the ID of a student who has access, or undefined.
    const promises = myClass.students.map(student => {
      const ref = classRef.child('users').child(student.id).child('exemplars').child(exemplarId).child('visible');
      return ref.get().then((dataSnap) => {
        const visible = !!dataSnap.val();
        return {student: student.id, visible};
      });
    });
    return Promise.all(promises).then(values => {
      const map: Record<string,boolean> = {};
      for (const v of values) {
        map[v.student] = v.visible;
      }
      return map;
    });
  }

  public setExemplarVisibilityForUser(user: UserModelType, exemplarId: string, isVisible: boolean) {
    this.firebase.ref(this.firebase.getExemplarDataPath(user, exemplarId)).child('visible').set(isVisible);
  }

  public setExemplarVisibilityForAllStudents(exemplarId: string, isVisible: boolean) {
    const { user, documents } = this.stores;
    const myClass = this.stores.class;
    const classRef = this.firebase.ref(this.firebase.getClassPath(user));
    const exemplar = documents.getDocument(exemplarId);
    if (exemplar) {
      for (const student of myClass.students) {
        classRef.child('users').child(student.id).child('exemplars').child(exemplarId).child('visible').set(isVisible);
      }
      logExemplarDocumentEvent(LogEventName.EXEMPLAR_VISIBILITY_UPDATE,
        {
          document: exemplar,
          visibleToUser: isVisible,
          changeSource: "teacher"
        });
    } else {
      console.warn("Could not find exemplar document");
    }
  }

}

export function getRefFullPath(ref: firebase.database.Reference) {
  return ref.toString().substring(ref.root.toString().length-1);
}
