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
  DBGroupUserConnections, DBPublication, DBDocumentType, DBImage, DBTileComment,
  DBUserStar, DBOfferingUserProblemDocument, DBOtherDocument, IDocumentProperties, DBOtherPublication, DBSupport
} from "./db-types";
import { DocumentModelType, createDocumentModel, isVisibilityType } from "../models/document/document";
import {
  DocumentType, LearningLogDocument, LearningLogPublication, OtherDocumentType, OtherPublicationType,
  PersonalDocument, PersonalPublication, PlanningDocument, ProblemDocument, ProblemOrPlanningDocumentType,
  ProblemPublication, SupportPublication, GroupDocument, isDocumentType
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
import { getSimpleDocumentPath, IDocumentMetadata, IGetImageDataParams,
         IPublishSupportParams } from "../../shared/shared";
import {
  getDocumentKindMetadataFields, getDocumentLocationFields, getDocumentOwner, getDocumentOwnerFields,
  getDocumentAxisProfileName, getDocumentOwnerType, IDocumentOwnerContext, registerClassWideDocumentKind
} from "../models/document/document-kinds";
import { getClassOwnerId } from "../models/document/document-axes";
import { getFirebaseFunction } from "../hooks/use-firebase-function";
import { IStores } from "../models/stores/stores";
import { TeacherSupportModelType, SectionTarget, AudienceModelType } from "../models/stores/supports";
import { safeJsonParse } from "../utilities/js-utils";
import { typeConverter } from "../utilities/db-utils";
import { initializeApp } from "./firebase-config";
import { UserModelType } from "../models/stores/user";
import { GroupUserActivitySnapshot } from "../models/stores/group-activity";
import { logExemplarDocumentEvent } from "../models/document/log-exemplar-document-event";
import { AppMode } from "../models/stores/store-types";
import { DEBUG_FIRESTORE } from "./debug";
import { firebaseRefPath } from "./fire-utils";
import {
  getCanonicalPointerPath, ICanonicalPointer, kDefaultCanonicalDocumentLabel
} from "./scoped-document-pointers";

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
  offeringId?: string;
  /** The group the document's owning user belongs to, not the group that owns the document */
  groupIdOfUserOwner?: string;
  firestoreMetadata?: IDocumentMetadata;
}

interface IGetOrCreateCanonicalDocumentOpts {
  // The container holding the slot: the class, plus that container's own id when the document is kept
  // below the class. The slot's owner is not passed — it is derived from `kind`, the same way the
  // document's own `uid` is, so the pointer path and the document can never name different owners.
  container: { classHash: string; offeringId?: string; unit?: string };
  // The pointer slot's label. It is the path's final segment and is written to the winning document's
  // `canonical` field.
  canonicalLabel: string;
  // The document's stored `type` (transitional) and its `kind` axis. They coincide today for group documents;
  // a class-wide document keeps type === GroupDocument while its kind is the declared kind. The kind also drives
  // the owner uid (createDocument derives it via the kind registry).
  type: DBDocumentType;
  kind: string;
  findLegacy?: () => Promise<IDocumentMetadata | undefined>;
}

// What resolving a canonical slot yields: the key of the one document all of the clients resolving that slot
// have converged on, plus its Firestore metadata when the resolving path already holds it. A caller that only
// needs the clients to converge (createDeclaredClassWideDocuments) stops here; one that needs the document
// open passes it on to the open path.
interface IResolvedCanonicalDocument {
  documentKey: string;
  // Present when the resolving path already read or wrote the metadata as part of its work: the legacy
  // fallback, and the create path when it wins the pointer claim. Absent when the path only ever learns the
  // documentKey — the pointer fast path, and the create path's lost-race branch. Neither goes and fetches the
  // Firestore metadata: resolving is separated from opening precisely so a caller that only needs convergence
  // pays nothing extra for a document it is not going to open.
  firestoreMetadata?: IDocumentMetadata;
}

/**
 * The metadata shape written at creation: everything `IDocumentMetadata` declares, plus the fields only the
 * write side knows about.
 *
 * `axisProfile` is deliberately absent from `IDocumentMetadata`, `DocumentMetadataModel`, and
 * `DocumentModel`, so it is not reachable from the running app. It exists for migrations and offline
 * analysis, which read Firestore directly. Leaving it undeclared is what keeps it from becoming a thing the
 * runtime branches on — the axes stay the only way to ask how a document behaves, and a read of the profile
 * would have to add the field to a type first, which is a reviewable act rather than an accident.
 *
 * Undeclared fields survive the trip: `DocumentMetadataStore` typechecks raw Firestore data against
 * `DocumentMetadataModel`, and MST's `typecheck` ignores properties a model does not declare (pinned in
 * src/models/mst.test.ts). `canonical` already relies on this.
 */
type IDocumentMetadataAtCreation = IDocumentMetadata & {
  context_id: string;
  network: string | null;
  axisProfile?: string;
};

interface ICreateFirestoreMetadataDocumentOpts {
  documentKey: string;
  type: DBDocumentType;
  kind: string;
  owner: string;
  createdAt: number;
  title?: string;
}

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
            const persistentUIReady = persistentUI.initializePersistentUISync(user, db);

            // Resolve after listeners have started.
            // Before they can be started  we need to wait for the unit to be loaded,
            // since it includes the list of tile types being registered.
            // We need those types to be registered so the listeners can safely create documents.
            unitLoadedPromise.then(() => {
              this.listeners.start().then(resolve).catch(reject);
              exemplarController.initialize(this.stores);
              this.createDeclaredClassWideDocuments();

              // After unit config is available, apply default panel layout for first-time visitors
              persistentUIReady.then(() => {
                persistentUI.applyDefaultPanelLayout(this.stores.appConfig.defaultPanelLayout);
              }).catch((err) => {
                console.error("Error initializing persistent UI:", err);
              });
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

  /**
   * Finds all groups where a specific user is a member (usually 0 or 1, but handles edge cases)
   * @returns Array of group IDs
   */
  private findGroupsForUser(groups: DBOfferingGroupMap, userId: string): string[] {
    return Object.keys(groups).filter((groupId) => {
      const users = groups[groupId].users || {};
      return userId in users;
    });
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
          // always add the user to the group, the listeners will sort out if the student is in more than one group
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
          const groups: DBOfferingGroupMap = snapshot.val() || {};
          const myGroupIds = this.findGroupsForUser(groups, user.id);

          // set our user in each group to null
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

  /**
   * Creates an empty group with the specified group ID
   * @param groupId - The ID of the group to create
   * @returns Promise that resolves when the group is created
   */
  public async createEmptyGroup(groupId: string): Promise<void> {
    const { user } = this.stores;
    const groupPath = this.firebase.getFullPath(this.firebase.getGroupPath(user, groupId));

    const emptyGroup = {
      version: "1.0",
      self: {
        classHash: user.classHash,
        offeringId: user.offeringId,
        groupId,
      }
    } as DBOfferingGroup;

    const updates: Record<string, any> = {};
    updates[groupPath] = emptyGroup;

    await firebase.database().ref().update(updates);
  }

  /**
   * Moves a student from their current group to another. This is for both teacher use in managing
   * group assignments for any student in the class, and for students switching their own group.
   *
   * Unlike joinGroup/leaveGroup, this method:
   * - Can operate on any student (not just the current user)
   * - Sets up connection handlers only when the student being moved is the current user
   * - Updates latestGroupId only when the student being moved is the current user
   * - Uses a Firebase transaction to prevent race conditions when multiple clients modify groups
   *   concurrently (e.g., student opens multiple tabs, teacher and student act simultaneously)
   *
   * @param studentId - The ID of the student to move
   * @param targetGroupId - The ID of the group to move the student to, or null to remove from all groups
   * @returns Promise that resolves when the move is complete
   */
  public async moveStudentToGroup(studentId: string, targetGroupId: string | null): Promise<void> {
    const { user } = this.stores;
    const groupsRef = this.firebase.ref(this.firebase.getGroupsPath(user));

    await groupsRef.transaction((groups: DBOfferingGroupMap | null) => {
      if (groups === null) {
        groups = {};
      }

      // Find all groups where this student is currently a member
      const currentGroupIds = this.findGroupsForUser(groups, studentId);

      // Remove student from all current groups
      currentGroupIds.forEach((groupId) => {
        if (groups![groupId]?.users?.[studentId]) {
          delete groups![groupId].users![studentId];
        }
      });

      // If we have a target group, add the student to it
      if (targetGroupId !== null) {
        if (!groups[targetGroupId]) {
          groups[targetGroupId] = {
            version: "1.0",
            self: {
              classHash: user.classHash,
              offeringId: user.offeringId,
              groupId: targetGroupId,
            },
            users: {}
          };
        }

        if (!groups[targetGroupId].users) {
          groups[targetGroupId].users = {};
        }

        // Add the student to the target group.
        groups[targetGroupId].users![studentId] = {
          version: "1.0",
          self: {
            classHash: user.classHash,
            offeringId: user.offeringId,
            groupId: targetGroupId,
            uid: studentId
          },
          connectedTimestamp: firebase.database.ServerValue.TIMESTAMP as unknown as number
        };
      }

      return groups;
    });

    // If moving the current user, update their latestGroupId preference and set up connection handlers.
    // These operations are outside the transaction above because they operate on different database paths.
    if (studentId === this.stores.user.id) {
      this.firebase.cancelGroupDisconnect();

      await this.firebase.getLatestGroupIdRef().set(targetGroupId);

      // Set currentGroupId immediately so the UI updates without waiting for the DB listener.
      this.stores.user.setCurrentGroupId(targetGroupId ?? undefined);

      // Set up connection handlers so the user's online status is tracked.
      if (targetGroupId !== null) {
        const userRef = this.firebase.ref(this.firebase.getGroupUserPath(user, targetGroupId));
        await this.firebase.setConnectionHandlers(userRef);
      }
    }
  }

  private getGroupUserActivityPath(): firebase.database.Reference | undefined {
    const { user } = this.stores;
    const { currentGroupId } = user;
    if (currentGroupId) return this.firebase.ref(this.firebase.getGroupUserActivityPath(user, currentGroupId));
  }

  public setGroupUserActivity(activity: Omit<GroupUserActivitySnapshot, "userId" | "updatedAt">) {
    const ref = this.getGroupUserActivityPath();
    return ref
      ? ref.set({
          ...activity,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        })
      : Promise.resolve();
  }

  public clearGroupUserActivity() {
    const ref = this.getGroupUserActivityPath();
    return ref ? ref.remove() : Promise.resolve();
  }

  public setGroupUserActivityOnDisconnect() {
    const ref = this.getGroupUserActivityPath();
    if (!ref) return null;

    const handler = ref.onDisconnect();
    handler.remove();
    return handler;
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
      // Apply the planning template unless it has been explicitly switched off (undefined/legacy → apply).
      const content = appConfig.planningTemplateEnabled !== false ? appConfig.planningTemplate : undefined;
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
            .then(({document}) => {
                const newDocument: DBOfferingUserProblemDocument = {
                  version: "1.0",
                  self: {
                    classHash: user.classHash,
                    offeringId: user.offeringId,
                    uid: user.id
                  },
                  visibility: type === PlanningDocument
                                ? "private"
                                : this.stores.appConfig.defaultSharedDocuments ? "public" : "private",
                  documentKey: document.self.documentKey,
                };
                const newDocumentPath = type === PlanningDocument
                                          ? this.firebase.getPlanningDocumentPath(user, document.self.documentKey)
                                          : this.firebase.getProblemDocumentPath(user, document.self.documentKey);
                const newDocumentRef = this.firebase.ref(newDocumentPath);
                return newDocumentRef.set(newDocument).then(() => newDocument);
            });
        })
        .then(async (newDocument) => {
          // Open the just-created document directly. This avoids waiting for required documents system to
          // resolve it. The required documents system has a race condition in this code path. We still need
          // to trigger the required documents system though since that is needed when
          // createProblemOrPlanningDocument is called from the startup code.
          const document = await this.createDocumentModelFromProblemMetadata(type, user.id, newDocument);
          documents.addRequiredDocumentPromises([type]);
          documents.resolveRequiredDocumentPromise(document);
          return document;
        })
        .then(resolve)
        .catch(reject);
    });
  }

  async createFirestoreMetadataDocument(opts: ICreateFirestoreMetadataDocumentOpts): Promise<IDocumentMetadata> {
    const { documentKey, type, kind, owner, createdAt, title } = opts;
    const { user } = this.stores;
    const userContext = this.stores.userContextProvider.userContext;

    if (!this.stores.userContextProvider || !this.firestore || !userContext?.uid) {
      console.error("cannot create Firestore metadata document because environment is not valid",
        { userContext, firestore: this.firestore });
      throw new Error("cannot create Firestore metadata document because environment is not valid");
    }

    const documentPath = getSimpleDocumentPath(documentKey);
    const documentRef = this.firestore.doc(documentPath);
    const docSnapshot = await documentRef.get();

    if (docSnapshot.exists) {
      return docSnapshot.data() as IDocumentMetadata;
    }

    // Resolve where the document is kept and what it is about (context_id, unit/investigation/problem,
    // offeringId) from the kind's registered container.
    const locationFields = getDocumentLocationFields(kind, {
      ...this.currentProblemInfo,
      context_id: user.classHash,
      offeringId: user.offeringId,
    });

    // The owner's stored fields beyond `uid`: a group owner's `groupId`. The runtime value comes from the
    // stores; it is valid here because createDocument validated it via validateDocumentKindCreation before
    // writing (a group kind requires the user to be in a group, so currentGroupId is present).
    const ownerFields = getDocumentOwnerFields(kind, user.currentGroupId);

    // `title` is stamped only when present so Firestore never sees `title: undefined`.
    const titleInfo: { title?: string } = {};
    if (title != null) {
      titleInfo.title = title;
    }

    // Stamp the kind's axis fields (kind + concurrent), but only on type:"group" documents (group + class-wide).
    // Every kind is registered now for location/owner resolution, yet we deliberately do NOT persist `kind` on
    // other docs' Firestore metadata yet. We might change the list of kinds when we add full support for the
    // other document types, so we don't want to stamp a kind we'd then have to migrate. Add a type here as it
    // is converted — see "Which documents get stamped" in docs/document-axes/target-architecture.md.
    const kindFields = type === GroupDocument ? getDocumentKindMetadataFields(kind) : {};

    // The axis profile the document is created at, recorded so a later migration can select every document
    // made from one profile without querying the axis fields it is there to change. Gated with the kind
    // fields above, for the same reason.
    const profileName = type === GroupDocument ? getDocumentAxisProfileName(kind) : undefined;
    const profileField = profileName ? { axisProfile: profileName } : {};

    const firestoreMetadata: IDocumentMetadataAtCreation = {
      type,
      createdAt,
      // A creation-time snapshot that rules read back; storing it here is problematic — see the
      // `network` section in docs/document-metadata/metadata-fields.md. Null for students/group docs.
      network: userContext.network || null,
      key: documentKey,
      properties: {},
      uid: owner,
      ...titleInfo,
      ...ownerFields,
      ...locationFields,
      ...kindFields,
      ...profileField
    };
    await documentRef.set(firestoreMetadata);
    return firestoreMetadata;
  }

  private get currentProblemInfo() {
    const { investigation, problem, unit } = this.stores;
    return {
      investigation: String(investigation.ordinal),
      problem: String(problem.ordinal),
      unit: unit.code
    };
  }

  // The runtime context a group-scoped document needs, throwing when the user is not in a group with an
  // offering. Both a group document's owner id and its canonical-pointer path are keyed on
  // `group_<offeringId>_<groupId>`, so both values are required; returning them narrows them to strings.
  private requireGroupContext() {
    const { currentGroupId, offeringId } = this.stores.user;
    if (!currentGroupId || !offeringId) {
      throw new Error("Cannot create group document because user is not in a group with an offering.");
    }
    return { groupId: currentGroupId, offeringId };
  }

  // Verify the stores hold the runtime context a document of this kind needs to construct its owner and
  // location fields. Throws when the context is missing. Currently only group-owned kinds have a requirement.
  // The check lives here instead of the kind registry because it is easier for now.
  private validateDocumentKindCreation(kind: string) {
    if (getDocumentOwnerType(kind) === "group") {
      this.requireGroupContext();
    }
  }

  public async createDocument(
    params: { type: DBDocumentType, kind?: string, content?: string, title?: string }
  ) {
    // `kind` defaults to `type` so all documents have a kind, and we can
    // start to use the kind registry to manage all documents.
    const { type, kind = type, content, title } = params;
    const { user } = this.stores;

    this.validateDocumentKindCreation(kind);

    return new Promise<{
      document: DBDocument,
      firestoreMetadata: IDocumentMetadata
    }>((resolve, reject) => {
      // The owner (authoring identity, stored as `uid`) is chosen by the kind's registered owner type:
      // the creating user, the synthetic group owner, or the synthetic class owner. It is also the document's
      // storage-path owner — a document the user owns resolves to their own path (getUserPath: owner || user.id).
      const owner = getDocumentOwner(kind, this.documentOwnerContext);

      const documentPath = this.firebase.getUserDocumentPath(user, undefined, owner);
      const documentRef = this.firebase.ref(documentPath).push();
      const documentKey = documentRef.key!;
      const metadataPath = this.firebase.getUserDocumentMetadataPath(user, documentKey, owner);
      const metadataRef = this.firebase.ref(metadataPath);
      const version = "1.0";
      const createdAt = firebase.database.ServerValue.TIMESTAMP as number;
      const {classHash, offeringId} = user;

      const self = {
        uid: owner,
        documentKey,
        classHash
      };

      let rtdbMetadata: DBDocumentMetadata;
      // `type` can't be included because it is part of a discriminated union and must be a fresh literal
      const common = { version, self, createdAt } as const;

      if (type === GroupDocument) {
        // group + class-wide documents share the transitional type "group" and store only base RTDB metadata
        rtdbMetadata = { ...common, type };
      } else {
        switch (type) {
          case PersonalDocument:
          case LearningLogDocument:
          case PersonalPublication:
          case LearningLogPublication:
            rtdbMetadata = { ...common, type, title };
            break;
          case PlanningDocument:
          case ProblemDocument:
          case ProblemPublication:
          case SupportPublication:
            // Nothing here creates a SupportPublication: supports are written to `mcsupports` by a Cloud
            // Function using admin credentials. The case is listed so the switch stays exhaustive.
            // The top-level `classHash` here is actually never read, it is left for legacy consistency in the RTDB.
            // See docs/document-metadata/metadata-fields.md for details.
            rtdbMetadata = { ...common, type, classHash, offeringId };
            break;
          default:
            throw new Error(`Cannot create document of unsupported type '${type}'`);
        }
      }

      const document: DBDocument = {version, self, type};
      if (content) {
        document.content = content;
      }

      return documentRef.set(document)
        .then(() => {
          metadataRef.set(rtdbMetadata);
          return metadataRef.once("value");
        })
        .then((metadataValue) => {
          // Reading the value back resolves the server `createdAt` timestamp to a real number.
          // This way the RTDB and Firestore metadata have the same createdAt value.
          const resolvedCreatedAt: number = metadataValue.val().createdAt;
          return this.createFirestoreMetadataDocument({
            documentKey, type, kind, owner, createdAt: resolvedCreatedAt, title
          });
        })
        .then((firestoreMetadata) => {
          resolve({document, firestoreMetadata});
        })
        .catch(reject);
    });
  }

  public createPersonalDocument(params: ICreateOtherDocumentParams) {
    return this.createOtherDocument(PersonalDocument, params);
  }

  public async findFirestoreMetadata(documentKey: string) {
    // fetchMetadata throws when the document is missing or invalid; findFirestoreMetadata surfaces that
    // throw. openDocument and openCanonicalDocumentByKey require the metadata, and document-workspace
    // handles the throw in its try/catch.
    return this.stores.documentMetadata.fetchMetadata(documentKey);
  }

  public async getOrCreateGroupDocument() {
    const { user } = this.stores;
    const { groupId, offeringId } = this.requireGroupContext();
    // A group document is kept in the offering; its group-ness is its owner, which the kind supplies.
    // The slot is labeled "default" (the group's default canonical document) rather than by the
    // document's type — see kDefaultCanonicalDocumentLabel. For a regular group document the
    // transitional `type` and the `kind` coincide, both GroupDocument.
    return this.getOrCreateCanonicalDocument({
      container: { classHash: user.classHash, offeringId },
      canonicalLabel: kDefaultCanonicalDocumentLabel,
      type: GroupDocument,
      kind: GroupDocument,
      findLegacy: () => this.findLegacyGroupDocument(groupId)
    });
  }

  // Synthetic owner uid for this class's class-wide documents, minted by the same function hasClassOwner
  // reads back, so the two cannot drift.
  private get userIdForClassWideDocuments() {
    return getClassOwnerId(this.stores.user.classHash);
  }

  // Resolves the class onto its one document for this slot and stops there, returning that document's key
  // rather than the document. It is opened when someone opens it — from Sort Work
  // (SortedDocuments.fetchFullDocument) or, after a reload with it as the primary document, from
  // DocumentWorkspace — so unit load pays one pointer read rather than a metadata read, an RTDB fetch, and a
  // history subscription for every student on every load.
  // The caller's only job is convergence, so it discards the key; the key is returned because it is what
  // says which document the class converged on.
  private async resolveClassWideDocument(classWideDoc: { kind: string; title: string }) {
    const { user, unit } = this.stores;
    // For a class-wide document the canonical-pointer label equals the document's kind.
    // The document's transitional `type` stays GroupDocument while its `kind` is the declared kind.
    const { documentKey } = await this.resolveCanonicalDocument({
      container: { classHash: user.classHash, unit: unit.code },
      canonicalLabel: classWideDoc.kind,
      type: GroupDocument,
      kind: classWideDoc.kind
    });
    return documentKey;
  }

  // Auto-create each class-wide document the unit declares. Called once per unit open, after the unit is
  // loaded. Each is resolved but not opened: converging the class on one document per slot has to happen at
  // unit load, opening it does not. Each is resolved independently and fire-and-forget: the canonical-pointer
  // engine converges all class members to one document per declared kind, so a failure here never blocks app
  // startup.
  private createDeclaredClassWideDocuments() {
    const classWideDocs = this.stores.appConfig.classWideDocuments;
    if (!classWideDocs?.length) return;
    for (const classWideDoc of classWideDocs) {
      // Register each declared document's kind so createFirestoreMetadataDocument stamps its axis fields via the
      // registry and createDocument derives its owner and location — registerClassWideDocumentKind supplies the
      // shape every class-wide document shares. The unit passed is the same code stamped as the document's
      // `unit` (see currentProblemInfo). Registration validates the kind and rejects a duplicate (both throw);
      // skip a bad entry rather than crash startup.
      try {
        registerClassWideDocumentKind(classWideDoc.kind, classWideDoc.title, this.stores.unit.code);
      } catch (err) {
        console.error("Ignoring class-wide document:", classWideDoc.kind, err);
        continue;
      }
      this.resolveClassWideDocument(classWideDoc).catch((err) => {
        console.error("Failed to create class-wide document", classWideDoc.kind, err);
      });
    }
  }

  // The candidate owner uids for a document created in this session. getDocumentOwner picks among them by
  // the kind's registered owner type; both the document's stored `uid` and its canonical slot use this.
  private get documentOwnerContext(): IDocumentOwnerContext {
    const { user } = this.stores;
    return {
      userId: user.id,
      groupOwnerId: user.userIdForGroupDocuments,
      classOwnerId: this.userIdForClassWideDocuments
    };
  }

  // Resolve the slot and open what it points at. The metadata the resolver returns is used when it has one,
  // so opening a document the resolver just created or found by query costs no extra read.
  private async getOrCreateCanonicalDocument(opts: IGetOrCreateCanonicalDocumentOpts) {
    const { documentKey, firestoreMetadata } = await this.resolveCanonicalDocument(opts);
    return firestoreMetadata
      ? this.openDocumentFromFirestoreMetadata(firestoreMetadata)
      // resolveCanonicalDocument omits firestoreMetadata only when documentKey names a document it confirmed
      // exists without fetching its metadata — the fast path's pointer target, or the race loser's pointer
      // target — so opening by key here always finds one. If that invariant is ever broken,
      // openCanonicalDocumentByKey throws (the referenced document won't be found) rather than failing silently.
      : this.openCanonicalDocumentByKey(documentKey);
  }

  private async resolveCanonicalDocument(opts: IGetOrCreateCanonicalDocumentOpts): Promise<IResolvedCanonicalDocument> {
    const { container, type, kind, canonicalLabel, findLegacy } = opts;
    // The slot's owner is the same uid createDocument stamps on the document, from the same registry
    // call. firestore.rules builds the pointer path from the document's stored `uid`, so a claim whose
    // path named a different owner would be rejected rather than silently mis-slotted.
    const pointerPath = getCanonicalPointerPath({
      ...container,
      owner: getDocumentOwner(kind, this.documentOwnerContext),
      label: canonicalLabel
    });
    const pointerRef = this.firestore.doc(pointerPath);

    // 1. Fast path: pointer already exists. Only the pointer is read — the metadata is left to whoever
    // opens the document.
    const pointerSnap = await pointerRef.get();
    if (pointerSnap.exists) {
      return { documentKey: (pointerSnap.data() as ICanonicalPointer).documentKey };
    }

    // 2. Legacy fallback: pre-pointer group docs are found by query; backfill a pointer.
    if (findLegacy) {
      const legacy = await findLegacy();
      if (legacy) {
        await this.firestore.runTransaction(async (txn) => {
          const s = await txn.get(pointerRef);
          if (!s.exists) {
            txn.set(pointerRef, {
              documentKey: legacy.key, createdAt: this.firestore.timestamp(),
              createdBy: this.stores.user.id   // the real user backfilling the pointer, for provenance
            });
            txn.update(this.firestore.doc(getSimpleDocumentPath(legacy.key)), { canonical: canonicalLabel });
          }
        }).catch(() => undefined); // If the backfill txn throws (e.g. a concurrent caller already
        // claimed the pointer), swallow it — we still return the legacy doc below either way.
        return { documentKey: legacy.key, firestoreMetadata: legacy };
      }
    }

    // 3. Create document-first, then claim the pointer atomically.
    const { user } = this.stores;
    const { firestoreMetadata } = await this.createDocument({ type, kind });
    const documentKey = firestoreMetadata.key;

    const metadataRef = this.firestore.doc(getSimpleDocumentPath(documentKey));
    const wonKey = await this.firestore.runTransaction(async (txn) => {
      const s = await txn.get(pointerRef);
      if (s.exists) return (s.data() as ICanonicalPointer).documentKey;   // lost the race
      txn.set(pointerRef, {
        documentKey, createdAt: this.firestore.timestamp(),
        createdBy: user.id   // the real user who won the creation race, for provenance
      });
      txn.update(metadataRef, { canonical: canonicalLabel });
      return documentKey;
    });

    if (wonKey !== documentKey) {
      // The orphan lives under its own owner's path; that owner is the uid createDocument stamped.
      await this.deleteOrphanDocument(documentKey, firestoreMetadata.uid);
      return { documentKey: wonKey };
    }
    if (type === GroupDocument) {
      Logger.log(LogEventName.CREATE_GROUP_DOCUMENT);
    }
    return { documentKey, firestoreMetadata };
  }

  private async findLegacyGroupDocument(groupId: string): Promise<IDocumentMetadata | undefined> {
    const { user } = this.stores;
    const converter = typeConverter<IDocumentMetadata>();
    const query = this.firestore.collection("documents")
      .withConverter(converter)
      .where("context_id", "==", user.classHash)
      .where("offeringId", "==", user.offeringId)
      .where("groupId", "==", groupId);
    const result = await query.get();
    return result.empty ? undefined : result.docs[0].data();
  }

  private async openCanonicalDocumentByKey(documentKey: string) {
    // findFirestoreMetadata throws when the referenced document is missing or invalid.
    const metadata = await this.findFirestoreMetadata(documentKey);
    return this.openDocumentFromFirestoreMetadata(metadata);
  }

  // Best-effort cleanup of a document whose pointer claim was lost (a rare orphan). ownerId is the orphan's
  // owner uid (its RTDB storage path is under that owner); undefined falls back to the current user's path.
  private async deleteOrphanDocument(documentKey: string, ownerId?: string) {
    const { user } = this.stores;
    await Promise.all([
      this.firebase.ref(this.firebase.getUserDocumentPath(user, documentKey, ownerId)).remove(),
      this.firebase.ref(this.firebase.getUserDocumentMetadataPath(user, documentKey, ownerId)).remove(),
      this.firestore.doc(getSimpleDocumentPath(documentKey)).delete()
    ]).catch(() => undefined);
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
    return new Promise<{document: DBDocument}>((resolve, reject) => {
      this.createDocument({ type: ProblemPublication, content }).then(({document}) => {
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
            resolve({document});
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
    return new Promise<{document: DBDocument}>((resolve, reject) => {
      this.createDocument({ type: publicationType, content, title: documentModel.title })
      .then(({document}) => {
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
            resolve({document});
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
           problem, investigation, unit, offeringId, groupIdOfUserOwner} = options;
    const existingPromise = this.documentFetchPromiseMap.get(documentKey);
    if (existingPromise) return existingPromise;

    const documentFetchPromise = new Promise<DocumentModelType>((resolve, reject) => {
      const {user} = this.stores;
      const documentPath = this.firebase.getUserDocumentPath(user, documentKey, userId);
      const metadataPath = this.firebase.getUserDocumentMetadataPath(user, documentKey, userId);
      const documentRef = this.firebase.ref(documentPath);
      const metadataRef = this.firebase.ref(metadataPath);

      // fetchMetadata throws when the Firestore metadata is missing or invalid; that
      // rejection flows through Promise.all to the catch below.
      const firestoreMetadataPromise = options.firestoreMetadata
        ? Promise.resolve<IDocumentMetadata>(options.firestoreMetadata)
        : this.stores.documentMetadata.fetchMetadata(documentKey);

      return Promise.all([documentRef.once("value"), metadataRef.once("value"), firestoreMetadataPromise])
        .then(([documentSnapshot, metadataSnapshot, firestoreMetadata]) => {
          const document: DBDocument|null = documentSnapshot.val();
          const metadata: DBDocumentMetadata|null = metadataSnapshot.val();
          if (!metadata) {
            // if we have no metadata, there's nothing we can do
            const msg = `Error retrieving metadata for ` +
                        `document '${documentKey}' of type '${type}' for user '${userId}' ` +
                        `at '${firebaseRefPath(metadataRef)}'`;
            throw new Error(msg);
          }
          // MIGRATION (transitional — remove once the concurrent backfill script has run on production; see
          // docs/superpowers/specs/2026-07-23-clue-550-stage-1-document-axes-design.md).
          // Pre-existing group documents were created before `concurrent` was stamped, so their Firestore
          // metadata lacks it. The kind registry is the source of truth for which kinds are concurrent: derive
          // the value so the opened model's history manager runs in concurrent mode this session, and best-
          // effort write it back so the stored field converges (the batch script covers never-opened docs).
          const kindMetadataFields = getDocumentKindMetadataFields(firestoreMetadata.type);
          // Storage wins when it says true; otherwise fall back to the registry, treating any non-`true`
          // stored value as missing so it matches the write-back gate below.
          const concurrent =
            firestoreMetadata.concurrent === true ? true : (kindMetadataFields.concurrent ?? undefined);
          const kind = firestoreMetadata.kind ?? kindMetadataFields.kind ?? undefined;
          // Explicitly restrict the write-back to group documents. Every kind is now registered, so in theory
          // it'd be possible for someone to add a concurrent field to another document type and then we'd
          // accidentally update the firestore metadata. Add a type here as it is converted to the axes, and
          // drop the check once they all are — but note this write-back is made by the signed-in user, so an
          // axis the security rules enforce can't be stamped from here at all. See "Which documents get
          // stamped" in docs/document-axes/target-architecture.md.
          if (firestoreMetadata.type === GroupDocument
              && kindMetadataFields.concurrent && firestoreMetadata.concurrent !== true) {
            this.firestore.doc(getSimpleDocumentPath(documentKey))
              .set(kindMetadataFields, { merge: true })
              .catch((err: any) => console.warn("group-doc concurrent backfill failed", documentKey, err));
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
                                  key: documentKey, createdAt: metadata.createdAt, content: {}, changeCount: 0,
                                  contextId: firestoreMetadata.context_id ?? undefined,
                                  concurrent, kind });
          }

          const content = this.parseDocumentContent(document);
          try {
            const docModel = createDocumentModel({
              type,
              title,
              properties: { ...properties, ...metadata.properties },
              groupId,
              visibility: visibility || metadata.visibility,
              uid: userId,
              originDoc,
              key: documentKey,
              createdAt: metadata.createdAt,
              content: content ? content : {},
              changeCount: document.changeCount,
              pubVersion,
              problem,
              investigation,
              unit,
              offeringId,
              groupIdOfUserOwner,
              contextId: firestoreMetadata.context_id ?? undefined,
              concurrent,
              kind,
            });
            // Stash the envelope's lastHistoryEntryId for the drift check that
            // runs once the Firestore history loads. Skipped (undefined) for
            // pre-feature saves and fresh docs with no prior history.
            if (typeof document.lastHistoryEntryId === "string") {
              docModel.setSavedLastHistoryEntryId(document.lastHistoryEntryId);
            }
            return docModel;
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
          // This rejection is intentionally left unhandled by openDocument's callers (most trace back
          // to firebase listeners), so it surfaces as an unhandled promise rejection that Rollbar
          // captures with the original stack trace (captureUnhandledRejections in src/index.html). The
          // RTDB "Error retrieving metadata for document" variant is deliberately suppressed there via
          // checkIgnore as known stale-demo-data noise (see docs/rollbar-metadata-errors.md).
          //
          // TODO: when a listener is triggered by an existing or new document entry and this rejects,
          // the document is likely never added to the documents list and never seen by the user. The
          // better fix is to handle the error in those listeners and print a useful message including
          // the firebase paths accessed and what data was missing or invalid (which will probably need
          // additional logging at a lower level). Whatever replaces the unhandled-rejection path must
          // still show a stack trace pointing at the original error site — e.g. just calling
          // console.error(msg) here would hide it.
          reject(msg);
        });
    });

    this.documentFetchPromiseMap.set(documentKey, documentFetchPromise);
    return documentFetchPromise;
  }

  public openDocumentFromFirestoreMetadata(firestoreMetadata: IDocumentMetadata) {
    if (!isDocumentType(firestoreMetadata.type)) {
      throw new Error(`Cannot open document with type '${firestoreMetadata.type}'`);
    }

    const visibility = firestoreMetadata.visibility;
    if (visibility != null && !isVisibilityType(visibility)) {
      throw new Error(`Cannot open document with visibility '${firestoreMetadata.visibility}'`);
    }

    const { title, originDoc, problem, investigation, unit, offeringId, groupId } = firestoreMetadata;

    // Note: the createdAt field is not passed here because it hasn't been included in the
    // past. If it is needed in the future, it is probably safe to add it here.
    return this.openDocument({
      ...firestoreMetadata,
      documentKey: firestoreMetadata.key,
      userId: firestoreMetadata.uid,
      firestoreMetadata,

      // The following props are sometimes null in Firestore on the metadata docs.
      // For consistency we make them undefined which is what openDocument
      // expects.
      title: title ?? undefined,
      originDoc: originDoc ?? undefined,
      problem: problem ?? undefined,
      investigation: investigation ?? undefined,
      unit: unit ?? undefined,
      offeringId: offeringId ?? undefined,
      groupId: groupId ?? undefined,
      visibility: visibility ?? undefined,
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
      return this.createDocument({ type: documentType, content: JSON.stringify(content), title: docTitle })
        .then(({document}) => {
          const {documentKey} = document.self;
          const newDocument: DBOtherDocument = {
            version: "1.0",
            self: {
              documentKey,
              uid: user.id,
              classHash: user.classHash
            },
            title: docTitle,
            properties: properties || {},
            visibility: this.stores.appConfig.defaultSharedDocuments ? "public" : "private",
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
          // Open the just-created document directly. This avoids waiting for required documents system to
          // resolve it. The required documents system has a race condition in this code path. We still need
          // to trigger the required documents system though since that is needed when createOtherDocument is
          // called from the startup code.
          const document = await this.createDocumentModelFromOtherDocument(newDocument, documentType);
          documents.addRequiredDocumentPromises([documentType]);
          documents.resolveRequiredDocumentPromise(document);
          return document;
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
      groupIdOfUserOwner: group?.id,
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
    const groupIdOfUserOwner = group && group.id;
    return this.openDocument({type, userId: uid, documentKey, groupIdOfUserOwner, title, properties});
  }

  // handles published personal documents and published learning logs
  public createDocumentModelFromOtherPublication(publication: DBOtherPublication, type: OtherPublicationType) {
    const {title, properties, uid, originDoc, self: {documentKey}, pubVersion} = publication;

    const group = this.stores.groups.groupForUser(uid);
    const groupIdOfUserOwner = group && group.id;
    return this.openDocument({
      type, userId: uid, documentKey, groupIdOfUserOwner, title, properties, originDoc, pubVersion
    });
  }

  public createDocumentFromPublication(publication: DBPublication) {
    // The publication record's `groupId` is the publishing user's group at publish time — a snapshot of
    // a fact about that user, which is why it lands on `groupIdOfUserOwner` rather than the owning group.
    const {groupId: groupIdOfUserOwner, groupUserConnections, userId, documentKey, pubVersion} = publication;
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
      groupIdOfUserOwner,
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
