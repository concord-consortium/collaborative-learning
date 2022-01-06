import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/firestore";
import "firebase/functions";
import "firebase/storage";
import { observable, makeObservable } from "mobx";
import {
  DBOfferingGroup, DBOfferingGroupUser, DBOfferingGroupMap, DBOfferingUser, DBDocumentMetadata, DBDocument,
  DBGroupUserConnections, DBPublication, DBPublicationDocumentMetadata, DBDocumentType, DBImage, DBTileComment,
  DBUserStar, DBOfferingUserProblemDocument, DBOtherDocument, IDocumentProperties, DBOtherPublication, DBSupport
} from "./db-types";
import { DocumentModelType, DocumentModel } from "../models/document/document";
import {
  DocumentType, LearningLogDocument, LearningLogPublication, OtherDocumentType, OtherPublicationType,
  PersonalDocument, PersonalPublication, PlanningDocument, ProblemDocument, ProblemOrPlanningDocumentType,
  ProblemPublication, SupportPublication
} from "../models/document/document-types";
import { SectionModelType } from "../models/curriculum/section";
import { SupportModelType } from "../models/curriculum/support";
import { ImageModelType } from "../models/image";
import { DocumentContentSnapshotType, DocumentContentModelType, cloneContentWithUniqueIds, createDefaultSectionedContent
       } from "../models/document/document-content";
import { Firebase } from "./firebase";
import { Firestore } from "./firestore";
import { DBListeners } from "./db-listeners";
import { Logger, LogEventName } from "./logger";
import { IStores } from "../models/stores/stores";
import { TeacherSupportModelType, SectionTarget, AudienceModelType } from "../models/stores/supports";
import { safeJsonParse } from "../utilities/js-utils";
import { urlParams } from "../utilities/url-params";

export enum Monitor {
  None = "None",
  Local = "Local",
  Remote = "Remote",
}

export type IDBConnectOptions = IDBAuthConnectOptions | IDBNonAuthConnectOptions;
export interface IDBBaseConnectOptions {
  stores: IStores;
  dontStartListeners?: boolean; // for unit tests
}
export interface IDBAuthConnectOptions extends IDBBaseConnectOptions {
  appMode: "authed";
  rawFirebaseJWT: string;
}
export interface IDBNonAuthConnectOptions extends IDBBaseConnectOptions {
  appMode: "dev" | "test" | "demo" | "qa";
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

export type DBClearLevel = "all" | "class" | "offering";

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
  groupId?: string;
  sectionId?: string;
  visibility?: "public" | "private";
  title?: string;
  properties?: IDocumentProperties;
  groupUserConnections?: Record<string, unknown>;
  originDoc?: string;
}

export class DB {
  @observable public groups: GroupUsersMap = {};
  public firebase: Firebase;
  public firestore: Firestore;
  public listeners: DBListeners;
  public stores: IStores;

  private authStateUnsubscribe?: firebase.Unsubscribe;

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
    return new Promise<void>((resolve, reject) => {
      if (this.firebase.isConnected) {
        reject("Already connected to database!");
      }

      // check for already being initialized for tests
      if (firebase.apps.length === 0) {
        const key = atob("QUl6YVN5QVV6T2JMblZESURYYTB4ZUxmSVpLV3BiLTJZSWpYSXBJ");
        firebase.initializeApp({
          apiKey: key,
          authDomain: "collaborative-learning-ec215.firebaseapp.com",
          databaseURL: "https://collaborative-learning-ec215.firebaseio.com",
          projectId: "collaborative-learning-ec215",
          storageBucket: "collaborative-learning-ec215.appspot.com",
          messagingSenderId: "112537088884",
          appId: "1:112537088884:web:c51b1b8432fff36faff221"
        });
      }

      if (urlParams.firebase) {
        // pass `firebase=emulator` to test against firebase emulator instance
        const url = new URL(urlParams.firebase === "emulator"
                              ? "http://localhost:9000" : urlParams.firebase);
        if (url.hostname && url.port) {
          firebase.database().useEmulator(url.hostname, parseInt(url.port, 10));
        }
      }

      if (urlParams.firestore) {
        // pass `firestore=emulator` to test against firestore emulator instance
        const url = new URL(urlParams.firestore === "emulator"
                              ? "http://localhost:8088" : urlParams.firestore);
        if (url.hostname && url.port) {
          firebase.firestore().useEmulator(url.hostname, parseInt(url.port, 10));
        }
      }

      if (urlParams.functions) {
        // pass `functions=emulator` to test against functions running in the emulator
        const url = new URL(urlParams.functions === "emulator"
                              ? "http://localhost:5001" : urlParams.functions);
        if (url.hostname && url.port) {
          firebase.functions().useEmulator(url.hostname, parseInt(url.port, 10));
        }
      }

      this.stores = options.stores;

      this.authStateUnsubscribe = firebase.auth().onAuthStateChanged((firebaseUser) => {
        // always stop existing listeners when firebase user changes
        this.listeners.stop();
        if (firebaseUser) {
          this.firebase.setFirebaseUser(firebaseUser);
          this.firestore.setFirebaseUser(firebaseUser);
          if (!options.dontStartListeners) {
            // resolve after listeners have started
            this.listeners.start().then(resolve).catch(reject);
          }
        }
      });

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

  public async guaranteePlanningDocument(sections: SectionModelType[]) {
    const {documents} = this.stores;

    const requiredPlanningDocument = documents.requiredDocuments[PlanningDocument];
    if (requiredPlanningDocument) {
      const planningDocument = await requiredPlanningDocument.promise;
      return planningDocument ||
              this.createProblemOrPlanningDocument(PlanningDocument, createDefaultSectionedContent(sections));
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
          if (!snapshot.val()) {
            const offeringUser: DBOfferingUser = {
              version: "1.0",
              self: {
                classHash: user.classHash,
                offeringId: user.offeringId,
                uid: user.id,
              }
            };
            return offeringUserRef.set(offeringUser);
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
          documents.addRequiredDocumentPromises([ProblemDocument]);
          // return the promise, which will be resolved by the DB listener
          return documents.requiredDocuments[ProblemDocument].promise;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public createDocument(params: { type: DBDocumentType, content?: string }) {
    const { type, content } = params;
    const {user} = this.stores;
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
          metadata = {version, self, createdAt, type};
          break;
        case PlanningDocument:
        case ProblemDocument:
        case ProblemPublication:
        case SupportPublication:
          metadata = {version, self, createdAt, type, classHash, offeringId};
          break;
      }

      return documentRef.set(document)
        .then(() => metadataRef.set(metadata))
        .then(() => {
          resolve({document, metadata});
        })
        .catch(reject);
    });
  }

  public createPersonalDocument(params: ICreateOtherDocumentParams) {
    return this.createOtherDocument(PersonalDocument, params);
  }

  public publishProblemDocument(documentModel: DocumentModelType) {
    const {user, groups} = this.stores;
    const content = documentModel.content?.publish();
    if (!content) {
      throw new Error("Could not publish the specified document because its content is not available.");
    }
    return new Promise<{document: DBDocument, metadata: DBPublicationDocumentMetadata}>((resolve, reject) => {
      this.createDocument({ type: ProblemPublication, content }).then(({document, metadata}) => {
        const publicationRef = this.firebase.ref(this.firebase.getPublicationsPath(user)).push();
        const userGroup = groups.groupForUser(user.id)!;
        const groupUserConnections: DBGroupUserConnections = userGroup && userGroup.users
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
          ...groupProps
        };

        publicationRef.set(publication)
          .then(() => {
            Logger.logDocumentEvent(LogEventName.PUBLISH_DOCUMENT, documentModel);
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
    return new Promise<{document: DBDocument, metadata: DBPublicationDocumentMetadata}>((resolve, reject) => {
      this.createDocument({ type: publicationType, content }).then(({document, metadata}) => {
        const publicationPath = publicationType === "personalPublication"
                                ? this.firebase.getClassPersonalPublicationsPath(user)
                                : this.firebase.getClassPublicationsPath(user);
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
          originDoc: documentModel.key
        };

        publicationRef.set(publication)
          .then(() => {
            Logger.logDocumentEvent(LogEventName.PUBLISH_DOCUMENT, documentModel);
            resolve({document, metadata: metadata as DBPublicationDocumentMetadata});
          })
          .catch(reject);
      });
    });
  }

  public publishDocumentAsSupport(documentModel: DocumentModelType, caption: string) {
    const { appMode, demo: { name: demoName }, user, problemPath } = this.stores;
    const content = documentModel.content?.publish();
    if (!content) {
      throw new Error("Could not publish the specified document because its content is not available.");
    }
    const fs = this.firestore;
    return fs.batch(batch => {
      const rootRef = fs.documentRef(fs.getRootFolder());
      batch.set(rootRef, { updatedAt: fs.timestamp() });
      const docRef = fs.newDocumentRef(fs.getMulticlassSupportsPath());
      batch.set(docRef, {
        appMode,
        demoName,
        classPath: this.firebase.getFullClassPath(user),
        uid: user.id,
        type: "supportPublication",
        createdAt: fs.timestamp(),
        properties: { teacherSupport: "true", caption, ...documentModel.copyProperties() },
        problem: problemPath,
        classes: user.classHashesForProblemPath(problemPath),
        originDoc: documentModel.key,
        content,
        // LTI fields
        platform_id: user.portal,
        context_id: user.classHash,
        resource_link_id: user.offeringId,
        resource_url: user.activityUrl || ""
      });
    });
  }

  public openDocument(options: OpenDocumentOptions) {
    const { documents } = this.stores;
    const {documentKey, type, title, properties, userId, groupId, visibility, originDoc} = options;
    return new Promise<DocumentModelType>((resolve, reject) => {
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
                        `document '${documentKey}' of type '${type}' for user '${userId}'`;
            throw new Error(msg);
          }
          if (!document) {
            // If we have metadata but no document content, we can return a valid empty document.
            // This has been seen to occur in the wild, presumably as a result of a prior bug.
            const msg = "Warning: Reconstituting empty contents for " +
                        `document '${documentKey}' of type '${type}' for user '${userId}'`;
            console.warn(msg);
            return DocumentModel.create({
                                  type, title, properties, groupId, visibility, uid: userId, originDoc,
                                  key: documentKey, createdAt: metadata.createdAt, content: {}, changeCount: 0 });
          }

          const content = this.parseDocumentContent(document);
          return DocumentModel.create({
            type,
            title,
            properties,
            groupId,
            visibility,
            uid: userId,
            originDoc,
            key: document.self.documentKey,
            createdAt: metadata.createdAt,
            content: content ? content : {},
            changeCount: document.changeCount
          });
        })
        .then((document) => {
          documents.add(document);
          resolve(document);
        })
        .catch(reject);
    });
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
      return this.createDocument({ type: documentType, content: JSON.stringify(content) })
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

  public openOtherDocument(documentType: OtherDocumentType, documentKey: string) {
    const { user } = this.stores;

    return new Promise<DocumentModelType>((resolve, reject) => {
      const documentPath = this.firebase.getOtherDocumentPath(user, documentType, documentKey);
      const documentRef = this.firebase.ref(documentPath);
      return documentRef.once("value")
        .then((snapshot) => {
          const document: DBOtherDocument|null = snapshot.val();
          if (!document) {
            throw new Error("Unable to find specified document!");
          }
          return document;
        })
        .then((document) => {
          return this.createDocumentModelFromOtherDocument(document, documentType);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public clear(level: DBClearLevel) {
    return new Promise<void>((resolve, reject) => {
      const {user} = this.stores;
      const clearPath = (path?: string) => {
        this.firebase.ref(path).remove().then(resolve).catch(reject);
      };

      if (this.stores.appMode !== "qa") {
        return reject("db#clear is only available in qa mode");
      }

      switch (level) {
        case "all":
          clearPath();
          break;
        case "class":
          clearPath(this.firebase.getClassPath(user));
          break;
        case "offering":
          clearPath(this.firebase.getOfferingPath(user));
          break;
        default:
          reject(`Invalid clear level: ${level}`);
          break;
      }
    });
  }

  public createDocumentModelFromProblemMetadata(
          type: ProblemOrPlanningDocumentType, userId: string,
          metadata: DBOfferingUserProblemDocument, monitor: Monitor) {
    const {documentKey} = metadata;
    const group = this.stores.groups.groupForUser(userId);
    return this.openDocument({
        type,
        userId,
        groupId: group?.id,
        documentKey,
        visibility: metadata.visibility
      })
      .then((document) => {
        if (monitor !== Monitor.None) {
          this.listeners.monitorDocument(document, monitor);
        }
        return document;
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
    return this.openDocument({type, userId: uid, documentKey, groupId, title, properties})
      .then((documentModel) => {
        this.listeners.monitorDocument(documentModel, Monitor.Local);
        return documentModel;
      });
  }

  // handles published personal documents and published learning logs
  public createDocumentModelFromOtherPublication(publication: DBOtherPublication, type: OtherPublicationType) {
    const {title, properties, uid, originDoc, self: {documentKey}} = publication;
    const group = this.stores.groups.groupForUser(uid);
    const groupId = group && group.id;
    return this.openDocument({type, userId: uid, documentKey, groupId, title, properties, originDoc});
  }

  public createDocumentFromPublication(publication: DBPublication) {
    const {groupId, groupUserConnections, userId, documentKey} = publication;

    // groupUserConnections returns as an array and must be converted back to a map
    const groupUserConnectionsMap = Object.keys(groupUserConnections || [])
      .reduce((allUsers, groupUserId) => {
        if (groupUserConnections && groupUserConnections[groupUserId]) {
          allUsers[groupUserId] = groupUserConnections[groupUserId];
        }
        return allUsers;
      }, {} as DBGroupUserConnections);

    return this.openDocument({
      documentKey,
      type: "publication",
      userId,
      groupId,
      visibility: "public",
      groupUserConnections: groupUserConnectionsMap,
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

  public async getCloudImage(url: string, type?: string, key?: string) {
    const { appMode, demo: { name: demoName }, user } = this.stores;
    const { portal, classHash } = user;
    const classPath = this.firebase.getFullClassPath(user);
    const getImageData = firebase.functions().httpsCallable("getImageData");
    const result = await getImageData({ url, appMode, demoName, portal, classHash, classPath, type, key });
    return result?.data;
  }

  public getCloudImageBlob(url: string, type?: string, key?: string) {
    return this.getCloudImage(url, type, key)
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

  public createUserStar(document: DocumentModelType, starred: boolean) {
    const { user } = this.stores;
    const { key: docKey } = document;
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
      ...supportModel,
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

  public setLastSupportViewTimestamp() {
    this.firebase.getLastSupportViewTimestampRef().set(Date.now());
  }

  public setLastStickyNoteViewTimestamp() {
    this.firebase.getLastStickyNoteViewTimestampRef().set(Date.now());
  }

}
