import * as firebase from "firebase";
import { AppMode, IStores } from "../models/stores";
import { UserModelType } from "../models/user";
import { onSnapshot } from "mobx-state-tree";
import { IDisposer } from "mobx-state-tree/dist/utils";
import { observable } from "mobx";
import { DBOfferingGroup,
         DBOfferingGroupUser,
         DBOfferingGroupMap,
         DBOfferingUser,
         DBDocumentMetadata,
         DBDocument,
         DBOfferingUserSectionDocument} from "./db-types";
import { WorkspaceModelType, WorkspaceModel } from "../models/workspaces";
import { DocumentModelType, DocumentModel } from "../models/document";
import { DocumentContentModel, DocumentContentModelType } from "../models/document-content";
import { ToolTileModel } from "../models/tools/tool-tile";
import { toolFactory } from "../models/tools/tool-types";

export type IDBConnectOptions = IDBAuthConnectOptions | IDBNonAuthConnectOptions;
export interface IDBAuthConnectOptions {
  appMode: "authed";
  rawFirebaseJWT: string;
  stores: IStores;
}
export interface IDBNonAuthConnectOptions {
  appMode: "dev" | "test" | "demo";
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

export interface ReferenceMap {
  [key: string]: firebase.database.Reference;
}
export interface DisposerMap {
  [key: string]: IDisposer;
}

export class DB {
  @observable public isListening = false;
  @observable public groups: GroupUsersMap = {};
  public _private = {
    parseDocumentContent: this.parseDocumentContent
  };
  private appMode: AppMode;
  private firebaseUser: firebase.User | null = null;
  private stores: IStores;
  private latestGroupIdRef: firebase.database.Reference | null = null;
  private groupsRef: firebase.database.Reference | null = null;
  private groupOnDisconnect: firebase.database.OnDisconnect | null = null;
  private connectedRef: firebase.database.Reference | null = null;
  private workspaceRef: firebase.database.Reference | null  = null;
  private userDocumentRefs: ReferenceMap = {};
  private userDocumentDisposers: DisposerMap = {};

  public get isConnected() {
    return this.firebaseUser !== null;
  }

  public connect(options: IDBConnectOptions) {
    return new Promise<void>((resolve, reject) => {
      if (this.isConnected) {
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
          this.firebaseUser = firebaseUser;
          this.stopListeners();
          this.startListeners().then(resolve).catch(reject);
        }
      });
    });
  }

  public disconnect() {
    this.stopListeners();

    if (this.appMode === "test") {
      // delete all test data (for this unique anonymous test user)
      return this.ref().set(null);
    }
  }

  public joinGroup(groupId: string) {
    const {user} = this.stores;
    const groupRef = this.ref(this.getGroupPath(user, groupId));
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
          return this.setConnectionHandlers(userRef);
        })
        .then(() => {
          // remember the last group joined
          return this.getLatestGroupIdRef().set(groupId);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public leaveGroup() {
    const {user} = this.stores;
    const groupsRef = this.ref(this.getGroupsPath(user));

    if (this.groupOnDisconnect) {
      this.groupOnDisconnect.cancel();
    }
    this.groupOnDisconnect = null;

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
              updates[this.getFullPath(this.getGroupUserPath(user, groupId))] = null;
            });
            return firebase.database().ref().update(updates);
          }
        })
        .then(() => {
          this.getLatestGroupIdRef().set(null);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public createWorkspace(sectionId: string) {
    return new Promise<WorkspaceModelType>((resolve, reject) => {

      const {user, workspaces, ui} = this.stores;
      const offeringUserRef = this.ref(this.getOfferingUserPath(user));
      const sectionDocumentRef = this.ref(this.getSectionDocumentPath(user, sectionId));

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
            return this.createDocument()
              .then((document) => {
                  sectionDocument = {
                    version: "1.0",
                    self: {
                      classHash: user.classHash,
                      offeringId: user.offeringId,
                      uid: user.id,
                      sectionId
                    },
                    visibility: "public",
                    documentKey: document.self.documentKey,
                  };
                  return sectionDocumentRef.set(sectionDocument).then(() => sectionDocument!);
              });
          }
        })
        .then((sectionDocument) => {
          return this.openWorkspace(sectionDocument.self.sectionId);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  public openWorkspace(sectionId: string) {
    const { user } = this.stores;

    return new Promise<WorkspaceModelType>((resolve, reject) => {
      const sectionDocumentRef = this.ref(this.getSectionDocumentPath(user, sectionId));
      return sectionDocumentRef.once("value")
        .then((snapshot) => {
          const sectionDocument: DBOfferingUserSectionDocument|null = snapshot.val();
          if (!sectionDocument) {
            throw new Error("Unable to find workspace document in db!");
          }
          return sectionDocument;
        })
        .then((sectionDocument) => {
          return this.createWorkspaceFromSectionDocument(user.id, sectionDocument);
        })
        .then((workspace) => {
          // TODO: PT #159980227: open group documents and listen for group changes
          resolve(workspace);
        })
        .catch(reject);
    });
  }

  public createDocument() {
    const {user} = this.stores;
    return new Promise<DBDocument>((resolve, reject) => {
      const documentRef = this.ref(this.getUserDocumentPath(user)).push();
      const documentKey = documentRef.key!;
      const metadataRef = this.ref(this.getUserDocumentMetadataPath(user, documentKey));
      const document: DBDocument = {
        version: "1.0",
        self: {
          uid: user.id,
          documentKey,
        }
      };
      const metadata: DBDocumentMetadata = {
        version: "1.0",
        self: {
          uid: user.id,
          documentKey,
        },
        createdAt: firebase.database.ServerValue.TIMESTAMP as number,
        classHash: user.classHash,
        offeringId: user.offeringId
      };

      return documentRef.set(document)
        .then(() => metadataRef.set(metadata))
        .then(() => {
          resolve(document);
        })
        .catch(reject);
    });
  }

  public openDocument(userId: string, offeringDoc: DBOfferingUserSectionDocument) {
    const {user, workspaces} = this.stores;
    const {documentKey} = offeringDoc;
    const sectionId = offeringDoc.self.sectionId;
    return new Promise<DocumentModelType>((resolve, reject) => {
      const documentRef = this.ref(this.getUserDocumentPath(user, documentKey, userId));
      const metadataRef = this.ref(this.getUserDocumentMetadataPath(user, documentKey, userId));

      Promise.all([documentRef.once("value"), metadataRef.once("value")])
        .then(([documentSnapshot, metadataSnapshot]) => {
          const document: DBDocument|null = documentSnapshot.val();
          const metadata: DBDocumentMetadata|null = metadataSnapshot.val();
          if (!document || !metadata) {
            throw new Error(`Unable to open document ${documentKey}`);
          }

          // TODO: When the 4-up code is merged, we need a flag to disable this monitoring when we're
          // just opening group mates' models
          this.userDocumentRefs[documentKey] = documentRef;
          documentRef.on("value", (snapshot) => {
            if (snapshot && snapshot.val()) {
              const updatedDoc: DBDocument = snapshot.val();
              const updatedContent = this.parseDocumentContent(updatedDoc);
              if (updatedContent) {
                const workspace = workspaces.getWorkspaceBySectionId(sectionId);
                if (workspace) {
                  workspace.userDocument.setContent(updatedContent);
                  this.monitorContentModel(updatedContent, documentRef, documentKey);
                }
              }
            }
          });

          const content = this.parseDocumentContent(document);
          return DocumentModel.create({
            uid: document.self.uid,
            key: document.self.documentKey,
            createdAt: metadata.createdAt,
            content: content ? content : {}
          });
        })
        .then((document) => {
          this.monitorContentModel(document.content, documentRef, documentKey);
          resolve(document);
        })
        .catch(reject);
    });
  }

  public ref(path: string = "") {
    if (!this.isConnected) {
      throw new Error("ref() requested before db connected!");
    }
    return firebase.database().ref(this.getFullPath(path));
  }

  public getFullPath(path: string = "") {
    return `${this.getRootFolder()}${path}`;
  }

  public getRootFolder() {
    // in the form of /(dev|test|demo|authed)/[<firebaseUserId> if dev or test]/portals/<escapedPortalDomain>
    const { appMode } = this;
    const parts = [`${appMode}`];

    if ((appMode === "dev") || (appMode === "test")) {
      parts.push(this.firebaseUser ? `${this.firebaseUser.uid}` : "no-user-id");
    }
    parts.push("portals");
    parts.push(this.escapeKey(this.stores.user.portal));

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
    return `${this.getUserPath(user)}/documentMetadata${suffix}`;
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

  public getSectionDocumentPath(user: UserModelType, sectionId?: string) {
    const suffix = sectionId ? `/${sectionId}` : "";
    return `${this.getOfferingUserPath(user)}/sectionDocuments${suffix}`;
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

  //
  // Listeners
  //

  private startListeners() {
    return new Promise<void>((resolve, reject) => {
      // listeners must start in this order so we know the latest group joined so we can autojoin groups if needed
      this.startLatestGroupIdListener()
        .then(() => {
          return this.startGroupsListener();
        })
        .then(() => {
          return this.startWorkspaceListener();
        })
        .then(() => {
          this.isListening = true;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  private stopListeners() {
    this.stopLatestGroupIdListener();
    this.stopGroupListeners();
    this.stopWorkspaceListener();
    this.stopUserDocListeners();
    this.isListening = false;
  }

  private startLatestGroupIdListener() {
    return new Promise<void>((resolve, reject) => {
      const latestGroupIdRef = this.latestGroupIdRef = this.getLatestGroupIdRef();
      // use once() so we are ensured that latestGroupId is set before we resolve
      latestGroupIdRef.once("value", (snapshot) => {
        this.handleLatestGroupIdRef(snapshot);
        latestGroupIdRef.on("value", this.handleLatestGroupIdRef);
      })
      .then(snapshot => {
        resolve();
      })
      .catch(reject);
    });
  }

  private getLatestGroupIdRef() {
    return this.ref(this.getUserPath(this.stores.user)).child("latestGroupId");
  }

  private stopLatestGroupIdListener() {
    if (this.latestGroupIdRef) {
      this.latestGroupIdRef.off("value");
      this.latestGroupIdRef = null;
    }
  }

  private stopUserDocListeners() {
    this.stopUserDocModelListeners();
    this.stopUserDocRefListeners();
  }

  private stopUserDocModelListeners() {
    Object.keys(this.userDocumentDisposers).forEach((docId) => {
      this.userDocumentDisposers[docId]();
    });
    this.userDocumentDisposers = {};
  }

  private stopUserDocRefListeners() {
    Object.keys(this.userDocumentRefs).forEach((docId) => {
      this.userDocumentRefs[docId].off("value");
    });
    this.userDocumentRefs = {};
  }

  private handleLatestGroupIdRef = (snapshot: firebase.database.DataSnapshot) => {
    this.stores.user.setLatestGroupId(snapshot.val() || undefined);
  }

  private startGroupsListener() {
    return new Promise<void>((resolve, reject) => {
      const {user, groups} = this.stores;
      const groupsRef = this.groupsRef = this.ref(this.getGroupsPath(user));

      // use once() so we are ensured that groups are set before we resolve
      groupsRef.once("value")
        .then((snapshot) => {
          const dbGroups: DBOfferingGroupMap = snapshot.val() || {};
          // Groups may be invalid at this point, but the listener will resolve it once connection times are set
          groups.updateFromDB(user.id, dbGroups, this.stores.class);

          const group = groups.groupForUser(user.id);
          if (group) {
            // update our connection time so we report as connected/disconnected
            const userRef = this.ref(this.getGroupUserPath(user, group.id));
            return this.setConnectionHandlers(userRef);
          }
          else if (user.latestGroupId) {
            // if we are not currently in a group try to join the latest group
            return this.joinGroup(user.latestGroupId);
          }
        })
        .then(() => {
          groupsRef.on("value", this.handleGroupsRef);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  private stopGroupListeners() {
    if (this.groupsRef) {
      this.groupsRef.off("value", this.handleGroupsRef);
      this.groupsRef = null;
    }
  }

  private startWorkspaceListener() {
    this.workspaceRef = this.ref(this.getSectionDocumentPath(this.stores.user));
    this.workspaceRef.on("child_added", this.handleWorkspaceChildAdded);
  }

  private stopWorkspaceListener() {
    if (this.workspaceRef) {
      this.workspaceRef.off("child_added", this.handleWorkspaceChildAdded);
    }
  }

  private handleWorkspaceChildAdded = (snapshot: firebase.database.DataSnapshot) => {
    const {user, workspaces, ui} = this.stores;
    const sectionDocument: DBOfferingUserSectionDocument|null = snapshot.val();
    if (sectionDocument && !workspaces.getWorkspaceBySectionId(sectionDocument.self.sectionId)) {
      this.createWorkspaceFromSectionDocument(user.id, sectionDocument)
        .then(workspaces.addWorkspace);
    }
  }

  private handleGroupsRef = (snapshot: firebase.database.DataSnapshot) => {
    const {user} = this.stores;
    const groups: DBOfferingGroupMap = snapshot.val() || {};
    const myGroupIds: string[] = [];
    const overSubscribedUserUpdates: any = {};

    // ensure that the current user is not in more than 1 group and groups are not oversubscribed
    Object.keys(groups).forEach((groupId) => {
      const groupUsers = groups[groupId].users || {};
      const userKeys = Object.keys(groupUsers);
      if (userKeys.indexOf(user.id) !== -1) {
        myGroupIds.push(groupId);
      }
      if (userKeys.length > 4) {
        // sort the users by connected timestamp and find the newest users to kick out
        const users = userKeys.map((uid) => groupUsers[uid]);
        users.sort((a, b) => a.connectedTimestamp - b.connectedTimestamp);
        users.splice(0, 4);
        users.forEach((userToRemove) => {
          const userPath = this.getFullPath(this.getGroupUserPath(user, groupId, userToRemove.self.uid));
          overSubscribedUserUpdates[userPath] = null;
        });
      }
    });

    // if there is a problem with the groups fix the problem in the next timeslice
    const numUpdates = Object.keys(overSubscribedUserUpdates).length;
    if ((numUpdates > 0) || (myGroupIds.length > 1)) {
      setTimeout(() => {
        if (numUpdates > 0) {
          firebase.database().ref().update(overSubscribedUserUpdates);
        }
        if (myGroupIds.length > 1) {
          this.leaveGroup();
        }
      }, 1);
    }
    else {
      // otherwise set the groups
      this.stores.groups.updateFromDB(user.id, groups, this.stores.class);
    }
  }

  private setConnectionHandlers(userRef: firebase.database.Reference) {
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

  private handleConnectedRef = (userRef: firebase.database.Reference, snapshot?: firebase.database.DataSnapshot, ) => {
    if (snapshot && snapshot.val()) {
      return userRef.child("connectedTimestamp").set(firebase.database.ServerValue.TIMESTAMP);
    }
  }

  private createWorkspaceFromSectionDocument(userId: string, sectionDocument: DBOfferingUserSectionDocument) {
    return this.openDocument(userId, sectionDocument)
      .then((userDocument) => {
        const workspace = WorkspaceModel.create({
          mode: "1-up",
          tool: "select",
          sectionId: sectionDocument.self.sectionId,
          userDocument,
          visibility: sectionDocument.visibility,
        });
        return workspace;
      });
  }

  private parseDocumentContent(document: DBDocument): DocumentContentModelType|null {
    if (!document.content) {
      return null;
    }

    const storedContent: DocumentContentModelType = JSON.parse(document.content);
    return DocumentContentModel.create({
      shared: storedContent.shared,
      tiles: storedContent.tiles.map((tile) => {
        const tileTool = toolFactory(tile.content);
        return ToolTileModel.create({
          id: tile.id,
          layout: tile.layout,
          content: tileTool.create(tile.content)
        });
      })
    });
  }

  private monitorContentModel = (content: DocumentContentModelType,
                                 updateRef: firebase.database.Reference,
                                 documentKey: string) => {
    if (this.userDocumentDisposers[documentKey]) {
      this.userDocumentDisposers[documentKey]();
    }
    this.userDocumentDisposers[documentKey] = (onSnapshot(content, (newContent) => {
      updateRef.update({
        content: JSON.stringify(newContent)
      });
    }));
  }

}
