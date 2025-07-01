import fftInit from "firebase-functions-test";
import {createFirestoreMetadataDocument} from "../src/create-firestore-metadata-document";
import {kUserId, kDocumentType, kDocumentKey, authWithNoClaims,
  authWithTeacherClaims,
  specValidateDocument} from "./test-utils";

const fft = fftInit();

describe("createFirestoreMetadataDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail without sufficient arguments", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    await expect(wrapped).rejects.toBeDefined();
  });

  it("should succeed when asked to warm up", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    await expect(wrapped({data: {warmUp: true}} as any)).resolves.toHaveProperty("version");
  });

  it("should fail without valid arguments", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    await expect(wrapped({} as any)).rejects.toBeDefined();
  });

  it("should fail without valid teacher name", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    const data = specValidateDocument({
      context: {name: "", teachers: [kUserId], network: ""},
    });
    expect(wrapped({data, auth: authWithTeacherClaims} as any)).rejects.toBeDefined();
  });

  it("should fail without valid teacher list", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    const data = specValidateDocument({context: {teachers: []}});
    await expect(wrapped({data, auth: authWithTeacherClaims} as any)).rejects.toBeDefined();
  });

  it("should fail without valid document uid", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    const data = specValidateDocument({
      document: {uid: "", type: kDocumentType, key: kDocumentKey, createdAt: Date.now()},
    });
    await expect(wrapped({data, auth: authWithTeacherClaims} as any)).rejects.toBeDefined();
  });

  it("should fail without valid document type", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    const data = specValidateDocument({
      document: {uid: kUserId, type: "", key: kDocumentKey, createdAt: Date.now()},
    });
    await expect(wrapped({data, auth: authWithTeacherClaims} as any)).rejects.toBeDefined();
  });

  it("should fail without valid document key", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    const data = specValidateDocument({
      document: {uid: kUserId, type: kDocumentType, key: "", createdAt: Date.now()},
    });
    await expect(wrapped({data, auth: authWithTeacherClaims} as any)).rejects.toBeDefined();
  });

  it("should fail without valid claims", async () => {
    const wrapped = fft.wrap(createFirestoreMetadataDocument);
    const data = specValidateDocument();
    await expect(wrapped({data, auth: authWithNoClaims} as any)).rejects.toBeDefined();
  });
});
