import { apps, clearFirestoreData, initializeAdminApp, useEmulators } from "@firebase/rules-unit-testing";
import { getImageData } from "../src/get-image-data";
import { IGetImageDataParams } from "../src/shared";
import {
  kCanonicalPortal, kClassHash, kOtherClassHash, kOtherTeacherNetwork, kTeacherNetwork,
  specAuth, specStudentContext, specUserContext
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

// const authWithNoClaims = { auth: { uid: kUserId, token: {} } };
const authWithStudentClaims = { auth: specAuth({ token: { user_type: "student" } }) };
const authWithTeacherClaims = { auth: specAuth({ token: { user_type: "teacher" } }) };

const kTestBaseClassPath = `/authed/portals/${kCanonicalPortal}`;
const kImageKey = "ImageKey";
const kSupportKey = "SupportKey";

function specImageUrl(key = kImageKey, classHash?: string) {
  return `ccimg://fbrtdb.concord.org${classHash ? `/${classHash}` : ""}/${key}`;
}

async function writeMCImageRecordToFirestore(overrides?: any) {
  const {
    context_id = kClassHash, imageClassHash = kOtherClassHash, root = `/authed/${kCanonicalPortal}`
  } = overrides || {};
  const mcimage = {
    url: specImageUrl(),
    classes: [context_id, imageClassHash],
    classPath: `${kTestBaseClassPath}/${imageClassHash}`,
    network: kTeacherNetwork,
    supportKey: kSupportKey,
    platform_id: kCanonicalPortal,
    context_id,
    ...overrides
  };
  return await firestoreAdmin.doc(`${root}/mcimages/${kSupportKey}_${kImageKey}`).set(mcimage);
}

describe("getImageData", () => {

  beforeEach(async () => {
    await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });

    // by default get requests respond as though the requested data doesn't exist
    mockDatabaseGet.mockReset();
    mockDatabaseGet.mockImplementation(path => Promise.resolve({ exists: () => false, val: () => null }));
  });

  afterAll(async () => {
    // comment out the next line to observe the firebase contents in the visual emulator at the end of the tests
    await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
    // https://firebase.google.com/docs/firestore/security/test-rules-emulator#run_local_tests
    await Promise.all(apps().map(app => app.delete()));
  });

  it("should fail without sufficient arguments", async () => {
    await expect(getImageData()).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    await expect(getImageData({ warmUp: true })).resolves.toHaveProperty("version");
  });

  it("should fail without valid arguments", async () => {
    await expect(getImageData({} as any, {} as any)).rejects.toBeDefined();
  });

  it("should fail without image url", async () => {
    const context = specStudentContext();
    const params: IGetImageDataParams = { context } as any;
    await expect(getImageData(params, authWithStudentClaims as any)).rejects.toBeDefined();
  });

  it("should fail with invalid image url", async () => {
    const context = specStudentContext();
    const params: IGetImageDataParams = { context, url: "bogus-url" } as any;
    await expect(getImageData(params, authWithStudentClaims as any)).rejects.toBeDefined();
  });

  it("should fail if asked to retrieve image that doesn't exist", async () => {
    const context = specStudentContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toBeFalsy();
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

  it("should fail gracefully if firebase image data request rejects", async () => {
    // all requests respond with rejected promise
    mockDatabaseGet.mockImplementation((path: string) => Promise.reject());
    const context = specStudentContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toBeFalsy();
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

  it("should succeed if asked to retrieve image data in user's class via legacy url", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    const context = specStudentContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toHaveProperty("imageData");
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

  it("should succeed if asked to retrieve image data in user's class via newer url", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    const context = specStudentContext();
    const url = specImageUrl(kImageKey, kClassHash);
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toHaveProperty("imageData");
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

  it("should fail if asked to retrieve image data in another class without mcimages entry", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kOtherClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    const context = specStudentContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toBeFalsy();
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

  it("should fail if asked to retrieve image data in another class with incorrect mcimages entry", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kOtherClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    await writeMCImageRecordToFirestore({ imageClassHash: "wrong-class" });

    const context = specStudentContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toBeFalsy();
    expect(mockDatabaseGet).toHaveBeenCalledTimes(2);
  });

  it("should fail if asked to retrieve image data in another class from unsanctioned class", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kOtherClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    // the requested image hasn't been shared with this user's class
    await writeMCImageRecordToFirestore({ classes: [kOtherClassHash] });

    const context = specStudentContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toBeFalsy();
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

  it("should succeed if asked to retrieve image data in another class from networked teacher", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kOtherClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    // the requested image hasn't been shared with this user's class but is in same network
    await writeMCImageRecordToFirestore({ classes: [kOtherClassHash] });

    const context = specUserContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("imageData");
    expect(mockDatabaseGet).toHaveBeenCalledTimes(2);
  });

  it("should fail if asked to retrieve image data in another class from other network", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kOtherClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    // the requested image hasn't been shared with this user's class and is not in same network
    await writeMCImageRecordToFirestore({ classes: [kOtherClassHash] });

    const context = specUserContext({ network: kOtherTeacherNetwork });
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithTeacherClaims as any);
    expect(response).toBeFalsy();
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

  it("should succeed if asked to retrieve image data in another class with mcimages entry (legacy url)", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kOtherClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    await writeMCImageRecordToFirestore();

    const context = specStudentContext();
    const url = specImageUrl();
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toHaveProperty("imageData");
    // with legacy url we issue a failed request before issuing the successful one
    expect(mockDatabaseGet).toHaveBeenCalledTimes(2);
  });

  it("should succeed if asked to retrieve image data in another class with mcimages entry (newer url)", async () => {
    // return image data if request contains appropriate class and key
    mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
      path.includes(kOtherClassHash) && path.endsWith(kImageKey)
        ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
        : { exists: () => false, val: () => null }
    ));
    await writeMCImageRecordToFirestore();

    const context = specStudentContext();
    const url = specImageUrl(kImageKey, kOtherClassHash);
    const params: IGetImageDataParams = { context, url };
    const response = await getImageData(params, authWithStudentClaims as any);
    expect(response).toHaveProperty("imageData");
    // with newer url we don't issue the failed request before issuing the successful one
    expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  });

});
