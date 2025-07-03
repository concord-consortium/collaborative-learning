import * as admin from "firebase-admin";
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {authWithNoClaims, authWithTeacherClaims, kCanonicalPortal, kCurriculumKey,
  kDemoName, kDocumentKey, kFirebaseUserId, kUserId, specValidateCurriculum, specValidateDocument} from "./test-utils";
import {escapeKey, ICurriculumMetadata, IDocumentMetadata,
  isCurriculumMetadata, IUserContext} from "../../shared/shared";
import {initialize, projectConfig} from "./initialize";
import {createFirestoreMetadataDocument} from "../src/create-firestore-metadata-document";

type CollectionRef = admin.firestore.CollectionReference<admin.firestore.DocumentData, admin.firestore.DocumentData>;

const {fft} = initialize();
const kExpectedAssertions = 8;

async function testCreateFirestoreMetadataDocument(docPath: string, authContext: any, context?: Partial<IUserContext>) {
  // can validate a document that doesn't yet exist in Firestore
  const isCurriculum = docPath.includes("curriculum");
  const docKey = isCurriculum ? kCurriculumKey : kDocumentKey;
  if (isCurriculum) {
    expect(docPath).toContain(escapeKey(docKey));
  } else {
    expect(docPath).toContain(docKey);
  }
  const docParams = isCurriculum ?
    specValidateCurriculum({context}) :
    specValidateDocument({context});
  const wrapped = fft.wrap(createFirestoreMetadataDocument);
  const validateResult = await wrapped({data: docParams, auth: authContext} as any);
  expect(validateResult).toHaveProperty("id");
  expect(validateResult).toHaveProperty("version");
  expect(validateResult).toHaveProperty("data");

  // the document should be at the expected path
  const docResult = await admin.firestore().doc(docPath).get();
  const docData = isCurriculum ?
                    docResult.data() as ICurriculumMetadata :
                    docResult.data() as IDocumentMetadata;
  if (isCurriculumMetadata(docData)) {
    // not part of metadata, but added by firebase function
    expect((docData as any).uid).toBe(kUserId);
  } else {
    expect(docData.uid).toBe(kUserId);
  }

  // can validate a document that already exists
  const validate2Result = await wrapped({data: docParams, auth: authContext} as any);
  expect(validate2Result).toHaveProperty("id");
  expect(validate2Result).toHaveProperty("version");
  expect(validateResult).toHaveProperty("data");
}

describe("createFirestoreMetadataDocument", () => {
  let documentCollection: CollectionRef;

  beforeEach(async () => {
    await clearFirestoreData(projectConfig);

    documentCollection = admin.firestore().collection("demo/test/documents");
    await documentCollection.doc("1234").set({
      key: "doc-key",
      strategies: [],
    });
  });

  it("should validate documents for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `authed/${kCanonicalPortal}/documents/${kDocumentKey}`;
    await testCreateFirestoreMetadataDocument(documentCollectionPath, authWithTeacherClaims);
  });

  it("should validate documents for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `demo/${kDemoName}/documents/${kDocumentKey}`;
    await testCreateFirestoreMetadataDocument(documentCollectionPath, authWithNoClaims, {appMode: "demo"});
  });

  it("should validate documents for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `qa/${kFirebaseUserId}/documents/${kDocumentKey}`;
    await testCreateFirestoreMetadataDocument(documentCollectionPath, authWithNoClaims, {appMode: "qa"});
  });

  it("should validate curriculum documents for authenticated users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `authed/${kCanonicalPortal}/curriculum/${escapeKey(kCurriculumKey)}`;
    await testCreateFirestoreMetadataDocument(documentCollectionPath, authWithTeacherClaims);
  });

  it("should validate curriculum documents for demo users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `demo/${kDemoName}/curriculum/${escapeKey(kCurriculumKey)}`;
    await testCreateFirestoreMetadataDocument(documentCollectionPath, authWithNoClaims, {appMode: "demo"});
  });

  it("should validate curriculum documents for qa users", async () => {
    expect.assertions(kExpectedAssertions);

    const documentCollectionPath = `qa/${kFirebaseUserId}/curriculum/${escapeKey(kCurriculumKey)}`;
    await testCreateFirestoreMetadataDocument(documentCollectionPath, authWithNoClaims, {appMode: "qa"});
  });
});
