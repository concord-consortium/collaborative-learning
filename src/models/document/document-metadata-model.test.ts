import { DocumentMetadataModel } from "./document-metadata-model";

describe("DocumentMetadataModel context_id", () => {
  it("stores a context_id from Firestore data", () => {
    const metadata = DocumentMetadataModel.create({
      uid: "u1", type: "problem", key: "doc-1", context_id: "class-1", tools: []
    });
    expect(metadata.context_id).toBe("class-1");
  });

  it("allows a missing context_id", () => {
    const metadata = DocumentMetadataModel.create({
      uid: "u1", type: "problem", key: "doc-2", tools: []
    });
    expect(metadata.context_id).toBeNull();
  });
});
