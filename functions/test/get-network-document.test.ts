import {
  apps, clearFirestoreData, initializeAdminApp, useEmulators
} from "@firebase/rules-unit-testing";
import { getNetworkDocument } from "../src/get-network-document";
import { IGetNetworkDocumentParams } from "../src/shared";
import { buildFirebaseImageUrl, parseFirebaseImageUrl } from "../src/shared-utils";
import { validateUserContext } from "../src/user-context";
import {
  kCanonicalPortal, kClassHash, kPlatformUserId, kPortal, kTeacherName, kTeacherNetwork, kUserId,
  specAuth, specDocumentContent, specUserContext
} from "./test-utils";

useEmulators({
  database: { host: "localhost", port: 9000 },
  firestore: { host: "localhost", port: 8088 }
});

// Considerable trial and error was required to come up with this mock
// Initialize the mock admin app using initializeAdminApp from @firebase/rules-unit-testing
const kCLUEFirebaseProjectId = "collaborative-learning-ec215";
const mockAdmin = initializeAdminApp({ databaseName: kCLUEFirebaseProjectId, projectId: kCLUEFirebaseProjectId });

// by default get requests respond as though the requested data doesn't exist
// test can override via mockDatabaseGet.mockImplementation(path => ...) to return
// appropriate data based on the path requested.
var mockDatabaseGet = jest.fn();

// Mock the actual "firebase-admin" module so that clients get our mock instead
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual("firebase-admin");
  // These lines are patterned after code in the "firebase-admin" module which attaches namespace
  // properties from the original namespaces (e.g. Timestamp) to the returned functions.
  // This allows admin.firestore() to be used as a function that returns the firestore instance
  // as well as a namespace (e.g admin.firestore.Timestamp). The mock is replacing the function
  // but attaching the original namespace contents.

  // Unfortunately, while the indirection works for firestore it seems not to work for the realtime database
  // for reasons that I don't understand. For now, we simply use offline mocking of realtime database calls.
  const mockDatabase = jest.fn(() => {
    return ({
      ref: jest.fn(path => {
        return ({
          get: () => mockDatabaseGet(path)
        });
      })
    });
  });
  // const mockDatabase = () => mockAdmin.database();
  // Object.assign(mockDatabase, actualAdmin.database);
  const mockFirestore = () => mockAdmin.firestore();
  Object.assign(mockFirestore, actualAdmin.firestore);
  return {
    // We pass through calls to initializeApp to the original implementation so that the call
    // to initializeAdminApp above (which calls initializeApp under the hood) will succeed.
    initializeApp: (...args: any[]) => actualAdmin.initializeApp(...args),
    // Mock the APIs used by the cloud functions
    database: mockDatabase,
    firestore: mockFirestore
  };
});

// const databaseAdmin = mockAdmin.database();
const firestoreAdmin = mockAdmin.firestore();

const authWithNoClaims = { auth: { uid: kUserId, token: {} } };
const kTeacherAuthClaims = { platform_id: kPortal, platform_user_id: kPlatformUserId,
                              user_type: "teacher", class_hash: kClassHash }
const authWithTeacherClaims = { auth: specAuth({ token: kTeacherAuthClaims }) };

async function writeTeacherRecordToFirestore(overrides?: any) {
  const user = { uid: kUserId, name: kTeacherName, type: "teacher",
                  network: kTeacherNetwork, networks: [kTeacherNetwork], ...overrides };
  return await firestoreAdmin.doc(`/authed/test_portal/users/${kUserId}`).set(user);
}

async function writeClassRecordToFirestore(overrides?: any) {
  const { id = "101", context_id = kClassHash, root = "/authed/test_portal" } = overrides || {};
  const _class = { id, name: "Class 1", uri: `https://concord.org/class/${id}`, context_id,
                  teacher: kTeacherName, teachers: [kUserId], network: kTeacherNetwork, ...overrides };
  return await firestoreAdmin.doc(`${root}/classes/${kTeacherNetwork}_${context_id}`).set(_class);
}

const kDocClassHash = "document-class-hash";
const kDocUserId = "document-user";
const kDocKey = "document-key";

function specDocument(additions?: any, subtractions?: string[]) {
  const specDoc = { context_id: kDocClassHash, uid: kDocUserId, key: kDocKey, ...additions };
  subtractions?.forEach(prop => delete specDoc[prop]);
  return specDoc;
}

describe("getNetworkDocument", () => {

  beforeEach(async () => {
    await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });

    // by default get requests respond as though the requested data doesn't exist
    mockDatabaseGet.mockImplementation(path => Promise.resolve({ exists: () => false, val: () => null }));
  });

  afterAll(async () => {
    // comment out the next line to observe the firebase contents in the visual emulator at the end of the tests
    await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
    // https://firebase.google.com/docs/firestore/security/test-rules-emulator#run_local_tests
    await Promise.all(apps().map(app => app.delete()));
  });

  it("should fail without sufficient arguments", async () => {
    await expect(getNetworkDocument()).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    await expect(getNetworkDocument({ warmUp: true })).resolves.toHaveProperty("version");
  });

  it("should fail without valid arguments", async () => {
    await expect(getNetworkDocument({} as any, {} as any)).rejects.toBeDefined();
  });

  it("should fail without corresponding teacher record in firestore", async () => {
    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid network", async () => {
    await writeTeacherRecordToFirestore();

    const context = specUserContext({}, ["network"]);
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail if teacher network doesn't match firestore", async () => {
    await writeTeacherRecordToFirestore({ network: "other-network" });

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail with bogus network", async () => {
    await writeTeacherRecordToFirestore();

    const context = specUserContext({ network: "bogus-network"});
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail if no matching class in requested network", async () => {
    await writeTeacherRecordToFirestore();

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail if document uid not specified", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ context_id: kDocClassHash });

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument({}, ["uid"]) };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail if document class not specified", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ context_id: kDocClassHash });

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument({}, ["context_id"]) };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail if document key not specified", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ context_id: kDocClassHash });

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument({}, ["documentKey"]) };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail if document doesn't exist in database", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ context_id: kDocClassHash });

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail if document content doesn't exist in database", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ context_id: kDocClassHash });

    const problemDocumentMetadata = {
            version: "1.0", self: { classHash: kDocClassHash, offeringId: "1001", uid: kDocUserId,
            visibility: "public", documentKey: kDocKey }
          };
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        [`/authed/portals/${kCanonicalPortal}/classes/${kDocClassHash}/users/${kDocUserId}/documentMetadata/${kDocKey}`]:
          problemDocumentMetadata
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    await expect(getNetworkDocument(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should return document content if it exists", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ context_id: kDocClassHash });

    const problemDocumentMetadata = {
            version: "1.0", self: { classHash: kDocClassHash, offeringId: "1001", uid: kDocUserId,
            visibility: "public", documentKey: kDocKey }
          };
    const problemDocumentContent = {};
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        [`/authed/portals/${kCanonicalPortal}/classes/${kDocClassHash}/users/${kDocUserId}/documentMetadata/${kDocKey}`]:
          problemDocumentMetadata,
        [`/authed/portals/${kCanonicalPortal}/classes/${kDocClassHash}/users/${kDocUserId}/documents/${kDocKey}`]:
          problemDocumentContent
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const context = specUserContext();
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    const response = await getNetworkDocument(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    expect(response.content).toEqual(problemDocumentContent);
    expect(response.metadata).toEqual(problemDocumentMetadata);
  });

  it("should return document content for demo users", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ root: "/demo/demo-name", context_id: kDocClassHash });

    const problemDocumentMetadata = {
            version: "1.0", self: { classHash: kDocClassHash, offeringId: "1001", uid: kDocUserId,
            visibility: "public", documentKey: kDocKey }
          };
    const problemDocumentContent = {};
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        [`/demo/demo-name/portals/demo/classes/${kDocClassHash}/users/${kDocUserId}/documentMetadata/${kDocKey}`]:
          problemDocumentMetadata,
        [`/demo/demo-name/portals/demo/classes/${kDocClassHash}/users/${kDocUserId}/documents/${kDocKey}`]:
          problemDocumentContent
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const context = specUserContext({ appMode: "demo" });
    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    const response = await getNetworkDocument(params, authWithNoClaims as any);
    expect(response).toHaveProperty("version");
    expect(response.content).toEqual(problemDocumentContent);
    expect(response.metadata).toEqual(problemDocumentMetadata);
  });

  it("should return content with image urls canonicalized", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore({ context_id: kDocClassHash });

    const context = specUserContext();
    const { classPath: userClassPath } = validateUserContext(context, authWithTeacherClaims.auth);
    const docClassPath = userClassPath.replace(kClassHash, kDocClassHash);

    const canonicalUrl = buildFirebaseImageUrl(kDocClassHash, "image-key");
    const { legacyUrl } = parseFirebaseImageUrl(canonicalUrl);
    const originalContent = specDocumentContent([
      { type: "Image", changes: [{ url: legacyUrl }] }
    ]);
    const updatedContent = originalContent.replace(legacyUrl, canonicalUrl);

    const problemDocumentMetadata = {
            version: "1.0", self: { classHash: kDocClassHash, offeringId: "1001", uid: kDocUserId,
            visibility: "public", documentKey: kDocKey }
          };
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        [`${docClassPath}/users/${kDocUserId}/documentMetadata/${kDocKey}`]:
          problemDocumentMetadata,
        [`${docClassPath}/users/${kDocUserId}/documents/${kDocKey}`]:
          originalContent
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const params: IGetNetworkDocumentParams = { context, ...specDocument() };
    const response = await getNetworkDocument(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    expect(response.content).toEqual(updatedContent);
    expect(response.metadata).toEqual(problemDocumentMetadata);
    expect(response.images).toEqual({ [legacyUrl]: canonicalUrl });
  });

});
