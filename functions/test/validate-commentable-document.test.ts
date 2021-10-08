import {
  apps, clearFirestoreData, initializeAdminApp, useEmulators
} from "@firebase/rules-unit-testing";
import {
  ICommentableDocumentParams, ICurriculumMetadata, IDocumentMetadata, isCurriculumMetadata,
  IUserContext, networkDocumentKey
} from "../src/shared";
import { validateCommentableDocument } from "../src/validate-commentable-document";
import {
  kCanonicalPortal, kClassHash, kCurriculumKey, kDemoName, kDocumentKey, kDocumentType, kFirebaseUserId,
  kTeacherNetwork, kUserId, specAuth, specUserContext
} from "./test-utils";

useEmulators({
  database: { host: "localhost", port: 9000 },
  firestore: { host: "localhost", port: 8088 }
});

// Considerable trial and error was required to come up with this mock
// Initialize the mock admin app using initializeAdminApp from @firebase/rules-unit-testing
const kCLUEFirebaseProjectId = "collaborative-learning-ec215";
const mockAdmin = initializeAdminApp({ projectId: kCLUEFirebaseProjectId });
// Mock the actual "firebase-admin" module so that clients get our mock instead
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual("firebase-admin");
  // These lines are patterned after code in the "firebase-admin" module which attaches namespace
  // properties from the original namespaces (e.g. Timestamp) to the returned functions.
  // This allows admin.firestore() to be used as a function that returns the firestore instance
  // as well as a namespace (e.g admin.firestore.Timestamp). The mock is replacing the function
  // but attaching the original namespace contents.
  const mockDatabase = () => mockAdmin.database();
  Object.assign(mockDatabase, actualAdmin.database);
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

const dbAdmin = mockAdmin.firestore();

const authWithNoClaims = { auth: { uid: kFirebaseUserId, token: {} } };
const authWithTeacherClaims = { auth: specAuth({ token: { user_type: "teacher" } }) };

export interface IPartialValidateDocumentParams {
  context?: Partial<IUserContext>,
  document?: Partial<IDocumentMetadata | ICurriculumMetadata>,
  firestoreRoot?: string;
  uid?: string;
}

const specValidateDocument = (overrides?: IPartialValidateDocumentParams): ICommentableDocumentParams => {
  return {
    context: specUserContext(overrides?.context),
    document: { contextId: kClassHash, uid: kUserId, type: kDocumentType, key: kDocumentKey, ...overrides?.document }
  };
};

const specValidateCurriculum = (overrides?: IPartialValidateDocumentParams): ICommentableDocumentParams => {
  return {
    context: specUserContext(overrides?.context),
    document: { unit: "abc", problem: "1.2", section: "introduction", path: kCurriculumKey, ...overrides?.document }
  };
};

const kExpectedAssertions = 8;

async function testValidateDocument(documentPath : string, authContext: any, context?: Partial<IUserContext>) {
  // can validate a document that doesn't yet exist in Firestore
  const isCurriculumComment = documentPath.includes("curriculum");
  const docKey = isCurriculumComment ? kCurriculumKey : kDocumentKey;
  expect(documentPath).toContain(networkDocumentKey(kUserId, docKey, kTeacherNetwork));
  const docParams = isCurriculumComment
                        ? specValidateCurriculum({ context })
                        : specValidateDocument({ context })
  const validateResult = await validateCommentableDocument(docParams, authContext);
  expect(validateResult).toHaveProperty("id");
  expect(validateResult).toHaveProperty("version");
  expect(validateResult).toHaveProperty("data");

  // the document should be at the expected path
  const docResult = await dbAdmin.doc(documentPath).get();
  const docData = isCurriculumComment
                    ? docResult.data() as ICurriculumMetadata
                    : docResult.data() as IDocumentMetadata;
  if (isCurriculumMetadata(docData)) {
    // not part of metadata, but added by firebase function
    expect((docData as any).uid).toBe(kUserId);
  }
  else {
    expect(docData.uid).toBe(kUserId);
  }

  // can validate a document that already exists
  const validate2Result = await validateCommentableDocument(docParams, authContext);
  expect(validate2Result).toHaveProperty("id");
  expect(validate2Result).toHaveProperty("version");
  expect(validateResult).toHaveProperty("data");
}

describe("validateCommentableDocument", () => {
  beforeEach(async () => {
    await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
  });

  afterAll(async () => {
    // comment out the next line to observe the firebase contents in the visual emulator at the end of the tests
    await clearFirestoreData({ projectId: kCLUEFirebaseProjectId });
    // https://firebase.google.com/docs/firestore/security/test-rules-emulator#run_local_tests
    await Promise.all(apps().map(app => app.delete()));
  });

  it("should fail without sufficient arguments", async () => {
    await expect(validateCommentableDocument()).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    await expect(validateCommentableDocument({ warmUp: true })).resolves.toHaveProperty("version");
  });

  it("should fail without valid arguments", async () => {
    await expect(validateCommentableDocument({} as any, {} as any)).rejects.toBeDefined();
  });

  it("should fail without valid teacher name", async () => {
    await expect(validateCommentableDocument(specValidateDocument({
      context: { name: "", teachers: [kUserId], network: "" }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid teacher list", async () => {
    await expect(validateCommentableDocument(specValidateDocument({
      context: { teachers: [] }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document uid", async () => {
    await expect(validateCommentableDocument(specValidateDocument({
      document: { uid: "", type: kDocumentType, key: kDocumentKey, createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document type", async () => {
    await expect(validateCommentableDocument(specValidateDocument({
      document: { uid: kUserId, type: "", key: kDocumentKey, createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document key", async () => {
    await expect(validateCommentableDocument(specValidateDocument({
      document: { uid: kUserId, type: kDocumentType, key: "", createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid claims", async () => {
    await expect(validateCommentableDocument(specValidateDocument(), authWithNoClaims as any)).rejects.toBeDefined();
  });

  it("should validate documents for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kDocumentKey, kTeacherNetwork);
    const documentCollectionPath = `authed/${kCanonicalPortal}/documents/${docKey}`;
    await testValidateDocument(documentCollectionPath, authWithTeacherClaims);
  });

  it("should validate documents for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kDocumentKey, kTeacherNetwork);
    const documentCollectionPath = `demo/${kDemoName}/documents/${docKey}`;
    await testValidateDocument(documentCollectionPath, authWithNoClaims, { appMode: "demo" });
  });

  it("should validate documents for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kDocumentKey, kTeacherNetwork);
    const documentCollectionPath = `qa/${kFirebaseUserId}/documents/${docKey}`;
    await testValidateDocument(documentCollectionPath, authWithNoClaims, { appMode: "qa" });
  });

  it("should validate curriculum documents for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kCurriculumKey, kTeacherNetwork);
    const documentCollectionPath = `authed/${kCanonicalPortal}/curriculum/${docKey}`;
    await testValidateDocument(documentCollectionPath, authWithTeacherClaims);
  });

  it("should validate curriculum documents for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kCurriculumKey, kTeacherNetwork);
    const documentCollectionPath = `demo/${kDemoName}/curriculum/${docKey}`;
    await testValidateDocument(documentCollectionPath, authWithNoClaims, { appMode: "demo" });
  });

  it("should validate curriculum documents for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kCurriculumKey, kTeacherNetwork);
    const documentCollectionPath = `qa/${kFirebaseUserId}/curriculum/${docKey}`;
    await testValidateDocument(documentCollectionPath, authWithNoClaims, { appMode: "qa" });
  });
});
