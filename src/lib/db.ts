import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/storage";
import { AppMode, IStores } from "../models/stores/stores";
import { observable } from "mobx";
import { DBOfferingGroup, DBOfferingGroupUser, DBOfferingGroupMap, DBOfferingUser, DBDocumentMetadata, DBDocument,
  DBPublicationDocumentMetadata,
  DBGroupUserConnections, DBPublication, DBDocumentType, DBImage, DBSupport, DBTileComment,
  DBUserStar, DBOfferingUserProblemDocument, DBOfferingUserProblemDocumentMap,
  DBOtherDocument, DBOtherDocumentMap, IOtherDocumentProperties, DBOtherPublication } from "./db-types";
import { DocumentModelType, DocumentModel, DocumentType, PersonalDocument, ProblemDocument, LearningLogDocument,
        PersonalPublication, PublicationDocument, LearningLogPublication, OtherPublicationType, OtherDocumentType
       } from "../models/document/document";
import { SupportModelType } from "../models/curriculum/support";
import { ImageModelType } from "../models/image";
import { DocumentContentSnapshotType, DocumentContentModelType, cloneContentWithUniqueIds
       } from "../models/document/document-content";
import { Firebase } from "./firebase";
import { DBListeners } from "./db-listeners";
import { Logger, LogEventName } from "./logger";
import { TeacherSupportModelType, TeacherSupportSectionTarget, AudienceModelType } from "../models/stores/supports";
import { safeJsonParse } from "../utilities/js-utils";
import { find } from "lodash";

export enum Monitor {
  None = "None",
  Local = "Local",
  Remote = "Remote",
}

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

export interface ICreateOtherDocumentParams {
  title?: string;
  properties?: IOtherDocumentProperties;
  content?: DocumentContentModelType;
}

export interface OpenDocumentOptions {
  documentKey: string;
  type: DocumentType;
  userId: string;
  groupId?: string;
  sectionId?: string;
  visibility?: "public" | "private";
  title?: string;
  properties?: IOtherDocumentProperties;
  groupUserConnections?: {};
  originDoc?: string;
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

      firebase.auth().onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
          this.appMode = options.appMode;
          this.firebase.user = firebaseUser;
          this.listeners.stop();
          this.listeners.start().then(resolve).catch(reject);
        }
      });

      if (options.appMode === "authed") {
        return firebase.auth()
          .signInWithCustomToken(options.rawFirebaseJWT)
          .catch(reject);
      }
      else {
        return firebase.auth()
          .signInAnonymously()
          .catch(reject);
      }
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

  public async guaranteeOpenDefaultDocument(documentType: typeof ProblemDocument | typeof PersonalDocument,
                                            defaultContent?: DocumentContentModelType) {
    const {user, documents} = this.stores;

    // problem document
    if (documentType === ProblemDocument) {
      const problemDocument = documents.getProblemDocument(user.id);
      if (problemDocument) return problemDocument;

      const problemDocumentsRef = this.firebase.ref(this.firebase.getProblemDocumentsPath(user));
      const problemDocumentsSnapshot = await problemDocumentsRef.once("value");
      const problemDocuments: DBOfferingUserProblemDocumentMap = problemDocumentsSnapshot &&
                                                                  problemDocumentsSnapshot.val();
      const firstProblemDocument = find(problemDocuments, () => true);
      return firstProblemDocument
              ? this.openProblemDocument(firstProblemDocument.documentKey)
              : this.createProblemDocument(defaultContent);
    }

    // personal document
    const personalDocument = documents.getPersonalDocument(user.id);
    if (personalDocument) return personalDocument;

    const personalDocumentsRef = this.firebase.ref(this.firebase.getUserPersonalDocPath(user));
    const personalDocumentsSnapshot = await personalDocumentsRef.once("value");
    const personalDocuments: DBOtherDocumentMap = personalDocumentsSnapshot &&
                                                  personalDocumentsSnapshot.val();
    const firstPersonalDocument = find(personalDocuments, () => true);
    return firstPersonalDocument
      ? this.openOtherDocument(PersonalDocument, firstPersonalDocument.self.documentKey)
      : this.createPersonalDocument({ content: defaultContent });
  }

  public async guaranteeLearningLog(initialTitle?: string, defaultContent?: DocumentContentModelType) {
    const {user, documents} = this.stores;

    const learningLogDocument = documents.getLearningLogDocument(user.id);
    if (learningLogDocument) return learningLogDocument;

    const learningLogDocumentsRef = this.firebase.ref(this.firebase.getLearningLogPath(user));
    const learningLogDocumentsSnapshot = await learningLogDocumentsRef.once("value");
    const learningLogDocuments: DBOtherDocumentMap = learningLogDocumentsSnapshot &&
                                                  learningLogDocumentsSnapshot.val();
    const firstLearningLogDocument = find(learningLogDocuments, () => true);
    return firstLearningLogDocument
      ? this.openOtherDocument(LearningLogDocument, firstLearningLogDocument.self.documentKey)
      : this.createOtherDocument(LearningLogDocument, { title: initialTitle, content: defaultContent });
  }

  public createProblemDocument(content?: DocumentContentModelType) {
    return new Promise<DocumentModelType>((resolve, reject) => {
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
          return this.createDocument({ type: ProblemDocument, content: JSON.stringify(content) })
            .then(({document, metadata}) => {
                const newDocument = {
                  version: "1.0",
                  self: {
                    classHash: user.classHash,
                    offeringId: user.offeringId,
                    uid: user.id
                  },
                  visibility: "private",
                  documentKey: document.self.documentKey,
                };
                const newDocumentRef = this.firebase.ref(
                                        this.firebase.getProblemDocumentPath(user, document.self.documentKey));
                return newDocumentRef.set(newDocument).then(() => newDocument);
            });
        })
        .then((newDocument) => {
          return this.openProblemDocument(newDocument.documentKey);
        })
        .then((newDocument) => {
          documents.add(newDocument);
          this.creatingDocuments.splice(this.creatingDocuments.indexOf(newDocument.key), 1);
          return newDocument;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public openProblemDocument(documentKey?: string) {
    const { user } = this.stores;

    return new Promise<DocumentModelType>((resolve, reject) => {
      const problemDocumentsRef = this.firebase.ref(this.firebase.getProblemDocumentsPath(user));
      return problemDocumentsRef.once("value")
        .then((snapshot) => {
          const problemDocuments: DBOfferingUserProblemDocumentMap|null = snapshot.val();
          const found = find(problemDocuments, (document, key) => !documentKey || (key === documentKey));
          if (!found) throw new Error(`Unable to find document ${documentKey} in db!`);
          return found;
        })
        .then((problemDocument) => {
          return this.createDocumentFromProblemDocument(user.id, problemDocument, Monitor.Local);
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
          metadata = {version, self, createdAt, type};
          break;
        case ProblemDocument:
          metadata = {version, self, createdAt, type, classHash, offeringId};
          break;
        case LearningLogDocument:
          metadata = {version, self, createdAt, type};
          break;
        case PersonalPublication:
          metadata = {version, self, createdAt, type};
          break;
        case PublicationDocument:
          metadata = {version, self, createdAt, type, classHash, offeringId};
          break;
        case LearningLogPublication:
          metadata = {version, self, createdAt, type};
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
    const content = documentModel.content.publish();
    return new Promise<{document: DBDocument, metadata: DBPublicationDocumentMetadata}>((resolve, reject) => {
      this.createDocument({ type: PublicationDocument, content }).then(({document, metadata}) => {
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
    const content = documentModel.content.publish();
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

  public openDocument(options: OpenDocumentOptions) {
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
          if (!document || !metadata) {
            throw new Error("Unable to open document");
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

    return new Promise<DocumentModelType>((resolve, reject) => {
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
          return documents.getDocument(newDocument.self.documentKey) ||
                  await this.createDocumentModelFromOtherDocument(newDocument, documentType);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public copyOtherDocument(document: DocumentModelType, title: string) {
    const content = cloneContentWithUniqueIds(document.content);
    const copyType = document.type === ProblemDocument ? PersonalDocument : document.type as OtherDocumentType;
    return this.createOtherDocument(copyType, { title, content });
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

  public createDocumentFromProblemDocument(userId: string,
                                           problemDocument: DBOfferingUserProblemDocument,
                                           monitor: Monitor) {
    const {documentKey} = problemDocument;
    const group = this.stores.groups.groupForUser(userId);
    return this.openDocument({
        type: ProblemDocument,
        userId,
        groupId: group && group.id,
        documentKey,
        visibility: problemDocument.visibility
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
    return this.openDocument({type, userId: uid, documentKey, groupId, title, properties, originDoc})
      .then((document) => {
        return document;
      });
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

  public parseDocumentContent(document: DBDocument): DocumentContentSnapshotType|undefined {
    return safeJsonParse(document.content);
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
      const imageRef = this.firebase.ref(this.firebase.getImagesPath(user) + "/" + imageKey);
      return imageRef.once("value")
        .then((snapshot) => {
          resolve(snapshot.val());
        })
        .catch(reject);
    });
  }

  public getImageBlob(imageKey: string) {
    return this.getImage(imageKey)
            .then(image => fetch(image.imageData))
            .then(response => response.blob())
            .then(blob => URL.createObjectURL(blob));
  }

  public createTileComment(document: DocumentModelType, tileId: string, content: string, selectionInfo?: string) {
    const { user } = this.stores;
    const { key: docKey, uid: docUserId } = document;
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

  public deleteComment(docKey: string, tileId: string, commentKey: string) {
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
                       sectionTarget: TeacherSupportSectionTarget, audience: AudienceModelType) {
    const { user } = this.stores;
    const classSupportsRef = this.firebase.ref(
      this.firebase.getSupportsPath(user, audience, sectionTarget)
    );
    const supportRef = classSupportsRef.push();
    const support: DBSupport = {
      self: {
        classHash: user.classHash,
        offeringId: user.offeringId,
        audienceType: audience.type,
        audienceId: audience.identifier || "",
        sectionTarget,
        key: supportRef.key!
      },
      timestamp: firebase.database.ServerValue.TIMESTAMP as number,
      type: supportModel.type,
      content: supportModel.content,
      deleted: false
    };
    supportRef.set(support);
  }

  public deleteSupport(support: TeacherSupportModelType) {
    const { user } = this.stores;
    const { audience, key } = support;
    const dbSupportType: TeacherSupportSectionTarget = support.sectionTarget;
    const updateRef = this.firebase.ref(this.firebase.getSupportsPath(user, audience, dbSupportType, key));
    updateRef.update({
      deleted: true
    });
  }

}
