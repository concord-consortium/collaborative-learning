import { DB } from "./db";
import { createDocumentsModelWithRequiredDocuments, DocumentsModel } from "../models/stores/documents";
import { DBDocument } from "./db-types";
import { DocumentModel } from "../models/document/document";
import { DocumentContentModel } from "../models/document/document-content";
import { PersonalDocument, PlanningDocument, ProblemDocument } from "../models/document/document-types";
import { specStores } from "../models/stores/spec-stores";
import { IStores } from "../models/stores/stores";
import { UserModel } from "../models/stores/user";
import { TextContentModelType } from "../models/tools/text/text-content";
import { ToolTileModelType } from "../models/tools/tool-tile";
import { createSingleTileContent } from "../utilities/test-utils";
import * as UrlParams from "../utilities/url-params";

// This is needed so MST can deserialize snapshots referring to tools
import "../register-tools";

var mockDatabase = jest.fn();
var mockFirestore = jest.fn();
var mockFunctions = jest.fn();
var mockAuthStateUnsubscribe = jest.fn();

jest.mock("firebase/app", () => {
  return {
    apps: [],
    initializeApp: () => null,
    auth: () => ({
      onAuthStateChanged: (callback: (user: any) => void) => {
        callback({ uid: "user-id" });
        return mockAuthStateUnsubscribe;
      },
      signInAnonymously: () => Promise.resolve()
    }),
    database: () => mockDatabase(),
    firestore: () => mockFirestore(),
    functions: () => mockFunctions()
  };
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
    stores.appMode = "dev";
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
    docContent.tileMap.forEach((tile: ToolTileModelType) => {
      const tileContent = tile.content as TextContentModelType;
      expect(tileContent.type).toBe("Text");
      expect(tileContent.format).toBeUndefined();
      expect(tileContent.text).toBe("Testing");
    });
  });

  it("creates required problem document", async () => {
    expect.assertions(3);
    const newDocument = DocumentModel.create({ uid: "1", type: ProblemDocument, key: "doc-1" });
    mockDatabase.mockImplementation(() => ({
      ref: () => ({
        once: () => ({
          then: (callback: (snap: any) => any) => {
            // offeringUserRef.once("value")
            callback({ val: () => true });
            return { then: () => ({
              // this is where we actually create the document
              then: (_callback: () => any) => {
                // this is where we update the relevant promise
                const docPromise = _callback();
                stores.documents.resolveRequiredDocumentPromise(newDocument);
                return docPromise;
              }
            })};
          }
        })
      })
    }));
    stores.documents = createDocumentsModelWithRequiredDocuments([ProblemDocument, PlanningDocument]);
    stores.documents.resolveAllRequiredDocumentPromisesWithNull();
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect((await db.guaranteeOpenDefaultDocument(ProblemDocument))?.type).toBe(ProblemDocument);
    expect(await stores.documents.requiredDocuments[ProblemDocument].promise).toEqual(newDocument);
    expect(await stores.documents.requiredDocuments[PlanningDocument].promise).toBeNull();
  });

  it("creates required planning document", async () => {
    expect.assertions(3);
    const newDocument = DocumentModel.create({ uid: "1", type: PlanningDocument, key: "doc-1" });
    mockDatabase.mockImplementation(() => ({
      ref: () => ({
        once: () => ({
          then: (callback: (snap: any) => any) => {
            // offeringUserRef.once("value")
            callback({ val: () => true });
            return { then: () => ({
              // this is where we actually create the document
              then: (_callback: () => any) => {
                // this is where we update the relevant promise
                const docPromise = _callback();
                stores.documents.resolveRequiredDocumentPromise(newDocument);
                return docPromise;
              }
            })};
          }
        })
      })
    }));
    stores.documents = createDocumentsModelWithRequiredDocuments([ProblemDocument, PlanningDocument]);
    stores.documents.resolveAllRequiredDocumentPromisesWithNull();
    await db.connect({appMode: "test", stores, dontStartListeners: true});
    expect((await db.guaranteePlanningDocument([]))?.type).toBe(PlanningDocument);
    expect(await stores.documents.requiredDocuments[PlanningDocument].promise).toEqual(newDocument);
    expect(await stores.documents.requiredDocuments[ProblemDocument].promise).toBeNull();
  });

  it("creates required personal document from existing promise", async () => {
    const personalDocument = DocumentModel.create({ uid: "1", type: PersonalDocument, key: "doc-1" });
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
      await db.guaranteePlanningDocument([]);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    await jestSpyConsole("error", async spy => {
      await db.guaranteeLearningLog();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

});
