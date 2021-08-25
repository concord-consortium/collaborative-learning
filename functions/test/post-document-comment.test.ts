import {
  apps, clearFirestoreData, initializeAdminApp, useEmulators
} from "@firebase/rules-unit-testing";
import { postDocumentComment } from "../src/post-document-comment";
import { IDocumentMetadata, IPostDocumentCommentParams, IUserContext, networkDocumentKey } from "../src/shared-types";
import {
  kCanonicalPortal, kCreatedAt, kDemoName, kDocumentKey, kDocumentType, kFirebaseUserId,
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
  document?: Partial<IDocumentMetadata>,
  comment?: Partial<{
    tileId?: string;      // empty for document comments
    content: string;      // plain text for now; potentially html if we need rich text
  }>;
}

const specPostComment = (overrides?: IPartialPostCommentParams): IPostDocumentCommentParams => {
  return {
    context: specUserContext(overrides?.context),
    document: { uid: kUserId, type: kDocumentType, key: kDocumentKey, createdAt: kCreatedAt, ...overrides?.document },
    comment: { content: kComment1, ...overrides?.comment }
  };
};

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
    await expect(postDocumentComment(specPostComment({
      context: { name: "", teachers: [kUserId], network: "" }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid teacher list", async () => {
    await expect(postDocumentComment(specPostComment({
      context: { teachers: [] }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document uid", async () => {
    await expect(postDocumentComment(specPostComment({
      document: { uid: "", type: kDocumentType, key: kDocumentKey, createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document type", async () => {
    await expect(postDocumentComment(specPostComment({
      document: { uid: kUserId, type: "", key: kDocumentKey, createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid document key", async () => {
    await expect(postDocumentComment(specPostComment({
      document: { uid: kUserId, type: kDocumentType, key: "", createdAt: Date.now() }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid comment", async () => {
    await expect(postDocumentComment(specPostComment({
      comment: { content: "" }
    }), authWithTeacherClaims as any)).rejects.toBeDefined();
  });

  it("should fail without valid claims", async () => {
    await expect(postDocumentComment(specPostComment(), authWithNoClaims as any)).rejects.toBeDefined();
  });

  it("should add comments for authenticated users", async () => {
    expect.assertions(10);

    // can add a comment to a document that doesn't yet exist in Firestore
    const docKey = networkDocumentKey(kDocumentKey, kTeacherNetwork);
    const commentsCollectionPath = `authed/${kCanonicalPortal}/documents/${docKey}/comments`;
    const post1Result = await postDocumentComment(specPostComment(), authWithTeacherClaims as any);
    expect(post1Result).toHaveProperty("id");
    expect(post1Result).toHaveProperty("version");
    // there should be one comment in the comments subcollection
    const result1 = await dbAdmin.collection(commentsCollectionPath).orderBy("createdAt").get();
    expect(result1.docs.length).toBe(1);
    expect(result1.docs[0].data().name).toBe(kTeacherName);
    expect(result1.docs[0].data().content).toBe(kComment1);

    // can add a second comment to a document that already exists
    const post2Result = await postDocumentComment(specPostComment({ comment: { content: kComment2 } }),
                                                  authWithTeacherClaims as any);
    expect(post2Result).toHaveProperty("id");
    expect(post2Result).toHaveProperty("version");
    // there should be two comments in the comments subcollection
    const result2 = await dbAdmin.collection(commentsCollectionPath).orderBy("createdAt").get();
    expect(result2.docs.length).toBe(2);
    expect(result2.docs[1].data().name).toBe(kTeacherName);
    expect(result2.docs[1].data().content).toBe(kComment2);
  });

  it("should add comments for demo users", async () => {
    expect.assertions(8);

    // can add a comment to a document that doesn't yet exist in Firestore
    const docKey = networkDocumentKey(kDocumentKey, kTeacherNetwork);
    const commentsCollectionPath = `demo/${kDemoName}/documents/${docKey}/comments`;
    await expect(postDocumentComment(specPostComment({ context: specUserContext({ appMode: "demo" }) }),
                                                      authWithNoClaims as any))
                  .resolves.toHaveProperty("id");
    // there should be one comment in the comments subcollection
    const result1 = await dbAdmin.collection(commentsCollectionPath).orderBy("createdAt").get();
    expect(result1.docs.length).toBe(1);
    expect(result1.docs[0].data().name).toBe(kTeacherName);
    expect(result1.docs[0].data().content).toBe(kComment1);

    // can add a second comment to a document that already exists
    await expect(postDocumentComment(specPostComment({
                                        context: specUserContext({ appMode: "demo" }),
                                        comment: { content: kComment2 } }),
                                      authWithTeacherClaims as any))
                  .resolves.toHaveProperty("id");
    // there should be two comments in the comments subcollection
    const result2 = await dbAdmin.collection(commentsCollectionPath).orderBy("createdAt").get();
    expect(result2.docs.length).toBe(2);
    expect(result2.docs[1].data().name).toBe(kTeacherName);
    expect(result2.docs[1].data().content).toBe(kComment2);
  });

  it("should add comments for qa users", async () => {
    expect.assertions(8);

    // can add a comment to a document that doesn't yet exist in Firestore
    const docKey = networkDocumentKey(kDocumentKey, kTeacherNetwork);
    const commentsCollectionPath = `qa/${kFirebaseUserId}/documents/${docKey}/comments`;
    await expect(postDocumentComment(specPostComment({ context: specUserContext({ appMode: "qa" }) }),
                                                      authWithNoClaims as any))
                  .resolves.toHaveProperty("id");
    // there should be one comment in the comments subcollection
    const result1 = await dbAdmin.collection(commentsCollectionPath).orderBy("createdAt").get();
    expect(result1.docs.length).toBe(1);
    expect(result1.docs[0].data().name).toBe(kTeacherName);
    expect(result1.docs[0].data().content).toBe(kComment1);

    // can add a second comment to a document that already exists
    await expect(postDocumentComment(specPostComment({
                                        context: specUserContext({ appMode: "qa" }),
                                        comment: { content: kComment2 } }),
                                      authWithTeacherClaims as any))
                  .resolves.toHaveProperty("id");
    // there should be two comments in the comments subcollection
    const result2 = await dbAdmin.collection(commentsCollectionPath).orderBy("createdAt").get();
    expect(result2.docs.length).toBe(2);
    expect(result2.docs[1].data().name).toBe(kTeacherName);
    expect(result2.docs[1].data().content).toBe(kComment2);
  });
});
