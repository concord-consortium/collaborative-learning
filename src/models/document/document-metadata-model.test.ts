import { getSnapshot } from "mobx-state-tree";
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

describe("DocumentMetadataModel network", () => {
  it("stores a network from Firestore data", () => {
    const metadata = DocumentMetadataModel.create({
      uid: "u1", type: "problem", key: "doc-n1", network: "some-network", tools: []
    });
    expect(metadata.network).toBe("some-network");
  });

  it("defaults a missing network to null", () => {
    const metadata = DocumentMetadataModel.create({
      uid: "u1", type: "problem", key: "doc-n2", tools: []
    });
    expect(metadata.network).toBeNull();
  });
});

describe("DocumentMetadataModel", () => {
  it("accepts and retains the concurrent and kind fields", () => {
    const model = DocumentMetadataModel.create({
      uid: "u1", type: "group", key: "k1", concurrent: true, kind: "group"
    } as any);
    expect(model.concurrent).toBe(true);
    expect(model.kind).toBe("group");
    expect(getSnapshot(model)).toMatchObject({ concurrent: true, kind: "group" });
  });

  it("defaults concurrent/kind to null when absent", () => {
    const model = DocumentMetadataModel.create({ uid: "u1", type: "personal", key: "k2" });
    expect(model.concurrent).toBeNull();
    expect(model.kind).toBeNull();
  });
});
