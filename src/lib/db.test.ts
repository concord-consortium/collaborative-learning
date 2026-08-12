import { DB } from "./db";
import { createDocumentsModelWithRequiredDocuments, DocumentsModel } from "../models/stores/documents";
import { DBDocument } from "./db-types";
import { createDocumentModel, DocumentModelType } from "../models/document/document";
import { DocumentContentModel } from "../models/document/document-content";
import { registerDocumentKind, resetDocumentKindRegistryForTests } from "../models/document/document-kinds";
import {
  GroupDocument, LearningLogDocument, PersonalDocument, PlanningDocument, ProblemDocument
} from "../models/document/document-types";
import { specStores } from "../models/stores/spec-stores";
import { specAppConfig } from "../models/stores/spec-app-config";
import { IStores } from "../models/stores/stores";
import { UserModel } from "../models/stores/user";
import { UnitModel } from "../models/curriculum/unit";
import { TextContentModelType } from "../models/tiles/text/text-content";
import { ITileModel } from "../models/tiles/tile-model";
import { createSingleTileContent } from "../utilities/test-utils";
import * as UrlParams from "../utilities/url-params";
import { Logger } from "./logger";
import { LogEventName } from "./logger-types";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../register-tile-types";
registerTileTypes(["Text"]);

const mockDatabase = jest.fn();
const mockFirestore = jest.fn();
const mockFunctions = jest.fn();
const mockAuthStateUnsubscribe = jest.fn();

jest.mock("firebase/app", () => {
  const mockFirestoreInstance = () => mockFirestore();
  (mockFirestoreInstance as any).FieldValue = {
    serverTimestamp: () => ({ _type: "serverTimestamp" })
  };
  const mockFirebase = {
    apps: [],
    initializeApp: () => null,
    auth: () => ({
      onAuthStateChanged: (callback: (user: any) => void) => {
        callback({ uid: "user-id" });
        return mockAuthStateUnsubscribe;
      },
      signInAnonymously: () => Promise.resolve(),
      setPersistence: (persistence: string) => Promise.resolve()
    }),
    database: () => mockDatabase(),
    firestore: mockFirestoreInstance,
    functions: () => mockFunctions()
  };
  (mockFirebase.auth as any).Auth = { Persistence: { SESSION: "session"}};
  return mockFirebase;
});

type QueryParams = UrlParams.QueryParams;

describe("db", () => {
  let stores: IStores;
  let db: DB;
  const originalUrlParams = UrlParams.urlParams;
  const setUrlParams = (params: QueryParams) => {
    (UrlParams as any).urlParams = params;
  };

  beforeEach(() => {
    // registerDocumentKind throws on duplicates; several tests register the same class-wide kind, so reset the
    // module-global registry to just the built-in kinds before each test.
    resetDocumentKindRegistryForTests();
    setUrlParams(originalUrlParams);
    stores = specStores({
      appMode: "test",
      documents: DocumentsModel.create(),
      user: UserModel.create({id: "1", portal: "example.com"})
    });
    db = new DB();
    mockDatabase.mockReset();
    mockFirestore.mockReset();
    mockFunctions.mockReset();
  });

  afterEach(() => {
    db.disconnect();
  });

  // Mocks the document write and the RTDB offering-user/document refs, and stubs the model builder
  // `createProblemOrPlanningDocument` opens the created document with, so a create resolves with
  // `newDocument` without a live listener or Firestore.
  function stubProblemDocumentCreation(newDocument: DocumentModelType) {
    jest.spyOn(db, "createDocument").mockResolvedValue({
      document: { version: "1.0", self: { documentKey: "doc-1", uid: "1", classHash: "test" }, type: "mock" },
      metadata: {}
    } as any);
    jest.spyOn(db, "createDocumentModelFromProblemMetadata").mockResolvedValue(newDocument);
    mockDatabase.mockImplementation(() => ({
      ref: () => ({
        update: () => {},
        set: () => Promise.resolve(),
        once: () => Promise.resolve({ val: () => true })
      })
    }));
  }

  it("connects/disconnects", async () => {
    expect.assertions(5);
    expect(db.firebase.isConnected).toBe(false);
    expect(db.isAuthStateSubscribed()).toBe(false);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect(db.firebase.isConnected).toBe(true);
    expect(db.isAuthStateSubscribed()).toBe(true);
    db.disconnect();
    expect(db.isAuthStateSubscribed()).toBe(false);
  }, 5000);

  it("connects/disconnects when configured to use the emulators", async () => {
    setUrlParams({ firebase: "emulator", firestore: "emulator", functions: "emulator" });
    const mockUseDatabaseEmulator = jest.fn();
    mockDatabase.mockImplementation(() => ({ useEmulator: () => mockUseDatabaseEmulator() }));
    const mockUseFirestoreEmulator = jest.fn();
    mockFirestore.mockImplementation(() => ({ useEmulator: () => mockUseFirestoreEmulator() }));
    const mockUseFunctionsEmulator = jest.fn();
    mockFunctions.mockImplementation(() => ({ useEmulator: () => mockUseFunctionsEmulator() }));
    expect.assertions(8);
    expect(db.firebase.isConnected).toBe(false);
    expect(db.isAuthStateSubscribed()).toBe(false);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect(mockUseDatabaseEmulator).toHaveBeenCalled();
    expect(mockUseFirestoreEmulator).toHaveBeenCalled();
    expect(mockUseFunctionsEmulator).toHaveBeenCalled();
    expect(db.firebase.isConnected).toBe(true);
    expect(db.isAuthStateSubscribed()).toBe(true);
    db.disconnect();
    expect(db.isAuthStateSubscribed()).toBe(false);
    mockUseDatabaseEmulator.mockReset();
    mockUseFirestoreEmulator.mockReset();
    mockUseFunctionsEmulator.mockReset();
  }, 5000);

  it("resolves paths in test mode", async () => {
    expect.assertions(2);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect(db.firebase.getRootFolder()).toMatch(/^\/test\/([^/])+\/portals\/example_com\/$/);
    expect(db.firebase.getFullPath("foo")).toMatch(/^\/test\/([^/])+\/portals\/example_com\/foo$/);
  });

  it("resolves paths in dev mode", async () => {
    expect.assertions(2);
    stores.setAppMode("dev");
    await db.connect({appMode: "dev", stores, dontStartListeners: true});
    expect(db.firebase.getRootFolder()).toMatch(/^\/dev\/([^/])+\/portals\/example_com\/$/);
    expect(db.firebase.getFullPath("foo")).toMatch(/^\/dev\/([^/])+\/portals\/example_com\/foo$/);
  });

  it("can get a reference to the database", async () => {
    expect.assertions(1);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    const testString = "this is a test";

    mockDatabase.mockImplementation(() => ({
      ref: () => ({
        set: () => null,
        once: () => Promise.resolve({ val: () => testString })
      })
    }));

    const ref = db.firebase.ref("write-test");
    ref.set(testString);
    const snapshot = await ref.once("value");
    expect(snapshot.val()).toBe(testString);
  });

  it("can parse document text content", async () => {
    expect.assertions(4);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    const storedJsonString = JSON.stringify(createSingleTileContent({ type: "Text", text: "Testing" }));
    const docContentSnapshot = db.parseDocumentContent({content: storedJsonString} as DBDocument);
    const docContent = DocumentContentModel.create(docContentSnapshot);

    if (docContent == null) {
      fail();
      return;
    }

    expect(docContent.tileMap.size).toBe(1);
    docContent.tileMap.forEach((tile: ITileModel) => {
      const tileContent = tile.content as TextContentModelType;
      expect(tileContent.type).toBe("Text");
      expect(tileContent.format).toBeUndefined();
      expect(tileContent.text).toBe("Testing");
    });
  });

  it("creates required problem document", async () => {
    expect.assertions(3);
    const newDocument = createDocumentModel({ uid: "1", type: ProblemDocument, key: "doc-1" });
    stubProblemDocumentCreation(newDocument);
    stores.documents = createDocumentsModelWithRequiredDocuments([ProblemDocument, PlanningDocument]);
    stores.documents.resolveRequiredDocumentPromisesWithNull();
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect((await db.guaranteeOpenDefaultDocument(ProblemDocument))?.type).toBe(ProblemDocument);
    expect(await stores.documents.requiredDocuments[ProblemDocument].promise).toEqual(newDocument);
    expect(await stores.documents.requiredDocuments[PlanningDocument].promise).toBeNull();
  });

  it("creates required planning document", async () => {
    expect.assertions(3);
    const newDocument = createDocumentModel({ uid: "1", type: PlanningDocument, key: "doc-1" });
    stubProblemDocumentCreation(newDocument);
    stores.documents = createDocumentsModelWithRequiredDocuments([ProblemDocument, PlanningDocument]);
    stores.documents.resolveRequiredDocumentPromisesWithNull();
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect((await db.guaranteePlanningDocument())?.type).toBe(PlanningDocument);
    expect(await stores.documents.requiredDocuments[PlanningDocument].promise).toEqual(newDocument);
    expect(await stores.documents.requiredDocuments[ProblemDocument].promise).toBeNull();
  });

  it("creates required personal document from existing promise", async () => {
    const personalDocument = createDocumentModel({ uid: "1", type: PersonalDocument, key: "doc-1" });
    stores.documents = createDocumentsModelWithRequiredDocuments([PersonalDocument]);
    stores.documents.resolveRequiredDocumentPromise(personalDocument);
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect(await db.guaranteeOpenDefaultDocument(PersonalDocument)).toBe(personalDocument);
  });

  it("logs errors when asked to open default documents without required document promises", async () => {
    await db.connect({appMode: "test", stores, dontStartListeners: true});

    await jestSpyConsole("error", async spy => {
      await db.guaranteeOpenDefaultDocument(ProblemDocument);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    await jestSpyConsole("error", async spy => {
      await db.guaranteeOpenDefaultDocument(PersonalDocument);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    await jestSpyConsole("error", async spy => {
      await db.guaranteePlanningDocument();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    await jestSpyConsole("error", async spy => {
      await db.guaranteeLearningLog();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOrCreateGroupDocument", () => {
    const openStub = jest.fn(async (m: any) => ({ opened: m.key }));
    beforeEach(() => {
      (db as any).openDocumentFromFirestoreMetadata = openStub;
      (db as any).findFirestoreMetadata = jest.fn(async (k: string) => ({ key: k }));
      // The group owner id and canonical-pointer path need both offeringId and currentGroupId.
      stores.user = UserModel.create({ id: "1", portal: "example.com", offeringId: "off-1", currentGroupId: "3" });
    });

    it("fast path: opens the pointer's documentKey when the pointer exists", async () => {
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: true, data: () => ({ documentKey: "existing" }) }) })
      }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const result: any = await db.getOrCreateGroupDocument();
      expect((db as any).findFirestoreMetadata).toHaveBeenCalledWith("existing");
      expect(result.opened).toBe("existing");
    });

    it("create path: mints a doc, wins the transaction, returns the created doc", async () => {
      const setCalls: any[] = [];
      const updateCalls: any[] = [];
      const logSpy = jest.spyOn(Logger, "log").mockImplementation(() => null);
      (db as any).createDocument = jest.fn(async () => ({ firestoreMetadata: { key: "minted-key" } }));
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
        collection: () => ({ withConverter: () => ({ where: () => ({ where: () => ({ where: () => ({
          get: () => Promise.resolve({ empty: true, docs: [] }) }) }) }) }) })
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({
          get: async () => ({ exists: false }),
          set: (_r: any, d: any) => setCalls.push(d),
          update: (_r: any, d: any) => updateCalls.push(d)
        }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const result: any = await db.getOrCreateGroupDocument();
      expect((db as any).createDocument).toHaveBeenCalledWith(expect.objectContaining({ type: GroupDocument }));
      expect(setCalls[0]).toMatchObject({ documentKey: "minted-key", createdBy: expect.any(String) });
      expect(updateCalls[0]).toEqual({ canonical: "default" });
      expect(logSpy).toHaveBeenCalledWith(LogEventName.CREATE_GROUP_DOCUMENT);
      expect(result.opened).toBeDefined();
      // The create path already has the metadata it just wrote, so opening it costs no extra read.
      expect((db as any).findFirestoreMetadata).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("legacy fallback: opens a pre-existing random-key group doc and backfills a pointer", async () => {
      const setCalls: any[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
        collection: () => ({ withConverter: () => ({ where: () => ({ where: () => ({ where: () => ({
          get: () => Promise.resolve({ empty: false, docs: [{ data: () => ({ key: "legacy-doc" }) }] }) }) }) }) }) })
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({ get: async () => ({ exists: false }), set: (_r: any, d: any) => setCalls.push(d), update: () => {} }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const result: any = await db.getOrCreateGroupDocument();
      expect((db as any).openDocumentFromFirestoreMetadata).toHaveBeenCalledWith({ key: "legacy-doc" });
      expect(setCalls[0]).toMatchObject({ documentKey: "legacy-doc" });   // pointer backfilled
      expect(result.opened).toBe("legacy-doc");
    });

    it("lost race: cleans up the orphan and opens the winner's doc", async () => {
      (db as any).createDocument = jest.fn(async () => ({ firestoreMetadata: { key: "my-key" } }));
      const orphanSpy = jest.spyOn(db as any, "deleteOrphanDocument").mockResolvedValue(undefined);
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }), delete: () => Promise.resolve() }),
        collection: () => ({ withConverter: () => ({ where: () => ({ where: () => ({ where: () => ({
          get: () => Promise.resolve({ empty: true, docs: [] }) }) }) }) }) })
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({
          get: async () => ({ exists: true, data: () => ({ documentKey: "winner" }) }),
          set: () => {},
          update: () => {}
        }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const result: any = await db.getOrCreateGroupDocument();
      expect(orphanSpy).toHaveBeenCalled();
      expect((db as any).findFirestoreMetadata).toHaveBeenCalledWith("winner");
      expect(result.opened).toBe("winner");
    });
  });

  it("writes group-document metadata to Firestore client-side (no contextId)", async () => {
    const setPayloads: any[] = [];
    mockFirestore.mockImplementation(() => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false }),
        set: (data: any) => { setPayloads.push(data); return Promise.resolve(); }
      })
    }));
    // group scope: createFirestoreMetadataDocument derives context_id/groupId/offeringId from the stores.
    stores = specStores({
      appMode: "test",
      documents: DocumentsModel.create(),
      user: UserModel.create({
        id: "1", portal: "example.com", classHash: "class-h", offeringId: "off-1", currentGroupId: "3"
      })
    });
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    // context_id/groupId/offeringId come from the user via the kind's scope; owner→uid is passed directly.
    const written = await db.createFirestoreMetadataDocument({
      documentKey: "gk", type: GroupDocument, kind: GroupDocument, owner: "group_off-1_3", createdAt: 123
    });
    expect(written).toMatchObject({
      context_id: "class-h", network: null, key: "gk", uid: "group_off-1_3", groupId: "3", offeringId: "off-1"
    });
    expect(written).not.toHaveProperty("contextId");
    expect(setPayloads[0]).toMatchObject({ context_id: "class-h", network: null });
  });

  it("stamps kind and concurrent on a group document's Firestore metadata", async () => {
    const setPayloads: any[] = [];
    mockFirestore.mockImplementation(() => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false }),
        set: (data: any) => { setPayloads.push(data); return Promise.resolve(); }
      })
    }));
    stores.user.setCurrentGroupId("3");   // group scope: createFirestoreMetadataDocument derives groupId from stores
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    const written = await db.createFirestoreMetadataDocument({
      documentKey: "gk", type: GroupDocument, kind: GroupDocument, owner: "group_off-1_3", createdAt: 123
    });
    expect(written).toMatchObject({ kind: "group", concurrent: true });
    expect(setPayloads[0]).toMatchObject({ kind: "group", concurrent: true });
  });

  it("does NOT stamp kind/concurrent on a personal document", async () => {
    const setPayloads: any[] = [];
    mockFirestore.mockImplementation(() => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false }),
        set: (data: any) => { setPayloads.push(data); return Promise.resolve(); }
      })
    }));
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    const written = await db.createFirestoreMetadataDocument({
      documentKey: "pk", type: PersonalDocument, kind: PersonalDocument, owner: "user-1", createdAt: 123, title: "t"
    });
    // `kind` is stamped only on type:"group" docs; non-group docs are left kind-less to avoid persisting a
    // (possibly-to-be-consolidated) publication/personal kind we would later have to migrate.
    expect(written).not.toHaveProperty("kind");
    expect(written).not.toHaveProperty("concurrent");
  });

  it("writes context_id from the user's classHash", async () => {
    const setPayloads: any[] = [];
    mockFirestore.mockImplementation(() => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false }),
        set: (data: any) => { setPayloads.push(data); return Promise.resolve(); }
      })
    }));
    stores = specStores({
      appMode: "test",
      documents: DocumentsModel.create(),
      user: UserModel.create({ id: "1", portal: "example.com", classHash: "class-h" })
    });
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    // context_id is stamped from the user's classHash (it is the class scope field).
    const written = await db.createFirestoreMetadataDocument({
      documentKey: "pk", type: PersonalDocument, kind: PersonalDocument, owner: "user-1", createdAt: 123, title: "t"
    });
    expect(written).toMatchObject({ context_id: "class-h", key: "pk" });
    expect(setPayloads[0]).toMatchObject({ context_id: "class-h" });
  });

  describe("class-wide document creation", () => {
    it("createFirestoreMetadataDocument stamps class+unit scope, kind, and concurrent (but not title)", async () => {
      // The kind must be registered as class-scoped so getDocumentKindMetadataFields returns its axis fields and
      // getDocumentLocationFields returns the class `unit` (read from the stores' current unit). The authored title
      // is registered too, to prove it is resolved by kind and NOT persisted into the Firestore metadata.
      registerDocumentKind("drivingQuestionBoard", {
        metadataFields: { concurrent: true }, ownerType: "class", containerType: "classUnit",
        title: "Driving Question Board"
      });
      // Rebuild stores with the classHash (→ context_id) and the current unit code the class-wide scope uses.
      stores = specStores({
        appMode: "test",
        documents: DocumentsModel.create(),
        user: UserModel.create({ id: "1", portal: "example.com", classHash: "class-1" }),
        unit: UnitModel.create({ code: "msu", title: "Unit" })
      });
      const setPayloads: any[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: () => ({
          get: () => Promise.resolve({ exists: false }),
          set: (data: any) => { setPayloads.push(data); return Promise.resolve(); }
        })
      }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      // The unit (from the kind's class scope) and context_id (the user's classHash) come from the stores; owner
      // is passed directly. No title is passed — a class-wide doc's title is resolved live by kind at display.
      const written: any = await db.createFirestoreMetadataDocument({
        documentKey: "dqb-1", type: GroupDocument, kind: "drivingQuestionBoard",
        owner: "class_class-1", createdAt: 1
      });
      expect(written).toMatchObject({
        type: "group", context_id: "class-1", unit: "msu",
        kind: "drivingQuestionBoard", concurrent: true, uid: "class_class-1"
      });
      expect(written.title).toBeUndefined();       // title is looked up by kind, never stored
      expect(written.offeringId).toBeUndefined();
      expect(written.groupId).toBeUndefined();
      expect(written.canonical).toBeUndefined();   // canonical is set only by the pointer-claim transaction
      expect(setPayloads[0]).toMatchObject({
        type: "group", context_id: "class-1", unit: "msu",
        kind: "drivingQuestionBoard", concurrent: true, uid: "class_class-1"
      });
      expect(setPayloads[0].title).toBeUndefined();
      // The class+unit scope states its absent curriculum fields explicitly so the scope is
      // queryable; it must still carry no offering or group.
      expect(setPayloads.some((d: any) =>
        d.investigation === null && d.problem === null &&
        d.offeringId === undefined && d.groupId === undefined
      )).toBe(true);
    });
  });

  describe("resolveClassWideDocument", () => {
    const openStub = jest.fn(async (m: any) => ({ opened: m.key }));
    beforeEach(() => {
      // The class+unit pointer scope needs stores.unit.code === "msu"; there is no unit-code setter
      // (UnitModel has no such action), so rebuild stores with a unit fixture carrying that code.
      stores = specStores({
        appMode: "test",
        documents: DocumentsModel.create(),
        user: UserModel.create({ id: "1", portal: "example.com" }),
        unit: UnitModel.create({ code: "msu", title: "Unit" })
      });
      (db as any).openDocumentFromFirestoreMetadata = openStub;
      (db as any).findFirestoreMetadata = jest.fn(async (k: string) => ({ key: k }));
      // createDeclaredClassWideDocuments registers a declared kind before asking for its document, and
      // getDocumentOwner throws for an unregistered kind rather than defaulting the owner to the caller.
      registerDocumentKind("drivingQuestionBoard", {
        metadataFields: { concurrent: true }, ownerType: "class", containerType: "classUnit",
        title: "DQB", unit: "msu"
      });
    });

    it("fast path: returns the pointer's documentKey without opening the document", async () => {
      mockFirestore.mockImplementation(() => ({
        doc: (p: string) => ({
          get: () => Promise.resolve({ exists: true, data: () => ({ documentKey: "existing" }) })
        })
      }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const result = await db.resolveClassWideDocument({ kind: "drivingQuestionBoard", title: "DQB" });
      expect(result).toBe("existing");
      // The point of the deferral: one pointer read, and none of the work that opening entails.
      expect((db as any).findFirestoreMetadata).not.toHaveBeenCalled();
      expect(openStub).not.toHaveBeenCalled();
    });

    it("create path: mints a class-wide doc, claims the pointer, and does not open it", async () => {
      const setCalls: any[] = [];
      const updateCalls: any[] = [];
      (db as any).createDocument = jest.fn(async () => ({ firestoreMetadata: { key: "dqb-key" } }));
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) })
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({ get: async () => ({ exists: false }),
             set: (_r: any, d: any) => setCalls.push(d),
             update: (_r: any, d: any) => updateCalls.push(d) }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const result = await db.resolveClassWideDocument({ kind: "drivingQuestionBoard", title: "DQB" });
      // The title is not threaded into createDocument — it is registered on the kind and resolved by kind.
      expect((db as any).createDocument).toHaveBeenCalledWith(expect.objectContaining({
        type: GroupDocument,
        kind: "drivingQuestionBoard"
      }));
      expect(updateCalls[0]).toEqual({ canonical: "drivingQuestionBoard" });
      expect(result).toBe("dqb-key");
      expect(openStub).not.toHaveBeenCalled();
    });
  });

  describe("document visibility with defaultSharedDocuments", () => {
    // Synchronous thenable that executes callbacks immediately, avoiding async
    // timing issues in the mock chain. Unwraps nested thenables like real Promises.
    function syncThenable(value: any): any {
      if (value && typeof value === "object" && typeof value.then === "function") {
        return value;
      }
      return {
        then: (onFulfilled: any, onRejected?: any) => {
          try { return syncThenable(onFulfilled(value)); }
          catch (e) { if (onRejected) return syncThenable(onRejected(e)); throw e; }
        },
        catch: () => syncThenable(value)
      };
    }

    function setupMocks(mockSet: jest.Mock) {
      // Mock createDocument to bypass internal Firebase/Firestore operations
      jest.spyOn(db, "createDocument").mockReturnValue(syncThenable({
        document: { version: "1.0", self: { documentKey: "doc-1", uid: "1", classHash: "test" }, type: "mock" },
        metadata: {},
        firestoreMetadata: {}
      }) as any);

      // Mock Firebase ref for offering user check and document writes
      mockDatabase.mockImplementation(() => ({
        ref: () => ({
          update: () => {},
          set: (doc: any) => { mockSet(doc); return syncThenable(undefined); },
          once: () => syncThenable({ val: () => true })
        })
      }));
    }

    it("sets ProblemDocument visibility to public when defaultSharedDocuments is true", async () => {
      const mockSet = jest.fn();
      const docModel = createDocumentModel({ uid: "1", type: ProblemDocument, key: "doc-1" });
      setupMocks(mockSet);
      // createProblemOrPlanningDocument now opens the created doc directly via this builder; stub
      // it so the create resolves without a live listener or Firestore.
      jest.spyOn(db, "createDocumentModelFromProblemMetadata").mockResolvedValue(docModel as any);
      stores.appConfig.setConfigs([{ defaultSharedDocuments: true }]);
      await db.connect({appMode: "test", stores, dontStartListeners: true});

      const promise = db.createProblemOrPlanningDocument(ProblemDocument);
      // The synchronous mock chain has already executed and called mockSet
      const docWritten = mockSet.mock.calls.find((c: any[]) => c[0]?.visibility);
      expect(docWritten![0].visibility).toBe("public");

      await promise;
    });

    it("sets ProblemDocument visibility to private when defaultSharedDocuments is not set", async () => {
      const mockSet = jest.fn();
      const docModel = createDocumentModel({ uid: "1", type: ProblemDocument, key: "doc-1" });
      setupMocks(mockSet);
      jest.spyOn(db, "createDocumentModelFromProblemMetadata").mockResolvedValue(docModel as any);
      await db.connect({appMode: "test", stores, dontStartListeners: true});

      const promise = db.createProblemOrPlanningDocument(ProblemDocument);
      const docWritten = mockSet.mock.calls.find((c: any[]) => c[0]?.visibility);
      expect(docWritten![0].visibility).toBe("private");

      await promise;
    });

    it("sets PlanningDocument visibility to private even when defaultSharedDocuments is true", async () => {
      const mockSet = jest.fn();
      const docModel = createDocumentModel({ uid: "1", type: PlanningDocument, key: "doc-1" });
      setupMocks(mockSet);
      jest.spyOn(db, "createDocumentModelFromProblemMetadata").mockResolvedValue(docModel as any);
      stores.appConfig.setConfigs([{ defaultSharedDocuments: true }]);
      await db.connect({appMode: "test", stores, dontStartListeners: true});

      const promise = db.createProblemOrPlanningDocument(PlanningDocument);
      const docWritten = mockSet.mock.calls.find((c: any[]) => c[0]?.visibility);
      expect(docWritten![0].visibility).toBe("private");

      await promise;
    });

    it("sets PersonalDocument visibility to public when defaultSharedDocuments is true", async () => {
      const mockSet = jest.fn();
      const docModel = createDocumentModel({ uid: "1", type: PersonalDocument, key: "doc-1" });
      setupMocks(mockSet);
      // createOtherDocument now opens the created doc directly via this builder; stub it so the
      // create resolves without a live listener or Firestore.
      jest.spyOn(db, "createDocumentModelFromOtherDocument").mockReturnValue(docModel as any);
      stores.appConfig.setConfigs([{ defaultSharedDocuments: true }]);
      await db.connect({appMode: "test", stores, dontStartListeners: true});

      const promise = db.createOtherDocument(PersonalDocument);
      const docWritten = mockSet.mock.calls.find((c: any[]) => c[0]?.visibility);
      expect(docWritten![0].visibility).toBe("public");

      await promise;
    });

    it("sets LearningLogDocument visibility to private when defaultSharedDocuments is not set", async () => {
      const mockSet = jest.fn();
      const docModel = createDocumentModel({ uid: "1", type: LearningLogDocument, key: "doc-1" });
      setupMocks(mockSet);
      // createOtherDocument now opens the created doc directly via this builder; stub it so the
      // create resolves without a live listener or Firestore.
      jest.spyOn(db, "createDocumentModelFromOtherDocument").mockReturnValue(docModel as any);
      await db.connect({appMode: "test", stores, dontStartListeners: true});

      const promise = db.createOtherDocument(LearningLogDocument);
      const docWritten = mockSet.mock.calls.find((c: any[]) => c[0]?.visibility);
      expect(docWritten![0].visibility).toBe("private");

      await promise;
    });
  });

  describe("createOtherDocument opens the created document directly", () => {
    // Mocks createDocument + the RTDB other-doc write, and stubs the model builder the DB listener
    // would run, so createOtherDocument has a document to open without a live listener or Firestore.
    function setup(docModel: any) {
      jest.spyOn(db, "createDocument").mockResolvedValue({
        document: { version: "1.0", self: { documentKey: "doc-1", uid: "1", classHash: "test" }, type: "mock" },
        metadata: {},
        firestoreMetadata: { key: "doc-1", type: "personal", uid: "1", context_id: "test" }
      } as any);
      mockDatabase.mockImplementation(() => ({
        ref: () => ({
          update: () => {},
          set: () => Promise.resolve(undefined),
          once: () => Promise.resolve({ val: () => true })
        })
      }));
      jest.spyOn(db, "createDocumentModelFromOtherDocument").mockResolvedValue(docModel as any);
    }

    // Rejects if `promise` doesn't settle promptly, turning a hang (the CLUE-587 bug) into a fast,
    // descriptive failure instead of a whole-test timeout.
    function withinTick<T>(promise: Promise<T> | T, message: string): Promise<T> {
      let timer: ReturnType<typeof setTimeout>;
      return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 200); })
      ]).finally(() => clearTimeout(timer));
    }

    it("resolves with the created document without the DB listener resolving the required promise", async () => {
      const docModel = createDocumentModel({ uid: "1", type: PersonalDocument, key: "doc-1" });
      setup(docModel);
      await db.connect({ appMode: "test", stores, dontStartListeners: true });

      // No listener is running and nothing calls resolveRequiredDocumentPromise externally.
      const result = await withinTick(
        db.createOtherDocument(PersonalDocument),
        "createOtherDocument hung waiting on the required-document promise");
      expect(result).toBe(docModel);
    });

    it("resolves the required-document promise with the created doc so startup dedup sees it", async () => {
      const docModel = createDocumentModel({ uid: "1", type: PersonalDocument, key: "doc-1" });
      setup(docModel);
      await db.connect({ appMode: "test", stores, dontStartListeners: true });

      await withinTick(
        db.createOtherDocument(PersonalDocument),
        "createOtherDocument hung waiting on the required-document promise");
      const dedup = await withinTick(
        stores.documents.requiredDocuments[PersonalDocument].promise,
        "required-document promise was left unresolved");
      expect(dedup).toBe(docModel);
    });
  });

  it("findFirestoreMetadata delegates to the document metadata store", async () => {
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    const fake = { uid: "u1", type: "problem", key: "doc-x", context_id: "class-1" } as any;
    const spy = jest.spyOn(stores.documentMetadata, "fetchMetadata").mockResolvedValue(fake);
    const result = await db.findFirestoreMetadata("doc-x");
    expect(spy).toHaveBeenCalledWith("doc-x");
    expect(result).toBe(fake);
    spy.mockRestore();
  });

  describe("openDocument Firestore metadata sourcing", () => {
    function stubRtdb(metadataVal: any, documentVal: any) {
      // openDocument calls getUserDocumentPath / getUserDocumentMetadataPath then ref(path).once("value")
      jest.spyOn(db.firebase, "getUserDocumentPath").mockReturnValue("doc/path");
      jest.spyOn(db.firebase, "getUserDocumentMetadataPath").mockReturnValue("meta/path");
      jest.spyOn(db.firebase, "ref").mockImplementation((path?: string) => ({
        once: () => Promise.resolve({ val: () => (path === "meta/path" ? metadataVal : documentVal) })
      }) as any);
    }

    beforeEach(async () => {
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("applies context_id/concurrent/kind from passed-in firestoreMetadata to the model", async () => {
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const firestoreMetadata = {
        uid: "u1", type: "problem", key: "d1", context_id: "class-1", concurrent: true, kind: "group"
      } as any;
      const doc = await db.openDocument({
        documentKey: "d1", type: "problem", userId: "u1", firestoreMetadata
      } as any);
      expect(doc.contextId).toBe("class-1");
      expect(doc.concurrent).toBe(true);
      expect(doc.kind).toBe("group");
    });

    it("fetches Firestore metadata from the store when none is passed", async () => {
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const spy = jest.spyOn(stores.documentMetadata, "fetchMetadata")
        .mockResolvedValue({ uid: "u1", type: "problem", key: "d2", context_id: "class-9" } as any);
      const doc = await db.openDocument({ documentKey: "d2", type: "problem", userId: "u1" } as any);
      expect(spy).toHaveBeenCalledWith("d2");
      expect(doc.contextId).toBe("class-9");
    });

    it("propagates the rejection when the Firestore metadata fetch fails", async () => {
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      // fetchMetadata now throws (describing its query) rather than returning undefined; openDocument
      // lets that rejection flow through Promise.all to its catch. The message content is covered by
      // the document-metadata-store tests; here we only assert the rejection propagates.
      jest.spyOn(stores.documentMetadata, "fetchMetadata")
        .mockRejectedValue(new Error("No Firestore metadata document found: queried 'x' where key == 'd3'"));
      await expect(
        db.openDocument({ documentKey: "d3", type: "problem", userId: "u1" } as any)
      ).rejects.toThrow(/No Firestore metadata document found/);
    });

    it("a listener builder populates contextId via the store fetch", async () => {
      jest.spyOn(db.firebase, "getUserDocumentPath").mockReturnValue("doc/path");
      jest.spyOn(db.firebase, "getUserDocumentMetadataPath").mockReturnValue("meta/path");
      jest.spyOn(db.firebase, "ref").mockImplementation((path?: string) => ({
        once: () => Promise.resolve({
          val: () => (path === "meta/path" ? { createdAt: 1, properties: {} } : { changeCount: 0 })
        })
      }) as any);
      jest.spyOn(stores.documentMetadata, "fetchMetadata")
        .mockResolvedValue({ uid: "u2", type: "personal", key: "pd1", context_id: "class-77" } as any);
      jest.spyOn(stores.groups, "groupForUser").mockReturnValue(undefined as any);

      const dbDocument = { title: "T", properties: {}, self: { uid: "u2", documentKey: "pd1" } } as any;
      const doc = await db.createDocumentModelFromOtherDocument(dbDocument, "personal" as any);
      expect(doc.contextId).toBe("class-77");
    });

    it("builds one model and adds it once when the same document is opened twice", async () => {
      // After the CLUE-587 fix both the create path (which opens the doc directly) and the DB
      // listener open the same stored document. openDocument must dedupe by key so only one model
      // is built and added to the documents store.
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      jest.spyOn(stores.documentMetadata, "fetchMetadata")
        .mockResolvedValue({ uid: "u2", type: "personal", key: "pd1", context_id: "class-1" } as any);
      jest.spyOn(stores.groups, "groupForUser").mockReturnValue(undefined as any);

      const dbDocument = { title: "T", properties: {}, self: { uid: "u2", documentKey: "pd1" } } as any;
      const first = await db.createDocumentModelFromOtherDocument(dbDocument, "personal" as any);
      const second = await db.createDocumentModelFromOtherDocument(dbDocument, "personal" as any);

      expect(second).toBe(first);
      expect(stores.documents.all.filter(d => d.key === "pd1")).toHaveLength(1);
    });

    it("backfills concurrent on a group-typed doc whose Firestore metadata lacks it", async () => {
      const setCalls: any[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ set: (data: any, opts: any) => { setCalls.push({ data, opts }); return Promise.resolve(); } })
      }));
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const firestoreMetadata = {
        uid: "g", type: GroupDocument, key: "g1", context_id: "class-1"   // no concurrent/kind
      } as any;
      const doc = await db.openDocument({
        documentKey: "g1", type: GroupDocument, userId: "g", firestoreMetadata
      } as any);
      // model gets the registry-derived value immediately
      expect(doc.concurrent).toBe(true);
      expect(doc.kind).toBe("group");
      // and a merge write-back was issued
      expect(setCalls.some(c => c.data.concurrent === true && c.data.kind === "group" && c.opts?.merge === true))
        .toBe(true);
    });

    it("does NOT write back when concurrent is already true", async () => {
      const setCalls: any[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ set: (data: any) => { setCalls.push(data); return Promise.resolve(); } })
      }));
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const firestoreMetadata = {
        uid: "g", type: GroupDocument, key: "g2", context_id: "class-1", concurrent: true, kind: "group"
      } as any;
      await db.openDocument({ documentKey: "g2", type: GroupDocument, userId: "g", firestoreMetadata } as any);
      expect(setCalls.length).toBe(0);
    });

    it("does NOT write back for a non-concurrent kind (personal doc)", async () => {
      const setCalls: any[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ set: (data: any) => { setCalls.push(data); return Promise.resolve(); } })
      }));
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const firestoreMetadata = { uid: "u", type: "personal", key: "p1", context_id: "class-1" } as any;
      const doc = await db.openDocument({ documentKey: "p1", type: "personal", userId: "u", firestoreMetadata } as any);
      expect(doc.concurrent).toBeFalsy();
      expect(setCalls.length).toBe(0);
    });
  });

  describe("createDeclaredClassWideDocuments", () => {
    it("creates one document per declared class-wide document", async () => {
      const created: any[] = [];
      (db as any).resolveClassWideDocument =
        jest.fn(async (classWideDoc: any) => { created.push(classWideDoc); });
      stores.appConfig = specAppConfig({
        config: { classWideDocuments: [
          { kind: "drivingQuestionBoard", title: "DQB" },
          { kind: "wordWall", title: "Word Wall" }
        ] } as any
      });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).createDeclaredClassWideDocuments();
      // allow the fire-and-forget promises to settle
      await new Promise(r => setTimeout(r, 0));
      expect((db as any).resolveClassWideDocument).toHaveBeenCalledTimes(2);
      expect(created.map((s: any) => s.kind)).toEqual(["drivingQuestionBoard", "wordWall"]);
    });

    it("does nothing when no class-wide documents are declared", async () => {
      (db as any).resolveClassWideDocument = jest.fn(async () => undefined);
      stores.appConfig = specAppConfig();   // no classWideDocuments
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).createDeclaredClassWideDocuments();
      await new Promise(r => setTimeout(r, 0));
      expect((db as any).resolveClassWideDocument).not.toHaveBeenCalled();
    });

    it("skips entries whose kind is not a valid camelCase identifier", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const created: any[] = [];
      (db as any).resolveClassWideDocument =
        jest.fn(async (classWideDoc: any) => { created.push(classWideDoc); });
      stores.appConfig = specAppConfig({
        config: { classWideDocuments: [
          { kind: "driving-question-board", title: "invalid (kebab-case)" },
          { kind: "drivingQuestionBoard", title: "DQB" }
        ] } as any
      });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).createDeclaredClassWideDocuments();
      await new Promise(r => setTimeout(r, 0));
      expect(created.map((s: any) => s.kind)).toEqual(["drivingQuestionBoard"]);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("skips a second entry whose kind duplicates an already-registered kind", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const created: any[] = [];
      (db as any).resolveClassWideDocument =
        jest.fn(async (classWideDoc: any) => { created.push(classWideDoc); });
      stores.appConfig = specAppConfig({
        config: { classWideDocuments: [
          { kind: "drivingQuestionBoard", title: "DQB" },
          { kind: "drivingQuestionBoard", title: "duplicate" },  // duplicate kind: registration throws → skipped
          { kind: "group", title: "collides with a built-in kind" }  // also skipped
        ] } as any
      });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).createDeclaredClassWideDocuments();
      await new Promise(r => setTimeout(r, 0));
      expect(created.map((s: any) => s.kind)).toEqual(["drivingQuestionBoard"]);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

});
