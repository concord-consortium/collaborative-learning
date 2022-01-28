import { apps, clearFirestoreData, initializeAdminApp, useEmulators } from "@firebase/rules-unit-testing";
import { canonicalizeUrl, publishSupport } from "../src/publish-support";
import { IPublishSupportParams } from "../src/shared";
import { buildFirebaseImageUrl, parseFirebaseImageUrl, replaceAll } from "../src/shared-utils";
import { kCanonicalPortal, kClassHash, kOtherClassHash, kPortal, specAuth, specUserContext } from "./test-utils";

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
const authWithTeacherClaims = { auth: specAuth({ token: { user_type: "teacher" } }) };

const kTestFirebaseRoot = `/authed/portals/${kCanonicalPortal}`;
const kImageKey = "image-key";
const kOriginDoc = "origin-doc";

type IPublishParams = Omit<IPublishSupportParams, "context">;
interface ISpecPublishParams {
  add?: Partial<IPublishParams>;
  remove?: Array<keyof IPublishParams>;
}
function specPublicationRequest(overrides?: ISpecPublishParams): IPublishParams {
  const { add, remove } = overrides || {};
  const params: IPublishParams = {
    caption: "caption",
    problem: "sas101",
    classes: [kClassHash, kOtherClassHash],
    content: JSON.stringify({ tiles: [] }),
    properties: {},
    originDoc: kOriginDoc,
    originDocType: "personal",
    resource_link_id: "resource-link-id",
    resource_url: "resource-url",
    ...add
  };
  remove?.forEach(prop => delete params[prop]);
  return params;
}

function specImageUrl(key = kImageKey, classHash?: string) {
  return `ccimg://fbrtdb.concord.org${classHash ? `/${classHash}` : ""}/${key}`;
}

async function writeImageRecordToFirestore(overrides?: any) {
  const {
    imageKey = kImageKey, url = specImageUrl(imageKey), platform_id = kPortal,
    context_id = kOtherClassHash, firestoreRoot = `/authed/${kCanonicalPortal}`
  } = overrides || {};
  const image = {
    url,
    classPath: `${kTestFirebaseRoot}/${context_id}`,
    platform_id,
    context_id
  };
  return await firestoreAdmin.doc(`${firestoreRoot}/images/${imageKey}`).set(image);
}

describe("canonicalizeUrl", () => {
  it("should simply return invalid urls", async () => {
    expect(await canonicalizeUrl("", "", "")).toBe("");
    expect(await canonicalizeUrl("bogus", "class-hash", "firestore-root")).toBe("bogus");
  });

  it("should simply return canonical urls", async () => {
    const canonicalUrl = buildFirebaseImageUrl("image-class-hash", "image-key");
    expect(await canonicalizeUrl(canonicalUrl, "class-hash", "firestore-root")).toBe(canonicalUrl);
  });
});

describe("publishSupport", () => {

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
    await expect(publishSupport()).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    await expect(publishSupport({ warmUp: true })).resolves.toHaveProperty("version");
  });

  it("should fail without valid arguments", async () => {
    await expect(publishSupport({} as any, {} as any)).rejects.toBeDefined();
  });

  it("should fail without publish params", async () => {
    const context = specUserContext();
    const params: IPublishSupportParams = { context } as any;
    await expect(publishSupport(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without classes", async () => {
    const context = specUserContext();
    const params: IPublishSupportParams = { context, ...specPublicationRequest({ add: { classes: [] } }) };
    await expect(publishSupport(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without content", async () => {
    const context = specUserContext();
    const params: IPublishSupportParams = { context, ...specPublicationRequest({ remove: ["content"] }) };
    await expect(publishSupport(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should publish supports with no images", async () => {
    const context = specUserContext();
    const specSupportDoc = specPublicationRequest();
    const params: IPublishSupportParams = { context, ...specSupportDoc };
    const result = await publishSupport(params, authWithTeacherClaims as any) as FirebaseFirestore.WriteResult[];
    expect(result.length).toBe(2);  // root time stamp and support document
    const supportsSnapshot = await firestoreAdmin.collection(`/authed/${kCanonicalPortal}/mcsupports`).get();
    expect(supportsSnapshot.size).toBe(1);
    const supportDoc = supportsSnapshot.docs[0].data();
    const matchProps: Array<keyof IPublishParams> = ["classes", "content"];
    matchProps.forEach(prop => {
      expect(supportDoc[prop]).toEqual(specSupportDoc[prop]);
    });
    const expectProps = {
      appMode: "authed",
      type: "supportPublication",
      originDoc: kOriginDoc,
      originDocType: "personal",
      properties: { teacherSupport: "true", caption: "caption" },
      platform_id: "test.portal",
      context_id: kClassHash
    };
    for (const prop in expectProps) {
      expect(supportDoc[prop]).toEqual((expectProps as any)[prop]);
    }
  });

  it("should publish supports with images in same class as support", async () => {
    const context = specUserContext();
    const canonicalUrls = [1, 2, 3].map(i => buildFirebaseImageUrl(kClassHash, `image-${i}`));
    const legacyUrls = canonicalUrls.map(url => parseFirebaseImageUrl(url).legacyUrl);
    const content = JSON.stringify({
      tiles: [
        { type: "Drawing", content: JSON.stringify([{ url: legacyUrls[0] }, { url: legacyUrls[1] }]) },
        { type: "Image", content: JSON.stringify([{ url: legacyUrls[0] }, { url: legacyUrls[2] }]) }
      ]
    });
    const specSupportDoc = specPublicationRequest({ add: { content } });
    const params: IPublishSupportParams = { context, ...specSupportDoc };
    const result = await publishSupport(params, authWithTeacherClaims as any) as FirebaseFirestore.WriteResult[];
    expect(result.length).toBe(5);  // root time stamp and support document
    // validate mcsupports document
    const supportsSnapshot = await firestoreAdmin.collection(`/authed/${kCanonicalPortal}/mcsupports`).get();
    expect(supportsSnapshot.size).toBe(1);
    const supportKey = supportsSnapshot.docs[0].id;
    const supportDoc = supportsSnapshot.docs[0].data();
    let updatedContent = content;
    legacyUrls.forEach((legacyUrl, i) => {
      updatedContent = replaceAll(updatedContent, legacyUrl, canonicalUrls[i]);
    });
    const expectSupportProps = {
      appMode: "authed",
      type: "supportPublication",
      originDoc: kOriginDoc,
      originDocType: "personal",
      properties: { teacherSupport: "true", caption: "caption" },
      content: updatedContent,
      platform_id: "test.portal",
      context_id: kClassHash
    };
    for (const prop in expectSupportProps) {
      expect(supportDoc[prop]).toEqual((expectSupportProps as any)[prop]);
    }
    // validate mcimages documents
    const imagesSnapshot = await firestoreAdmin.collection(`/authed/${kCanonicalPortal}/mcimages`).get();
    expect(imagesSnapshot.size).toBe(3);
    imagesSnapshot.docs.forEach((imageDoc, i) => {
      const legacyUrl = legacyUrls[i];
      const { classes, classPath, platform_id, context_id, resource_link_id, resource_url } = supportDoc;
      const { imageKey } = parseFirebaseImageUrl(legacyUrl)
      expect(imageDoc.id).toBe(`${supportKey}_${imageKey}`)
      expect(imageDoc.data()).toEqual({
        url: legacyUrl, classes, classPath, supportKey, platform_id, context_id, resource_link_id, resource_url
      });
    });
  });

  it("should publish supports with images in different class from support", async () => {
    const context = specUserContext();
    const canonicalUrls = [1, 2, 3].map(i => buildFirebaseImageUrl(kOtherClassHash, `image-${i}`));
    const legacyUrls = canonicalUrls.map(url => parseFirebaseImageUrl(url).legacyUrl);
    const imagePromises = canonicalUrls.map(canonicalUrl => {
      const { imageClassHash: context_id, imageKey } = parseFirebaseImageUrl(canonicalUrl);
      return writeImageRecordToFirestore({ imageKey, context_id })
    });
    await Promise.all(imagePromises);
    const content = JSON.stringify({
      tiles: [
        { type: "Drawing", content: JSON.stringify([{ url: legacyUrls[0] }, { url: legacyUrls[1] }]) },
        { type: "Image", content: JSON.stringify([{ url: legacyUrls[0] }, { url: legacyUrls[2] }]) }
      ]
    });
    const specSupportDoc = specPublicationRequest({ add: { content } });
    const params: IPublishSupportParams = { context, ...specSupportDoc };
    const result = await publishSupport(params, authWithTeacherClaims as any) as FirebaseFirestore.WriteResult[];
    expect(result.length).toBe(5);  // root time stamp and support document
    // validate mcsupports document
    const supportsSnapshot = await firestoreAdmin.collection(`/authed/${kCanonicalPortal}/mcsupports`).get();
    expect(supportsSnapshot.size).toBe(1);
    const supportKey = supportsSnapshot.docs[0].id;
    const supportDoc = supportsSnapshot.docs[0].data();
    let updatedContent = content;
    legacyUrls.forEach((legacyUrl, i) => {
      updatedContent = replaceAll(updatedContent, legacyUrl, canonicalUrls[i]);
    });
    const expectSupportProps = {
      appMode: "authed",
      type: "supportPublication",
      originDoc: kOriginDoc,
      originDocType: "personal",
      properties: { teacherSupport: "true", caption: "caption" },
      content: updatedContent,
      platform_id: "test.portal",
      context_id: kClassHash
    };
    for (const prop in expectSupportProps) {
      expect(supportDoc[prop]).toEqual((expectSupportProps as any)[prop]);
    }
    // validate mcimages documents
    const imagesSnapshot = await firestoreAdmin.collection(`/authed/${kCanonicalPortal}/mcimages`).get();
    expect(imagesSnapshot.size).toBe(3);
    imagesSnapshot.docs.forEach((imageDoc, i) => {
      const legacyUrl = legacyUrls[i];
      const { classes, classPath: supportClassPath, platform_id, resource_link_id, resource_url } = supportDoc;
      // image document paths differ from support document paths
      const classPath = supportClassPath.replace(kClassHash, kOtherClassHash);
      const context_id = kOtherClassHash;
      const { imageKey } = parseFirebaseImageUrl(legacyUrl)
      expect(imageDoc.id).toBe(`${supportKey}_${imageKey}`)
      expect(imageDoc.data()).toEqual({
        url: legacyUrl, classes, classPath, supportKey, platform_id, context_id, resource_link_id, resource_url
      });
    });
  });

  // it("should succeed if asked to retrieve image data in user's class via legacy url", async () => {
  //   // return image data if request contains appropriate class and key
  //   mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
  //     path.includes(kClassHash) && path.endsWith(kImageKey)
  //       ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
  //       : { exists: () => false, val: () => null }
  //   ));
  //   const context = specStudentContext();
  //   const url = specImageUrl();
  //   const params: IGetImageDataParams = { context, url };
  //   const response = await getImageData(params, authWithStudentClaims as any);
  //   expect(response).toHaveProperty("imageData");
  //   expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  // });

  // it("should succeed if asked to retrieve image data in user's class via newer url", async () => {
  //   // return image data if request contains appropriate class and key
  //   mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
  //     path.includes(kClassHash) && path.endsWith(kImageKey)
  //       ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
  //       : { exists: () => false, val: () => null }
  //   ));
  //   const context = specStudentContext();
  //   const url = specImageUrl(kImageKey, kClassHash);
  //   const params: IGetImageDataParams = { context, url };
  //   const response = await getImageData(params, authWithStudentClaims as any);
  //   expect(response).toHaveProperty("imageData");
  //   expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  // });

  // it("should fail if asked to retrieve image data in another class without mcimages entry", async () => {
  //   // return image data if request contains appropriate class and key
  //   mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
  //     path.includes(kOtherClassHash) && path.endsWith(kImageKey)
  //       ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
  //       : { exists: () => false, val: () => null }
  //   ));
  //   const context = specStudentContext();
  //   const url = specImageUrl();
  //   const params: IGetImageDataParams = { context, url };
  //   const response = await getImageData(params, authWithStudentClaims as any);
  //   expect(response).toBeFalsy();
  //   expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  // });

  // it("should fail if asked to retrieve image data in another class with incorrect mcimages entry", async () => {
  //   // return image data if request contains appropriate class and key
  //   mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
  //     path.includes(kOtherClassHash) && path.endsWith(kImageKey)
  //       ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
  //       : { exists: () => false, val: () => null }
  //   ));
  //   await writeMCImageRecordToFirestore({ imageClassHash: "wrong-class" });

  //   const context = specStudentContext();
  //   const url = specImageUrl();
  //   const params: IGetImageDataParams = { context, url };
  //   const response = await getImageData(params, authWithStudentClaims as any);
  //   expect(response).toBeFalsy();
  //   expect(mockDatabaseGet).toHaveBeenCalledTimes(2);
  // });

  // it("should fail if asked to retrieve image data in another class from unsanctioned class", async () => {
  //   // return image data if request contains appropriate class and key
  //   mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
  //     path.includes(kOtherClassHash) && path.endsWith(kImageKey)
  //       ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
  //       : { exists: () => false, val: () => null }
  //   ));
  //   // the requested image hasn't been shared with this user's class
  //   await writeMCImageRecordToFirestore({ classes: [kOtherClassHash] });

  //   const context = specStudentContext();
  //   const url = specImageUrl();
  //   const params: IGetImageDataParams = { context, url };
  //   const response = await getImageData(params, authWithStudentClaims as any);
  //   expect(response).toBeFalsy();
  //   expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  // });

  // it("should succeed if asked to retrieve image data in another class with mcimages entry (legacy url)", async () => {
  //   // return image data if request contains appropriate class and key
  //   mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
  //     path.includes(kOtherClassHash) && path.endsWith(kImageKey)
  //       ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
  //       : { exists: () => false, val: () => null }
  //   ));
  //   await writeMCImageRecordToFirestore();

  //   const context = specStudentContext();
  //   const url = specImageUrl();
  //   const params: IGetImageDataParams = { context, url };
  //   const response = await getImageData(params, authWithStudentClaims as any);
  //   expect(response).toHaveProperty("imageData");
  //   // with legacy url we issue a failed request before issuing the successful one
  //   expect(mockDatabaseGet).toHaveBeenCalledTimes(2);
  // });

  // it("should succeed if asked to retrieve image data in another class with mcimages entry (newer url)", async () => {
  //   // return image data if request contains appropriate class and key
  //   mockDatabaseGet.mockImplementation((path: string) => Promise.resolve(
  //     path.includes(kOtherClassHash) && path.endsWith(kImageKey)
  //       ? { exists: () => true, val: () => ({ imageData: "data:image/png;base64,..." }) }
  //       : { exists: () => false, val: () => null }
  //   ));
  //   await writeMCImageRecordToFirestore();

  //   const context = specStudentContext();
  //   const url = specImageUrl(kImageKey, kOtherClassHash);
  //   const params: IGetImageDataParams = { context, url };
  //   const response = await getImageData(params, authWithStudentClaims as any);
  //   expect(response).toHaveProperty("imageData");
  //   // with newer url we don't issue the failed request before issuing the successful one
  //   expect(mockDatabaseGet).toHaveBeenCalledTimes(1);
  // });

});
