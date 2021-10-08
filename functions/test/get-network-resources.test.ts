import {
  apps, clearFirestoreData, initializeAdminApp, useEmulators
} from "@firebase/rules-unit-testing";
import { getNetworkResources } from "../src/get-network-resources";
import { IGetNetworkResourcesParams } from "../src/shared";
import {
  kClassHash, kOffering1Id, kOffering2Id, kOtherClassHash, kProblemPath,
  kTeacherName, kTeacherNetwork, kUserId, specAuth, specUserContext
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

// const authWithNoClaims = { auth: { uid: kFirebaseUserId, token: {} } };
const authWithTeacherClaims = { auth: specAuth({ token: { user_type: "teacher" } }) };

async function writeTeacherRecordToFirestore(overrides?: any) {
  const user = { uid: kUserId, name: kTeacherName, type: "teacher",
                  network: kTeacherNetwork, networks: [kTeacherNetwork], ...overrides };
  return await firestoreAdmin.doc(`/authed/test_portal/users/${kUserId}`).set(user);
}

async function writeClassRecordToFirestore(overrides?: any) {
  const { id = "101", context_id= kClassHash } = overrides || {};
  const _class = { id, name: "Class 1", uri: `https://concord.org/class/${id}`, context_id,
                  teacher: kTeacherName, teachers: [kUserId], network: kTeacherNetwork, ...overrides };
  return await firestoreAdmin.doc(`/authed/test_portal/classes/${kTeacherNetwork}_${context_id}`).set(_class);
}

async function writeOfferingRecordToFirestore(overrides?: any) {
  const { id = kOffering1Id, context_id= kClassHash } = overrides || {};
  const _class = {
    id, name: "Offering 1", uri: `https://concord.org/offering/${id}`, context_id, teachers: [kUserId],
    unit: "abc", problem: "1.2", problemPath: kProblemPath, network: kTeacherNetwork, ...overrides };
  return await firestoreAdmin.doc(`/authed/test_portal/offerings/${kTeacherNetwork}_${id}`).set(_class);
}

describe("getNetworkResources", () => {

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
    await expect(getNetworkResources()).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    await expect(getNetworkResources({ warmUp: true })).resolves.toHaveProperty("version");
  });

  it("should fail without valid arguments", async () => {
    await expect(getNetworkResources({} as any, {} as any)).rejects.toBeDefined();
  });

  it("should fail without corresponding teacher record in firestore", async () => {
    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    await expect(getNetworkResources(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid network", async () => {
    await writeTeacherRecordToFirestore();

    const context = specUserContext({}, ["network"]);
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    await expect(getNetworkResources(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail with bogus network", async () => {
    await writeTeacherRecordToFirestore();

    const context = specUserContext({ network: "bogus-network"});
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    await expect(getNetworkResources(params, authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should return empty response if no matching classes/offerings in requested network", async () => {
    await writeTeacherRecordToFirestore();

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    expect(response.response).toEqual([]);
  });

  it("should return a single class with a single empty offering when appropriate", async () => {
    await writeTeacherRecordToFirestore();
    // single class with single offering
    await writeClassRecordToFirestore();
    await writeOfferingRecordToFirestore();

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    const expectedOffering = { resource_link_id: kOffering1Id, teachers: [{ uid: kUserId }]};
    expect(response.response).toEqual([{
      id: "101", name: "Class 1", context_id: kClassHash, teacher: kTeacherName, teachers: [{ uid: kUserId }],
      resources: [expectedOffering], uri: `https://concord.org/class/101`
    }]);
  });

  it("should return a single class with a single empty offering if class doesn't exist in firestore", async () => {
    await writeTeacherRecordToFirestore();
    // single class with single offering
    // await writeClassRecordToFirestore();
    await writeOfferingRecordToFirestore();

    mockDatabaseGet.mockImplementation(path => {
      throw new Error("Error!");
    });

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    const expectedOffering = { resource_link_id: kOffering1Id };
    expect(response.response).toEqual([{ context_id: kClassHash, resources: [expectedOffering] }]);
  });

  it("should return a single class with a single empty offering if an exception is thrown from realtime database", async () => {
    await writeTeacherRecordToFirestore();
    // single class with single offering
    await writeClassRecordToFirestore();
    await writeOfferingRecordToFirestore();

    mockDatabaseGet.mockImplementation(path => {
      throw new Error("Error!");
    });

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    const expectedOffering = { resource_link_id: kOffering1Id };
    expect(response.response).toEqual([{
      id: "101", name: "Class 1", context_id: kClassHash, teacher: kTeacherName, teachers: [{ uid: kUserId }],
      resources: [expectedOffering], uri: `https://concord.org/class/101`
    }]);
  });

  it("should return appropriate publications metadata for a single class with a single offering", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore();
    await writeOfferingRecordToFirestore();
    const problemPublicationsMetadata = {
            "publication-1": {
              version: "1.0",
              self: { classHash: kClassHash, offeringId: kOffering1Id },
              documentKey: "publication-1",
              userId: kUserId
            }
          };
    const personalPublicationsMetadata = {
            "personal-publication-1": {
              version: "1.0",
              self: { classHash: kClassHash, documentKey: "personal-publication-1" },
              title: "title-1",
              properties: {},
              uid: kUserId,
              originDoc: "personal-doc-1"
            }
          };
    const learningLogPublicationsMetadata = {
            "learning-log-publication-1": {
              version: "1.0",
              self: { classHash: kClassHash, documentKey: "learning-log-publication-1" },
              title: "title-1",
              properties: {},
              uid: kUserId,
              originDoc: "learning-log-1"
            }
          };
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        "/authed/portals/test_portal/classes/class-hash/publications":
          learningLogPublicationsMetadata,
        "/authed/portals/test_portal/classes/class-hash/personalPublications":
          personalPublicationsMetadata,
        "/authed/portals/test_portal/classes/class-hash/offerings/1001/publications":
          problemPublicationsMetadata
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    const expectedOffering = {
      resource_link_id: kOffering1Id,
      problemPublications: problemPublicationsMetadata,
      teachers: [{ uid: kUserId }]
    };
    expect(response.response).toEqual([{
      id: "101", name: "Class 1", context_id: kClassHash,
      personalPublications: personalPublicationsMetadata,
      learningLogPublications: learningLogPublicationsMetadata,
      teacher: kTeacherName, teachers: [{ uid: kUserId }],
      resources: [expectedOffering], uri: `https://concord.org/class/101`
    }]);
  });

  it("should return problem/planning document metadata for a single class with a single offering", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore();
    await writeOfferingRecordToFirestore();
    const problemDocuments = {
            "problem-document": {
              version: "1.0",
              self: { classHash: kClassHash, offeringId: kOffering1Id, uid: kUserId },
              documentKey: "problem-document",
              visibility: "public"
            }
          };
    const planningDocuments = {
            "planning-document": {
              version: "1.0",
              self: { classHash: kClassHash, offeringId: kOffering1Id, uid: kUserId },
              title: "title-1",
              documentKey: "planning-document",
              visibility: "private"
            }
          };
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        "/authed/portals/test_portal/classes/class-hash/offerings/1001/users/123456/documents":
          problemDocuments,
        "/authed/portals/test_portal/classes/class-hash/offerings/1001/users/123456/planning":
          planningDocuments
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    const expectedOffering = {
      resource_link_id: kOffering1Id,
      teachers: [{ uid: kUserId, problemDocuments, planningDocuments }]
    };
    expect(response.response).toEqual([{
      id: "101", name: "Class 1", context_id: kClassHash, teacher: kTeacherName, teachers: [{ uid: kUserId }],
      resources: [expectedOffering], uri: `https://concord.org/class/101`
    }]);
  });

  it("should return personal/learning log document metadata for a single class with a single offering", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore();
    await writeOfferingRecordToFirestore();
    const personalDocuments = {
            "personal-document-1": {
              version: "1.0",
              self: { uid: kUserId, classHash: kClassHash, documentKey: "personal-document-1" },
              title: "Personal Document 1",
              properties: { foo: "bar" }
            }
          };
    const learningLogs = {
            "learning-log-1": {
              version: "1.0",
              self: { uid: kUserId, classHash: kClassHash, documentKey: "learning-log-1" },
              title: "Learning Log 1",
              properties: { baz: "roo" }
            }
          };
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        "/authed/portals/test_portal/classes/class-hash/users/123456/personalDocs":
          personalDocuments,
        "/authed/portals/test_portal/classes/class-hash/users/123456/learningLogs":
          learningLogs
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    const expectedTeacher = { uid: kUserId, personalDocuments, learningLogs };
    const expectedOffering = { resource_link_id: kOffering1Id, teachers: [{ uid: kUserId }] };
    expect(response.response).toEqual([{
      id: "101", name: "Class 1", context_id: kClassHash, teacher: kTeacherName, teachers: [expectedTeacher],
      resources: [expectedOffering], uri: `https://concord.org/class/101`
    }]);
  });

  it("should return appropriate publications metadata for multiple classes with offerings", async () => {
    await writeTeacherRecordToFirestore();
    await writeClassRecordToFirestore();
    await writeClassRecordToFirestore({ id: "102", context_id: kOtherClassHash, name: "Class 2" });
    await writeOfferingRecordToFirestore();
    await writeOfferingRecordToFirestore({ id: kOffering2Id, context_id: kOtherClassHash });
    const class1PersonalPublicationsMetadata = {
            "personal-publication-1": {
              version: "1.0",
              self: { classHash: kClassHash, documentKey: "personal-publication-1" },
              title: "title-1",
              properties: {},
              uid: kUserId,
              originDoc: "personal-doc-1"
            }
          };
    const class1LearningLogPublicationsMetadata = {
            "learning-log-publication-1": {
              version: "1.0",
              self: { classHash: kClassHash, documentKey: "learning-log-publication-1" },
              title: "title-1",
              properties: {},
              uid: kUserId,
              originDoc: "learning-log-1"
            }
          };
    const offering1ProblemPublicationsMetadata = {
            "publication-1": {
              version: "1.0",
              self: { classHash: kClassHash, offeringId: kOffering1Id },
              documentKey: "publication-1",
              userId: kUserId
            }
          };
    const class2PersonalPublicationsMetadata = {
            "personal-publication-2": {
              version: "1.0",
              self: { classHash: kOtherClassHash, documentKey: "personal-publication-2" },
              title: "title-2",
              properties: {},
              uid: kUserId,
              originDoc: "personal-doc-2"
            }
          };
    const class2LearningLogPublicationsMetadata = {
            "learning-log-publication-2": {
              version: "1.0",
              self: { classHash: kOtherClassHash, documentKey: "learning-log-publication-2" },
              title: "title-2",
              properties: {},
              uid: kUserId,
              originDoc: "learning-log-2"
            }
          };
    const offering2ProblemPublicationsMetadata = {
            "publication-2": {
              version: "1.0",
              self: { classHash: kOtherClassHash, offeringId: kOffering2Id },
              documentKey: "publication-2",
              userId: kUserId
            }
          };
    mockDatabaseGet.mockImplementation(path => {
      const dbMap: Record<string, any> = {
        "/authed/portals/test_portal/classes/class-hash/publications":
          class1LearningLogPublicationsMetadata,
        "/authed/portals/test_portal/classes/class-hash/personalPublications":
          class1PersonalPublicationsMetadata,
        "/authed/portals/test_portal/classes/class-hash/offerings/1001/publications":
          offering1ProblemPublicationsMetadata,
        "/authed/portals/test_portal/classes/other-class-hash/publications":
          class2LearningLogPublicationsMetadata,
        "/authed/portals/test_portal/classes/other-class-hash/personalPublications":
          class2PersonalPublicationsMetadata,
        "/authed/portals/test_portal/classes/other-class-hash/offerings/1002/publications":
          offering2ProblemPublicationsMetadata
      };
      const content = dbMap[path];
      return content
              ? { exists: () => true, val: () => content }
              : { exists: () => false, val: () => null };
    });

    const context = specUserContext();
    const params: IGetNetworkResourcesParams = { context, problem: kProblemPath };
    const response = await getNetworkResources(params, authWithTeacherClaims as any);
    expect(response).toHaveProperty("version");
    const expectedOffering1 = {
      resource_link_id: kOffering1Id,
      problemPublications: offering1ProblemPublicationsMetadata,
      teachers: [{ uid: kUserId }]
    };
    const expectedOffering2 = {
      resource_link_id: kOffering2Id,
      problemPublications: offering2ProblemPublicationsMetadata,
      teachers: [{ uid: kUserId }]
    };
    expect(response.response).toEqual([
      { id: "101", name: "Class 1", context_id: kClassHash,
        personalPublications: class1PersonalPublicationsMetadata,
        learningLogPublications: class1LearningLogPublicationsMetadata,
        teacher: kTeacherName, teachers: [{ uid: kUserId }],
        resources: [expectedOffering1], uri: `https://concord.org/class/101` },
      { id: "102", name: "Class 2", context_id: kOtherClassHash,
        personalPublications: class2PersonalPublicationsMetadata,
        learningLogPublications: class2LearningLogPublicationsMetadata,
        teacher: kTeacherName, teachers: [{ uid: kUserId }],
        resources: [expectedOffering2], uri: `https://concord.org/class/102` }
    ]);
  });
});
