import {
  apps, clearFirestoreData, initializeAdminApp, useEmulators
} from "@firebase/rules-unit-testing";
import { postDocumentComment } from "../src/post-document-comment";
import {
  ICurriculumMetadata, IDocumentMetadata, IPostDocumentCommentParams, isCurriculumMetadata,
  IUserContext, networkDocumentKey
} from "../src/shared";
import {
  kCanonicalPortal, kCreatedAt, kCurriculumKey, kDemoName, kDocumentKey, kDocumentType, kFirebaseUserId,
  kTeacherName, kTeacherNetwork, kUserId, specAuth, specUserContext
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
const kComment1 = "Comment 1";
const kComment2 = "Comment 2";

export interface IPartialPostCommentParams {
  context?: Partial<IUserContext>,
  document?: Partial<IDocumentMetadata | ICurriculumMetadata>,
  comment?: Partial<{
    tileId?: string;      // empty for document comments
    content: string;      // plain text for now; potentially html if we need rich text
  }>;
}

const specPostDocumentComment = (overrides?: IPartialPostCommentParams): IPostDocumentCommentParams => {
  return {
    context: specUserContext(overrides?.context),
    document: { uid: kUserId, type: kDocumentType, key: kDocumentKey, createdAt: kCreatedAt, ...overrides?.document },
    comment: { content: kComment1, ...overrides?.comment }
  };
};

const specPostCurriculumComment = (overrides?: IPartialPostCommentParams): IPostDocumentCommentParams => {
  return {
    context: specUserContext(overrides?.context),
    document: { unit: "abc", problem: "1.2", section: "introduction", path: kCurriculumKey, ...overrides?.document },
    comment: { content: kComment1, ...overrides?.comment }
  };
};

const kExpectedAssertions = 12;

async function testWriteComments(documentPath : string, authContext: any, context?: Partial<IUserContext>) {
  // can add a comment to a document that doesn't yet exist in Firestore
  const commentsPath = `${documentPath}/comments`;
  const isCurriculumComment = commentsPath.includes("curriculum");
  const docKey = isCurriculumComment ? kCurriculumKey : kDocumentKey;
  expect(documentPath).toContain(networkDocumentKey(kUserId, docKey, kTeacherNetwork));
  const post1Comment = isCurriculumComment
                        ? specPostCurriculumComment({ context })
                        : specPostDocumentComment({ context })
  const post1Result = await postDocumentComment(post1Comment, authContext);
  expect(post1Result).toHaveProperty("id");
  expect(post1Result).toHaveProperty("version");

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

  // there should be one comment in the comments subcollection
  const result1 = await dbAdmin.collection(commentsPath).orderBy("createdAt").get();
  expect(result1.docs.length).toBe(1);
  expect(result1.docs[0].data().name).toBe(kTeacherName);
  expect(result1.docs[0].data().content).toBe(kComment1);

  // can add a second comment to a document that already exists
  const post2Comment = isCurriculumComment
                        ? specPostCurriculumComment({ context, comment: { content: kComment2 } })
                        : specPostDocumentComment({ context, comment: { content: kComment2 } });
  const post2Result = await postDocumentComment(post2Comment, authContext);
  expect(post2Result).toHaveProperty("id");
  expect(post2Result).toHaveProperty("version");
  // there should be two comments in the comments subcollection
  const result2 = await dbAdmin.collection(commentsPath).orderBy("createdAt").get();
  expect(result2.docs.length).toBe(2);
  expect(result2.docs[1].data().name).toBe(kTeacherName);
  expect(result2.docs[1].data().content).toBe(kComment2);
}

describe("postDocumentComment", () => {
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
    await expect(postDocumentComment()).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    await expect(postDocumentComment({ warmUp: true })).resolves.toHaveProperty("version");
  });

  it("should fail without valid arguments", async () => {
    await expect(postDocumentComment({} as any, {} as any)).rejects.toBeDefined();
  });

  it("should fail without valid teacher name", async () => {
    await expect(postDocumentComment(specPostDocumentComment({
      context: { name: "", teachers: [kUserId], network: "" }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid teacher list", async () => {
    await expect(postDocumentComment(specPostDocumentComment({
      context: { teachers: [] }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document uid", async () => {
    await expect(postDocumentComment(specPostDocumentComment({
      document: { uid: "", type: kDocumentType, key: kDocumentKey, createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document type", async () => {
    await expect(postDocumentComment(specPostDocumentComment({
      document: { uid: kUserId, type: "", key: kDocumentKey, createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document key", async () => {
    await expect(postDocumentComment(specPostDocumentComment({
      document: { uid: kUserId, type: kDocumentType, key: "", createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid comment", async () => {
    await expect(postDocumentComment(specPostDocumentComment({
      comment: { content: "" }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid claims", async () => {
    await expect(postDocumentComment(specPostDocumentComment(), authWithNoClaims as any)).rejects.toBeDefined();
  });

  it("should add document comments for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kDocumentKey, kTeacherNetwork);
    const documentCollectionPath = `authed/${kCanonicalPortal}/documents/${docKey}`;
    await testWriteComments(documentCollectionPath, authWithTeacherClaims);
  });

  it("should add document comments for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kDocumentKey, kTeacherNetwork);
    const documentCollectionPath = `demo/${kDemoName}/documents/${docKey}`;
    await testWriteComments(documentCollectionPath, authWithNoClaims, { appMode: "demo" });
  });

  it("should add document comments for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kDocumentKey, kTeacherNetwork);
    const documentCollectionPath = `qa/${kFirebaseUserId}/documents/${docKey}`;
    await testWriteComments(documentCollectionPath, authWithNoClaims, { appMode: "qa" });
  });

  it("should add curriculum comments for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kCurriculumKey, kTeacherNetwork);
    const documentCollectionPath = `authed/${kCanonicalPortal}/curriculum/${docKey}`;
    await testWriteComments(documentCollectionPath, authWithTeacherClaims);
  });

  it("should add curriculum comments for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kCurriculumKey, kTeacherNetwork);
    const documentCollectionPath = `demo/${kDemoName}/curriculum/${docKey}`;
    await testWriteComments(documentCollectionPath, authWithNoClaims, { appMode: "demo" });
  });

  it("should add curriculum comments for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const docKey = networkDocumentKey(kUserId, kCurriculumKey, kTeacherNetwork);
    const documentCollectionPath = `qa/${kFirebaseUserId}/curriculum/${docKey}`;
    await testWriteComments(documentCollectionPath, authWithNoClaims, { appMode: "qa" });
  });
});
