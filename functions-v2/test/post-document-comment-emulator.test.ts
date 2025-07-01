import * as admin from "firebase-admin";
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {authWithNoClaims, authWithTeacherClaims, kCanonicalPortal, kComment1, kComment2, kCurriculumKey, kDemoName,
  kDocumentKey, kFirebaseUserId, kTeacherName, kUserId, specPostCurriculumComment,
  specPostDocumentComment} from "./test-utils";
import {escapeKey, ICurriculumMetadata, IDocumentMetadata, isCurriculumMetadata,
  IUserContext} from "../../shared/shared";
import {initialize, projectConfig} from "./initialize";
import {postDocumentComment} from "../src/post-document-comment";

type CollectionRef = admin.firestore.CollectionReference<admin.firestore.DocumentData, admin.firestore.DocumentData>;

const {fft} = initialize();
const kExpectedAssertions = 12;

async function testWriteComments(documentPath : string, authContext: any, context?: Partial<IUserContext>) {
  const isCurriculumComment = documentPath.includes("curriculum");
  const docKey = isCurriculumComment ? kCurriculumKey : kDocumentKey;
  if (isCurriculumComment) {
    expect(documentPath).toContain(escapeKey(docKey));
  } else {
    expect(documentPath).toContain(docKey);
  }
  // can add a comment to a document that doesn't yet exist in Firestore
  // No need for getActualDocumentPath - documentPath is already correct
  const commentsPath = `${documentPath}/comments`;
  const post1Comment = isCurriculumComment ?
    specPostCurriculumComment({context}) :
    specPostDocumentComment({context});
  const wrapped = fft.wrap(postDocumentComment);
  const post1Result = await wrapped({data: post1Comment, auth: authContext} as any);
  expect(post1Result).toHaveProperty("id");
  expect(post1Result).toHaveProperty("version");
  const docResult = await admin.firestore().doc(documentPath).get();
  const docData = isCurriculumComment ?
                    docResult.data() as ICurriculumMetadata :
                    docResult.data() as IDocumentMetadata;
  if (isCurriculumMetadata(docData)) {
    // not part of metadata, but added by firebase function
    expect((docData as any).uid).toBe(kUserId);
  } else {
    expect(docData.uid).toBe(kUserId);
  }

  // there should be one comment in the comments subcollection
  const result1 = await admin.firestore().collection(commentsPath).orderBy("createdAt").get();
  expect(result1.docs.length).toBe(1);
  expect(result1.docs[0].data().name).toBe(kTeacherName);
  expect(result1.docs[0].data().content).toBe(kComment1);

  // can add a second comment to a document that already exists
  const post2Comment = isCurriculumComment ?
    specPostCurriculumComment({context, comment: {content: kComment2}}) :
    specPostDocumentComment({context, comment: {content: kComment2}});
  const post2Result = await wrapped({data: post2Comment, auth: authContext} as any);
  expect(post2Result).toHaveProperty("id");
  expect(post2Result).toHaveProperty("version");
  // there should be two comments in the comments subcollection
  const result2 = await admin.firestore().collection(commentsPath).orderBy("createdAt").get();
  expect(result2.docs.length).toBe(2);
  expect(result2.docs[1].data().name).toBe(kTeacherName);
  expect(result2.docs[1].data().content).toBe(kComment2);
}

describe("postDocumentComment", () => {
  let documentCollection: CollectionRef;

  beforeEach(async () => {
    await clearFirestoreData(projectConfig);

    documentCollection = admin.firestore().collection("demo/test/documents");
    await documentCollection.doc("1234").set({
      key: "doc-key",
      strategies: [],
    });
  });

  it("should add document comments for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `authed/${kCanonicalPortal}/documents/${kDocumentKey}`;
    await testWriteComments(documentCollectionPath, authWithTeacherClaims);
  });

  it("should add document comments for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `demo/${kDemoName}/documents/${kDocumentKey}`;
    await testWriteComments(documentCollectionPath, authWithNoClaims, {appMode: "demo"});
  });

  it("should add document comments for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `qa/${kFirebaseUserId}/documents/${kDocumentKey}`;
    await testWriteComments(documentCollectionPath, authWithTeacherClaims, {appMode: "qa"});
  });

  it("should add curriculum comments for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `authed/${kCanonicalPortal}/curriculum/${escapeKey(kCurriculumKey)}`;
    await testWriteComments(documentCollectionPath, authWithTeacherClaims);
  });

  it("should add curriculum comments for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `demo/${kDemoName}/curriculum/${escapeKey(kCurriculumKey)}`;
    await testWriteComments(documentCollectionPath, authWithNoClaims, {appMode: "demo"});
  });

  it("should add curriculum comments for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `qa/${kFirebaseUserId}/curriculum/${escapeKey(kCurriculumKey)}`;
    await testWriteComments(documentCollectionPath, authWithTeacherClaims, {appMode: "qa"});
  });
});
