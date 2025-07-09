import * as admin from "firebase-admin";
import fftInit from "firebase-functions-test";
import fs from "fs";
import path from "path";
import {initializeTestEnvironment, RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {HttpsError} from "firebase-functions/v2/https";
import {postDocumentComment} from "../src/post-document-comment";
import {createFirestoreMetadataDocumentIfNecessaryWithoutValidation} from "../src/create-firestore-metadata-document";
import {validateUserContext} from "../src/user-context";
import {authWithTeacherClaims, kClassHash, kCurriculumKey, kDocumentKey, kDocumentType, kTeacherName,
  kTeacherNetwork, kUserId, specPostDocumentComment} from "./test-utils";

const fft = fftInit();
let testEnv: RulesTestEnvironment;

// Mock the actual "firebase-admin" module so that clients get our mock instead
jest.mock("firebase-admin", () => {
  const actualAdmin = jest.requireActual("firebase-admin");
  const firestoreMock = {
    collection: jest.fn().mockReturnThis(),
    add: jest.fn(),
  };
  function firestore() {
    return firestoreMock;
  }
  firestore.FieldValue = {
    serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
  };
  return {
    firestore,
    // We pass through calls to initializeApp to the original implementation so that the call
    // to initializeAdminApp above (which calls initializeApp under the hood) will succeed.
    initializeApp: (...args: any[]) => actualAdmin.initializeApp(...args),
    credential: {
      applicationDefault: jest.fn(),
    },
    apps: [],
    firestoreMock,
    FieldValue: firestore.FieldValue,
  };
});

beforeAll(async () => {
  const kCLUEFirebaseProjectId = "collaborative-learning-ec215";
  testEnv = await initializeTestEnvironment({
    projectId: kCLUEFirebaseProjectId,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

jest.mock("../src/create-firestore-metadata-document", () => ({
  createFirestoreMetadataDocumentIfNecessaryWithoutValidation: jest.fn(),
}));

jest.mock("../src/user-context", () => ({
  validateUserContext: jest.fn(),
}));

const mockFirestore = admin.firestore() as any;
const mockAdd = mockFirestore.add;

const validParams = {
  context: {
    uid: "123",
    name: kTeacherName,
    network: kTeacherNetwork,
    classHash: kClassHash,
    teachers: ["teacher1"],
  },
  document: {
    uid: "doc123",
    name: "Test Document",
    path: kCurriculumKey,
    problem: "1.2",
    section: "introduction",
    unit: "abc",
  },
  comment: {
    content: "This is a test comment.",
    tags: ["feedback"],
  },
};

describe("postDocumentComment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail without sufficient arguments", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    await expect(wrapped).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    const result = await wrapped({data: {warmUp: true}} as any);
    expect(result).toEqual({version: "1.2.0"});
  });

  it("should fail without valid arguments", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    (validateUserContext as jest.Mock).mockReturnValue({isValid: false});

    await expect(wrapped({data: validParams} as any)).rejects.toThrow(HttpsError);
  });

  it("should fail without valid teacher name", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    const context = {...validParams.context, name: "", teachers: [kUserId]};
    (validateUserContext as jest.Mock).mockReturnValue({
      isValid: true,
      uid: "123",
      firestoreRoot: "test",
    });

    await expect(wrapped({
      data: {...validParams, context},
    } as any)).rejects.toThrow("Some required teacher information was not provided.");
  });

  it("should fail without valid teacher list", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    const context = {...validParams.context, teachers: []};
    (validateUserContext as jest.Mock).mockReturnValue({
      isValid: true,
      uid: "123",
      firestoreRoot: "test",
    });

    await expect(wrapped({
      data: {...validParams, context},
    } as any)).rejects.toThrow("Some required teacher information was not provided.");
  });

  it("should fail if document is invalid", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    (validateUserContext as jest.Mock).mockReturnValue({
      isValid: true,
      uid: "123",
      firestoreRoot: "test",
    });

    await expect(wrapped({
      data: {...validParams, document: {}},
    } as any)).rejects.toThrow("Some required document information was not provided.");
  });

  it("should fail without valid document uid", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    const docCommentData = specPostDocumentComment({
      document: {uid: "", type: kDocumentType, key: kDocumentKey, createdAt: Date.now()},
      context: authWithTeacherClaims as any,
    });
    await expect(wrapped({data: docCommentData} as any)).rejects.toBeDefined();
  });

  it("should fail without valid document type", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    const docCommentData = specPostDocumentComment({
      document: {uid: kUserId, type: "", key: kDocumentKey, createdAt: Date.now()},
      context: authWithTeacherClaims as any,
    });
    await expect(wrapped({data: docCommentData} as any)).rejects.toBeDefined();
  });

  it("should fail without valid document key", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    const docCommentData = specPostDocumentComment({
      document: {uid: kUserId, type: kDocumentType, key: "", createdAt: Date.now()},
      context: authWithTeacherClaims as any,
    });
    await expect(wrapped({data: docCommentData} as any)).rejects.toBeDefined();
  });

  it("should fail if comment content and tags are missing", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    (validateUserContext as jest.Mock).mockReturnValue({
      isValid: true,
      uid: "123",
      firestoreRoot: "test",
    });

    await expect(wrapped({
      data: {...validParams, comment: {}},
    } as any)).rejects.toThrow("Some required comment information was not provided.");
  });

  it("should fail if document creation fails", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    (validateUserContext as jest.Mock).mockReturnValue({
      isValid: true,
      uid: "123",
      firestoreRoot: "test",
    });

    (createFirestoreMetadataDocumentIfNecessaryWithoutValidation as jest.Mock).mockResolvedValue(null);

    await expect(wrapped({data: validParams} as any))
      .rejects.toThrow("Some required arguments were not valid.");
  });

  it("writes a comment and returns version and id", async () => {
    const wrapped = fft.wrap(postDocumentComment);
    (validateUserContext as jest.Mock).mockReturnValue({
      isValid: true,
      uid: "123",
      firestoreRoot: "test",
    });

    (createFirestoreMetadataDocumentIfNecessaryWithoutValidation as jest.Mock).mockResolvedValue({
      ref: {path: "documents/doc123"},
    });

    mockFirestore.collection.mockReturnThis();
    mockAdd.mockResolvedValue({id: "comment123"});

    const result = await wrapped({data: validParams} as any);
    expect(result).toEqual({version: "1.2.0", id: "comment123"});
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      uid: "123",
      content: "This is a test comment.",
      tags: ["feedback"],
    }));
  });
});
