import { DB } from "./db";
import { createDocumentsModelWithRequiredDocuments, DocumentsModel } from "../models/stores/documents";
import { DBDocument } from "./db-types";
import { createDocumentModel, DocumentModelType } from "../models/document/document";
import { DocumentContentModel } from "../models/document/document-content";
import { kClassWideProfile } from "../models/document/document-axis-profiles";
import {
  registerClassWideDocumentKind, registerDocumentKind, resetDocumentKindRegistryForTests
} from "../models/document/document-kinds";
import {
  AxesDocument, GroupDocument, LearningLogDocument, PersonalDocument, PlanningDocument, ProblemDocument
} from "../models/document/document-types";
import {
  CanonicalSlotOwnerChangedError, getCanonicalPointerPath, kDefaultCanonicalDocumentLabel
} from "./scoped-document-pointers";
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
  // createDocument stamps the RTDB server-timestamp sentinel and reads the resolved value back.
  (mockFirebase.database as any).ServerValue = { TIMESTAMP: { ".sv": "timestamp" } };
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
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({
          get: async () => ({ exists: false }),
          set: (_r: any, d: any) => setCalls.push(d),
          update: (_r: any, d: any) => updateCalls.push(d)
        }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const result: any = await db.getOrCreateGroupDocument();
      expect((db as any).createDocument).toHaveBeenCalledWith(
        expect.objectContaining({ type: AxesDocument, kind: GroupDocument }));
      expect(setCalls[0]).toMatchObject({ documentKey: "minted-key", createdBy: expect.any(String) });
      expect(updateCalls[0]).toEqual({ canonical: "default" });
      expect(logSpy).toHaveBeenCalledWith(LogEventName.CREATE_GROUP_DOCUMENT);
      expect(result.opened).toBeDefined();
      // The create path already has the metadata it just wrote, so opening it costs no extra read.
      expect((db as any).findFirestoreMetadata).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("lost race: cleans up the orphan and opens the winner's doc", async () => {
      (db as any).createDocument = jest.fn(async () => ({ firestoreMetadata: { key: "my-key" } }));
      const orphanSpy = jest.spyOn(db as any, "deleteOrphanDocument").mockResolvedValue(undefined);
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }), delete: () => Promise.resolve() }),
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

  describe("resolveGroupDocument", () => {
    // Several of these tests drive paths that warn; the spy keeps the run's output clean and gives the
    // tests that do assert on a warning something to assert against.
    let warnSpy: jest.SpyInstance;
    beforeEach(() => {
      stores.user = UserModel.create({ id: "1", portal: "example.com", offeringId: "off-1", currentGroupId: "3" });
      (db as any).openDocumentFromFirestoreMetadata = jest.fn();
      (db as any).findFirestoreMetadata = jest.fn();
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    // Every pointer path the client asked Firestore for, in order. The paths are full paths (firestore.doc
    // prepends the root folder), so assertions match on the canonical-path suffix.
    const mockPointerFetches = (fetchedPaths: string[], key = (path: string) => `doc-for-${path}`) => {
      mockFirestore.mockImplementation(() => ({
        doc: (path: string) => {
          fetchedPaths.push(path);
          return { get: () => Promise.resolve({ exists: true, data: () => ({ documentKey: key(path) }) }) };
        }
      }));
    };

    it("fast path: returns the pointer's documentKey without opening anything", async () => {
      const fetchedPaths: string[] = [];
      mockPointerFetches(fetchedPaths, () => "existing");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      expect(await db.resolveGroupDocument()).toBe("existing");
      // Pin the slot the resolver reads: a wrongly-constructed path would otherwise pass against any mock.
      expect(fetchedPaths[0]).toContain(getCanonicalPointerPath({
        classHash: stores.user.classHash, offeringId: "off-1",
        owner: "group_off-1_3", label: kDefaultCanonicalDocumentLabel
      }));
      expect((db as any).openDocumentFromFirestoreMetadata).not.toHaveBeenCalled();
      expect((db as any).findFirestoreMetadata).not.toHaveBeenCalled();
    });

    it("throws when the user is not in a group with an offering", async () => {
      stores.user = UserModel.create({ id: "1", portal: "example.com" });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await expect(db.resolveGroupDocument()).rejects.toThrow();
    });

    it("two concurrent resolves of the same slot share one resolution (no create churn)", async () => {
      const createSpy = jest.spyOn(db, "createDocument")
        .mockResolvedValue({ firestoreMetadata: { key: "minted-key" } } as any);
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({ get: async () => ({ exists: false }), set: () => {}, update: () => {} }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const [k1, k2] = await Promise.all([db.resolveGroupDocument(), db.resolveGroupDocument()]);
      expect(k1).toBe("minted-key");
      expect(k2).toBe("minted-key");
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect((db as any).openDocumentFromFirestoreMetadata).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });

    it("no pointer: creates the group's document without querying for an older one", async () => {
      const createSpy = jest.spyOn(db, "createDocument")
        .mockResolvedValue({ firestoreMetadata: { key: "minted-key" } } as any);
      const collectionSpy = jest.fn();
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
        collection: collectionSpy
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({ get: async () => ({ exists: false }), set: () => {}, update: () => {} }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      expect(await db.resolveGroupDocument()).toBe("minted-key");
      expect(collectionSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });

    it("a rejected resolve is evicted from the memo, so a later call retries", async () => {
      const createSpy = jest.spyOn(db, "createDocument")
        .mockRejectedValueOnce(new Error("create failed"))
        .mockResolvedValue({ firestoreMetadata: { key: "second-key" } } as any);
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({ get: async () => ({ exists: false }), set: () => {}, update: () => {} }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await expect(db.resolveGroupDocument()).rejects.toThrow("create failed");
      expect(await db.resolveGroupDocument()).toBe("second-key");
      expect(createSpy).toHaveBeenCalledTimes(2);
      createSpy.mockRestore();
    });

    it("disconnect clears the memo, so the next resolve reads the slot again", async () => {
      const fetchedPaths: string[] = [];
      mockPointerFetches(fetchedPaths, () => "existing");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await db.resolveGroupDocument();
      db.disconnect();
      await db.resolveGroupDocument();
      expect(fetchedPaths).toHaveLength(2);
    });

    // The claim txn can reject outright (rules denial, retries exhausted under a whole-class login). The
    // minted document must never be left behind unclaimed: its Firestore metadata is live, so Sort Work
    // would show it permanently.
    it("create-path claim failure: converges on the racer's pointer and deletes the orphan", async () => {
      const createSpy = jest.spyOn(db, "createDocument")
        .mockResolvedValue({ firestoreMetadata: { key: "minted-key", uid: "group_off-1_3" } } as any);
      const orphanSpy = jest.spyOn(db as any, "deleteOrphanDocument").mockResolvedValue(undefined);
      let pointerExists = false;   // the racer claims the slot while our txn is failing
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve(
          pointerExists ? { exists: true, data: () => ({ documentKey: "racer-key" }) } : { exists: false }) }),
      }));
      (db as any).firestore.runTransaction = jest.fn(async () => {
        pointerExists = true;
        throw new Error("permission denied");
      });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      expect(await db.resolveGroupDocument()).toBe("racer-key");
      expect(orphanSpy).toHaveBeenCalledWith("minted-key", "group_off-1_3");
      expect(warnSpy).toHaveBeenCalled();
      createSpy.mockRestore();
    });

    it("create-path claim failure with the slot still empty: deletes the orphan and rejects", async () => {
      const createSpy = jest.spyOn(db, "createDocument")
        .mockResolvedValue({ firestoreMetadata: { key: "minted-key", uid: "group_off-1_3" } } as any);
      const orphanSpy = jest.spyOn(db as any, "deleteOrphanDocument").mockResolvedValue(undefined);
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
      }));
      (db as any).firestore.runTransaction = jest.fn(async () => { throw new Error("permission denied"); });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await expect(db.resolveGroupDocument()).rejects.toThrow("permission denied");
      expect(orphanSpy).toHaveBeenCalledWith("minted-key", "group_off-1_3");
      createSpy.mockRestore();
    });

    // A rejected claim txn is normally aborted, but a lost commit response makes the outcome ambiguous: the
    // claim may have landed. Deleting the minted document then would leave the immutable pointer targeting
    // deleted metadata, so cleanup requires a successful read proving the slot is empty or names another doc.
    it("create-path claim failure with an unreadable slot: keeps the orphan and rejects", async () => {
      const createSpy = jest.spyOn(db, "createDocument")
        .mockResolvedValue({ firestoreMetadata: { key: "minted-key", uid: "group_off-1_3" } } as any);
      const orphanSpy = jest.spyOn(db as any, "deleteOrphanDocument").mockResolvedValue(undefined);
      let pointerReads = 0;
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => ++pointerReads === 1
          ? Promise.resolve({ exists: false })          // fast-path read: no pointer yet
          : Promise.reject(new Error("network down")) }),  // the catch's re-read fails: outcome ambiguous
      }));
      (db as any).firestore.runTransaction = jest.fn(async () => { throw new Error("deadline exceeded"); });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await expect(db.resolveGroupDocument()).rejects.toThrow("deadline exceeded");
      expect(orphanSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });

    it("dedup is per slot: repeat resolves reuse it, a different group fetches its own pointer", async () => {
      const fetchedPaths: string[] = [];
      mockPointerFetches(fetchedPaths);
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const k3 = await db.resolveGroupDocument();
      expect(await db.resolveGroupDocument()).toBe(k3);   // memoized: no second read of group 3's slot
      stores.user.setCurrentGroupId("4");
      const k4 = await db.resolveGroupDocument();
      expect(k4).not.toBe(k3);
      expect(fetchedPaths).toHaveLength(2);   // one fetch per slot, not per call
    });

    // The slot path is fixed when the resolve starts; the document is minted later from the stores as
    // they are then. Without a guard, a switch in between mints a document for the new group while
    // claiming the old group's slot.
    it("aborts rather than minting for the new group when membership moves mid-resolve", async () => {
      const createSpy = jest.spyOn(db, "createDocument")
        .mockResolvedValue({ firestoreMetadata: { key: "minted-key" } } as any);
      mockFirestore.mockImplementation(() => ({
        doc: () => ({
          get: () => {
            stores.user.setCurrentGroupId("4");   // membership moves while the slot read is in flight
            return Promise.resolve({ exists: false });
          }
        }),
      }));
      // Stubbed so that without the guard the claim succeeds and the resolve returns a key, rather than
      // failing for an unrelated reason.
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({ get: async () => ({ exists: false }), set: () => {}, update: () => {} }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      // A distinct type rather than a message, so callers can tell this apart from a real failure.
      await expect(db.resolveGroupDocument()).rejects.toBeInstanceOf(CanonicalSlotOwnerChangedError);
      // Nothing is minted, so there is no stray document for the other group's resolve to adopt.
      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });

  // A new document's Firestore metadata is built from the stores in one synchronous pass, so everything
  // the stores contribute agrees with whatever the caller validated just before creating.
  describe("Firestore metadata content is pinned before any await", () => {
    beforeEach(() => {
      stores.user = UserModel.create({
        id: "1", portal: "example.com", classHash: "class-h", offeringId: "off-1", currentGroupId: "3"
      });
    });

    // `onFirstWrite` fires on the document write, which is the first await in createDocument — after its
    // synchronous prologue and before the Firestore metadata is written.
    const stubRtdbForCreate = (onFirstWrite?: () => void) => {
      mockDatabase.mockImplementation(() => ({
        ref: () => ({
          push: () => ({
            key: "new-key",
            set: () => { onFirstWrite?.(); return Promise.resolve(); }
          }),
          set: () => Promise.resolve(),
          once: () => Promise.resolve({ val: () => ({ createdAt: 999 }) })
        })
      }));
    };

    it("builds a snapshot of the stores rather than a live view of them", async () => {
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const content: any = db.buildFirestoreMetadataContent({
        documentKey: "gk", type: AxesDocument, kind: GroupDocument, owner: "group_off-1_3"
      });
      stores.user.setCurrentGroupId("4");
      expect(content.groupId).toBe("3");
    });

    it("createDocument pins the owner's group before the first write, so a switch cannot alter it", async () => {
      const written: any[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: () => ({
          get: () => Promise.resolve({ exists: false }),
          set: (data: any) => { written.push(data); return Promise.resolve(); }
        })
      }));
      stubRtdbForCreate(() => stores.user.setCurrentGroupId("4"));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await db.createDocument({ type: AxesDocument, kind: GroupDocument });
      // Both come from the same reading of currentGroupId, so neither follows the switch.
      expect(written[0]).toMatchObject({ uid: "group_off-1_3", groupId: "3" });
    });

    it("merges the resolved createdAt into the content it was given", async () => {
      const written: any[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: () => ({
          get: () => Promise.resolve({ exists: false }),
          set: (data: any) => { written.push(data); return Promise.resolve(); }
        })
      }));
      stubRtdbForCreate();
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await db.createDocument({ type: AxesDocument, kind: GroupDocument });
      // The RTDB read resolves the server timestamp; Firestore stores the same value.
      expect(written[0].createdAt).toBe(999);
    });
  });

  // These pin which fields the builder derives from the stores and which it takes from its caller. They
  // need no Firestore mock: building the content is synchronous and writing it is a separate step, covered
  // by "Firestore metadata content is pinned before any await" above.
  it("builds group-document metadata with no contextId", async () => {
    // group scope: the builder derives context_id/groupId/offeringId from the stores.
    stores = specStores({
      appMode: "test",
      documents: DocumentsModel.create(),
      user: UserModel.create({
        id: "1", portal: "example.com", classHash: "class-h", offeringId: "off-1", currentGroupId: "3"
      })
    });
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    // context_id/groupId/offeringId come from the user via the kind's scope; owner→uid is passed directly.
    const content = db.buildFirestoreMetadataContent({
      documentKey: "gk", type: AxesDocument, kind: GroupDocument, owner: "group_off-1_3"
    });
    expect(content).toMatchObject({
      context_id: "class-h", network: null, key: "gk", uid: "group_off-1_3", groupId: "3", offeringId: "off-1"
    });
    expect(content).not.toHaveProperty("contextId");
  });

  it("stamps the axis profile a class-wide document is created at, without reaching the runtime", async () => {
    registerClassWideDocumentKind("testProfileStamp", "DQB", "msu");
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    const content = db.buildFirestoreMetadataContent({
      documentKey: "dqb", type: AxesDocument, kind: "testProfileStamp", owner: "class_c1"
    });
    // Every kind a unit declares lands on this one profile, which is what makes the profile — not the
    // kind — the cohort a migration can select on.
    expect(content).toMatchObject({ kind: "testProfileStamp", axisProfile: "classWide" });
    // The value is built and written, but `IDocumentMetadata` — what the write returns — does not declare
    // it, so a consumer cannot read it back without widening a type first. The barrier is at the type
    // level; see document-axis-profiles.test.ts for the runtime model staying clear of it.
  });

  it("does NOT stamp an axis profile on a personal document", async () => {
    // Same gate as `kind`: only axes-typed documents are stamped, so nothing is written that would have
    // to be migrated if the other types' kinds are reorganized.
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    const content = db.buildFirestoreMetadataContent({
      documentKey: "pk", type: PersonalDocument, kind: PersonalDocument, owner: "user-1"
    });
    expect(content).not.toHaveProperty("axisProfile");
  });

  it("stamps kind and concurrent on an axes-typed document's metadata", async () => {
    stores.user.setCurrentGroupId("3");   // group scope: the builder derives groupId from the stores
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    const content = db.buildFirestoreMetadataContent({
      documentKey: "gk", type: AxesDocument, kind: GroupDocument, owner: "group_off-1_3"
    });
    expect(content).toMatchObject({ kind: "group", concurrent: true, axisProfile: "group" });
  });

  it("does NOT stamp kind/concurrent on a personal document", async () => {
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    const content = db.buildFirestoreMetadataContent({
      documentKey: "pk", type: PersonalDocument, kind: PersonalDocument, owner: "user-1", title: "t"
    });
    // `kind` is stamped only on axes-typed docs; other docs are left kind-less to avoid persisting a
    // (possibly-to-be-consolidated) publication/personal kind we would later have to migrate.
    expect(content).not.toHaveProperty("kind");
    expect(content).not.toHaveProperty("concurrent");
  });

  it("stamps context_id from the user's classHash", async () => {
    stores = specStores({
      appMode: "test",
      documents: DocumentsModel.create(),
      user: UserModel.create({ id: "1", portal: "example.com", classHash: "class-h" })
    });
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
    // context_id is stamped from the user's classHash (it is the class scope field).
    const content = db.buildFirestoreMetadataContent({
      documentKey: "pk", type: PersonalDocument, kind: PersonalDocument, owner: "user-1", title: "t"
    });
    expect(content).toMatchObject({ context_id: "class-h", key: "pk" });
  });

  describe("class-wide document creation", () => {
    it("builds class+unit scope, kind, and concurrent (but not title)", async () => {
      // The kind must be registered as class-scoped so getDocumentKindMetadataFields returns its axis fields and
      // getDocumentLocationFields returns the class `unit` (read from the stores' current unit). The authored title
      // is registered too, to prove it is resolved by kind and NOT persisted into the Firestore metadata.
      registerDocumentKind("drivingQuestionBoard", {
        profile: kClassWideProfile,
        title: "Driving Question Board"
      });
      // Rebuild stores with the classHash (→ context_id) and the current unit code the class-wide scope uses.
      stores = specStores({
        appMode: "test",
        documents: DocumentsModel.create(),
        user: UserModel.create({ id: "1", portal: "example.com", classHash: "class-1" }),
        unit: UnitModel.create({ code: "msu", title: "Unit" })
      });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      // The unit (from the kind's class scope) and context_id (the user's classHash) come from the stores; owner
      // is passed directly. No title is passed — a class-wide doc's title is resolved live by kind at display.
      const content: any = db.buildFirestoreMetadataContent({
        documentKey: "dqb-1", type: AxesDocument, kind: "drivingQuestionBoard", owner: "class_class-1"
      });
      expect(content).toMatchObject({
        type: "axes", context_id: "class-1", unit: "msu",
        kind: "drivingQuestionBoard", concurrent: true, uid: "class_class-1"
      });
      expect(content.title).toBeUndefined();       // title is looked up by kind, never stored
      expect(content.offeringId).toBeUndefined();
      expect(content.groupId).toBeUndefined();
      expect(content.canonical).toBeUndefined();   // canonical is set only by the pointer-claim transaction
      // The class+unit scope states its absent curriculum fields explicitly so the scope is queryable.
      expect(content.investigation).toBeNull();
      expect(content.problem).toBeNull();
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
        profile: kClassWideProfile,
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
        type: AxesDocument,
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

    it("takes concurrent and kind from stored metadata", async () => {
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const firestoreMetadata = {
        uid: "g", type: AxesDocument, key: "g2", context_id: "class-1", concurrent: true, kind: "group"
      } as any;
      const doc = await db.openDocument({
        documentKey: "g2", type: AxesDocument, userId: "g", firestoreMetadata
      } as any);
      expect(doc.concurrent).toBe(true);
      expect(doc.kind).toBe("group");
    });

    it("derives kind from the registry for a type that stores none", async () => {
      // Only axes-typed documents store `kind`; every other type is a registered kind of the same name.
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const firestoreMetadata = { uid: "u", type: "problem", key: "p2", context_id: "class-1" } as any;
      const doc = await db.openDocument({ documentKey: "p2", type: "problem", userId: "u", firestoreMetadata } as any);
      expect(doc.kind).toBe("problem");
      expect(doc.concurrent).toBeFalsy();
    });

    it("does not supply or write concurrent for an axes document that lacks it", async () => {
      // The stored field is the only authority: the Firestore rules key on it, so the model must agree.
      const setSpy = jest.fn(() => Promise.resolve());
      mockFirestore.mockImplementation(() => ({ doc: () => ({ set: setSpy }) }));
      stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
      const firestoreMetadata = {
        uid: "g", type: AxesDocument, key: "g3", context_id: "class-1", kind: "group"
      } as any;
      const doc = await db.openDocument({
        documentKey: "g3", type: AxesDocument, userId: "g", firestoreMetadata
      } as any);
      expect(doc.concurrent).toBeFalsy();
      expect(setSpy).not.toHaveBeenCalled();
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

  describe("autoResolveGroupDocuments", () => {
    beforeEach(() => {
      stores.user = UserModel.create({ id: "1", portal: "example.com", type: "student", offeringId: "off-1" });
      stores.appConfig.setConfigs([{ groupDocumentsEnabled: true }]);
    });

    it("resolves the group document when membership arrives, and again on group switch", async () => {
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      expect(resolveSpy).not.toHaveBeenCalled();       // no group yet
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).toHaveBeenCalledTimes(1);
      stores.user.setCurrentGroupId("4");
      expect(resolveSpy).toHaveBeenCalledTimes(2);
    });

    it("does nothing when group documents are not enabled", async () => {
      stores.appConfig.setConfigs([{ groupDocumentsEnabled: false }]);
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).not.toHaveBeenCalled();
    });

    it("does nothing for a teacher", async () => {
      stores.user = UserModel.create({ id: "1", portal: "example.com", type: "teacher", offeringId: "off-1" });
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).not.toHaveBeenCalled();
    });

    it("resolves immediately when membership is already known at registration", async () => {
      stores.user = UserModel.create({ id: "1", portal: "example.com", type: "student",
        offeringId: "off-1", currentGroupId: "3" });
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      expect(resolveSpy).toHaveBeenCalledTimes(1);
    });

    it("re-registration disposes the previous reaction", async () => {
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      (db as any).autoResolveGroupDocuments();
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).toHaveBeenCalledTimes(1);   // not 2
    });

    it("disconnect disposes the reaction", async () => {
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      db.disconnect();
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).not.toHaveBeenCalled();
    });

    // Membership moving mid-resolve is ordinary and self-correcting — the switch that caused it has
    // already started a resolve for the new group — so reporting it as a failure would cry wolf.
    it("stays quiet when a resolve is abandoned because membership moved", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument")
        .mockRejectedValue(new CanonicalSlotOwnerChangedError("slots/a", "slots/b"));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      stores.user.setCurrentGroupId("3");
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(errorSpy).not.toHaveBeenCalled();
      resolveSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("still reports a resolve that failed for any other reason", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument")
        .mockRejectedValue(new Error("firestore unavailable"));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      stores.user.setCurrentGroupId("3");
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(errorSpy).toHaveBeenCalled();
      resolveSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

});
