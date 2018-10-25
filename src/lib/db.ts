import * as firebase from "@concord-consortium/firebase/app";
import "@concord-consortium/firebase/auth";
import "@concord-consortium/firebase/database";
import "@concord-consortium/firebase/storage";
import { AppMode, IStores } from "../models/stores";
import { observable } from "mobx";
import { DBOfferingGroup,
         DBOfferingGroupUser,
         DBOfferingGroupMap,
         DBOfferingUser,
         DBDocumentMetadata,
         DBDocument,
         DBOfferingUserSectionDocument,
         DBLearningLog,
         DBPublicationDocumentMetadata,
         DBGroupUserConnections,
         DBPublication,
         DBDocumentType,
        } from "./db-types";
import { DocumentModelType,
         DocumentModel,
         DocumentType,
         SectionDocument,
         LearningLogDocument,
         PublicationDocument
        } from "../models/document";
import { DocumentContentSnapshotType } from "../models/document-content";
import { Firebase } from "./firebase";
import { DBListeners } from "./db-listeners";
import { Logger, LogEventName } from "./logger";

export type IDBConnectOptions = IDBAuthConnectOptions | IDBNonAuthConnectOptions;
export interface IDBAuthConnectOptions {
  appMode: "authed";
  rawFirebaseJWT: string;
  stores: IStores;
}
export interface IDBNonAuthConnectOptions {
  appMode: "dev" | "test" | "demo" | "qa";
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

export type DBClearLevel = "all" | "class" | "offering";

export interface OpenDocumentOptions {
  documentKey: string;
  type: DocumentType;
  userId: string;
  groupId?: string;
  sectionId?: string;
  visibility?: "public" | "private";
  title?: string;
  groupUserConnections?: {};
}

export class DB {
  @observable public groups: GroupUsersMap = {};
  public firebase: Firebase;
  public listeners: DBListeners;
  public stores: IStores;

  public creatingDocuments: string[] = [];

  private appMode: AppMode;

  constructor() {
    this.firebase = new Firebase(this);
    this.listeners = new DBListeners(this);
  }

  public connect(options: IDBConnectOptions) {
    return new Promise<void>((resolve, reject) => {
      if (this.firebase.isConnected) {
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
          this.firebase.user = firebaseUser;
          this.listeners.stop();
          this.listeners.start().then(resolve).catch(reject);
        }
      });
    });
  }

  public disconnect() {
    this.listeners.stop();

    if (this.appMode === "test") {
      // delete all test data (for this unique anonymous test user)
      return this.firebase.ref().set(null);
    }
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

  public createSectionDocument(sectionId: string) {
    return new Promise<DocumentModelType>((resolve, reject) => {
      this.creatingDocuments.push(sectionId);

      const {user, documents, ui} = this.stores;
      const offeringUserRef = this.firebase.ref(this.firebase.getOfferingUserPath(user));
      const sectionDocumentRef = this.firebase.ref(this.firebase.getSectionDocumentPath(user, sectionId));

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
          // check if the section document exists
          return sectionDocumentRef.once("value")
            .then((snapshot) => {
              return snapshot.val() as DBOfferingUserSectionDocument|null;
            });
        })
        .then((sectionDocument) => {
          if (sectionDocument) {
            return sectionDocument;
          }
          else {
            // create the document and section document
            return this.createDocument(SectionDocument)
              .then(({document, metadata}) => {
                  sectionDocument = {
                    version: "1.0",
                    self: {
                      classHash: user.classHash,
                      offeringId: user.offeringId,
                      uid: user.id,
                      sectionId
                    },
                    visibility: "private",
                    documentKey: document.self.documentKey,
                  };
                  return sectionDocumentRef.set(sectionDocument).then(() => sectionDocument!);
              });
          }
        })
        .then((sectionDocument) => {
          return this.openSectionDocument(sectionDocument.self.sectionId);
        })
        .then((sectionDocument) => {
          documents.add(sectionDocument);
          this.creatingDocuments.splice(this.creatingDocuments.indexOf(sectionId), 1);
          return sectionDocument;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public openSectionDocument(sectionId: string) {
    const { user } = this.stores;

    return new Promise<DocumentModelType>((resolve, reject) => {
      const sectionDocumentRef = this.firebase.ref(this.firebase.getSectionDocumentPath(user, sectionId));
      return sectionDocumentRef.once("value")
        .then((snapshot) => {
          const sectionDocument: DBOfferingUserSectionDocument|null = snapshot.val();
          if (!sectionDocument) {
            throw new Error("Unable to find document in db!");
          }
          return sectionDocument;
        })
        .then((sectionDocument) => {
          return this.createDocumentFromSectionDocument(user.id, sectionDocument);
        })
        .then((sectionDocument) => {
          this.listeners.updateGroupUserSectionDocumentListeners(sectionDocument);
          this.listeners.monitorSectionDocumentVisibility(sectionDocument);
          resolve(sectionDocument);
        })
        .catch(reject);
    });
  }

  public createDocument(type: DBDocumentType, content?: string) {
    const {user} = this.stores;
    return new Promise<{document: DBDocument, metadata: DBDocumentMetadata}>((resolve, reject) => {
      const documentRef = this.firebase.ref(this.firebase.getUserDocumentPath(user)).push();
      const documentKey = documentRef.key!;
      const metadataRef = this.firebase.ref(this.firebase.getUserDocumentMetadataPath(user, documentKey));
      const version = "1.0";
      const self = {uid: user.id, documentKey};
      const createdAt = firebase.database.ServerValue.TIMESTAMP as number;
      const {classHash, offeringId} = user;
      const document: DBDocument = {version, self, type};
      if (content) {
        document.content = content;
      }

      let metadata: DBDocumentMetadata;

      switch (type) {
        case SectionDocument:
          metadata = {version, self, createdAt, type, classHash, offeringId};
          break;
        case LearningLogDocument:
          metadata = {version, self, createdAt, type};
          break;
        case PublicationDocument:
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

  public publishDocument(documentModel: DocumentModelType) {
    const {user, groups} = this.stores;
    const content = JSON.stringify(documentModel.content);
    return new Promise<{document: DBDocument, metadata: DBPublicationDocumentMetadata}>((resolve, reject) => {
      this.createDocument(PublicationDocument, content).then(({document, metadata}) => {
        const publicationRef = this.firebase.ref(this.firebase.getPublicationsPath(user)).push();
        const userGroup = groups.groupForUser(user.id)!;
        const groupUserConnections: DBGroupUserConnections = userGroup.users
          .filter(groupUser => groupUser.id !== user.id)
          .reduce((allUsers: DBGroupUserConnections, groupUser) => {
            allUsers[groupUser.id] = groupUser.connected;
            return allUsers;
          }, {});
        const publication: DBPublication = {
          version: "1.0",
          self: {
            classHash: user.classHash,
            offeringId: user.offeringId,
          },
          documentKey: document.self.documentKey,
          groupId: userGroup.id,
          userId: user.id,
          sectionId: documentModel.sectionId!,
          groupUserConnections
        };

        publicationRef.set(publication)
          .then(() => {
            resolve({document, metadata: metadata as DBPublicationDocumentMetadata});
          })
          .catch(reject);
      });
    });
  }

  public openDocument(options: OpenDocumentOptions) {
    const {documentKey, type, title, userId, sectionId, groupId, visibility} = options;
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
          if (!document || !metadata) {
            throw new Error("Unable to open document");
          }

          const content = this.parseDocumentContent(document, true);
          return DocumentModel.create({
            type,
            title,
            sectionId,
            groupId,
            visibility,
            uid: userId,
            key: document.self.documentKey,
            createdAt: metadata.createdAt,
            content: content ? content : {}
          });
        })
        .then((document) => {
          resolve(document);
        })
        .catch(reject);
    });
  }

  public createLearningLogDocument(title: string) {
    const {user} = this.stores;

    return new Promise<DocumentModelType>((resolve, reject) => {
      return this.createDocument(LearningLogDocument)
        .then(({document, metadata}) => {
          const {documentKey} = document.self;
          const learningLog: DBLearningLog = {
            version: "1.0",
            self: {
              documentKey,
              uid: user.id,
            },
            title
          };
          return this.firebase.ref(this.firebase.getLearningLogPath(user, documentKey)).set(learningLog)
                  .then(() => learningLog);
        })
        .then((learningLog) => {
          Logger.log(LogEventName.CREATE_LEARNING_LOG, {
            title: learningLog.title
          });

          return this.createDocumentFromLearningLog(learningLog);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public openLearningLogDocument(documentKey: string) {
    const { user } = this.stores;

    return new Promise<DocumentModelType>((resolve, reject) => {
      const learningLogRef = this.firebase.ref(this.firebase.getLearningLogPath(user, documentKey));
      return learningLogRef.once("value")
        .then((snapshot) => {
          const learningLog: DBLearningLog|null = snapshot.val();
          if (!learningLog) {
            throw new Error("Unable to find learning log in db!");
          }
          return learningLog;
        })
        .then((learningLog) => {
          return this.createDocumentFromLearningLog(learningLog);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public clear(level: DBClearLevel) {
    return new Promise<void>((resolve, reject) => {
      const {user} = this.stores;
      const clearPath = (path?: string) => {
        this.firebase.ref(path).set(null).then(resolve).catch(reject);
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

  public createDocumentFromSectionDocument(userId: string, sectionDocument: DBOfferingUserSectionDocument) {
    const {documentKey} = sectionDocument;
    const {sectionId} = sectionDocument.self;
    const group = this.stores.groups.groupForUser(userId);
    return this.openDocument({
        type: SectionDocument,
        userId,
        groupId: group && group.id,
        documentKey,
        sectionId,
        visibility: sectionDocument.visibility
      })
      .then((document) => {
        this.listeners.monitorDocumentModel(document);
        this.listeners.monitorDocumentRef(document);
        return document;
      });
  }

  public createDocumentFromLearningLog(learningLog: DBLearningLog) {
    const {title, self: {uid, documentKey}} = learningLog;
    const group = this.stores.groups.groupForUser(uid);
    const groupId = group && group.id;
    return this.openDocument({type: LearningLogDocument, userId: uid, documentKey, groupId, title})
      .then((document) => {
        this.listeners.monitorDocumentModel(document);
        this.listeners.monitorDocumentRef(document);
        return document;
      });
  }

  public createDocumentFromPublication(publication: DBPublication) {
    const {user} = this.stores;
    const {groupId, sectionId, groupUserConnections, userId, documentKey} = publication;

    // groupUserConnections returns as an array and must be converted back to a map
    const groupUserConnectionsMap = Object.keys(groupUserConnections || [])
      .reduce((allUsers, groupUserId) => {
        allUsers[groupUserId] = groupUserConnections[groupUserId];
        return allUsers;
      }, {} as DBGroupUserConnections);

    return this.openDocument({
      documentKey,
      type: "publication",
      userId,
      groupId,
      sectionId,
      visibility: "public",
      groupUserConnections: groupUserConnectionsMap,
    });
  }

  public parseDocumentContent(document: DBDocument, deselect?: boolean): DocumentContentSnapshotType|undefined {
    if (document.content == null) {
      return undefined;
    }

    return JSON.parse(document.content);
  }
}
