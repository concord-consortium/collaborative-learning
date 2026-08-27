import {
  getOfferingIdFromFirebaseMetadata, getUserDocumentMetadataPath, type IMetadataDatabase
} from "./document-metadata-lookup";

// Minimal RTDB stand-in. `nodes` maps a full path to the value stored there; a path absent from the
// map reads back as a non-existent node. `throwOn` makes a path reject, so a transport failure can be
// told apart from a missing node — the two mean different things to every caller.
function makeRtdb(nodes: Record<string, any>, throwOn: string[] = []) {
  const reads: string[] = [];
  const db: IMetadataDatabase & { reads: string[] } = {
    reads,
    ref: (path: string) => ({
      once: (_eventType: "value") => {
        reads.push(path);
        if (throwOn.includes(path)) return Promise.reject(new Error("rtdb unavailable"));
        const value = nodes[path];
        return Promise.resolve({ exists: () => value !== undefined, val: () => value });
      }
    })
  };
  return db;
}

const kBasePath = "/authed/portals/learn_concord_org/classes";
const kPath = `${kBasePath}/class-1/users/user-1/documentMetadata/doc-1`;

describe("getUserDocumentMetadataPath", () => {
  it("builds the path the app writes basic document metadata to", () => {
    expect(getUserDocumentMetadataPath(kBasePath, "class-1", "user-1", "doc-1")).toBe(kPath);
  });
});

describe("getOfferingIdFromFirebaseMetadata", () => {
  it("returns the offeringId stored on the metadata node", async () => {
    const db = makeRtdb({ [kPath]: { offeringId: "2001", type: "problem" } });
    expect(await getOfferingIdFromFirebaseMetadata(db, kBasePath, "class-1", "user-1", "doc-1"))
      .toEqual({ status: "found", offeringId: "2001" });
    expect(db.reads).toEqual([kPath]);
  });

  it("reports a missing node separately from a node without the field", async () => {
    // These two are the census's whole point: the first says the metadata tree was never written for
    // this document, the second says it was written without an offering. Different causes, different
    // fixes — collapsing them into one "not found" would destroy the diagnosis.
    const absent = makeRtdb({});
    expect(await getOfferingIdFromFirebaseMetadata(absent, kBasePath, "class-1", "user-1", "doc-1"))
      .toEqual({ status: "noMetadataNode" });

    const fieldless = makeRtdb({ [kPath]: { type: "problem" } });
    expect(await getOfferingIdFromFirebaseMetadata(fieldless, kBasePath, "class-1", "user-1", "doc-1"))
      .toEqual({ status: "nodeWithoutOfferingId" });
  });

  it("treats a null node body as a missing node", async () => {
    const db = makeRtdb({ [kPath]: null });
    expect(await getOfferingIdFromFirebaseMetadata(db, kBasePath, "class-1", "user-1", "doc-1"))
      .toEqual({ status: "noMetadataNode" });
  });

  it("treats an empty-string offeringId as absent", async () => {
    // The app defaults an unresolved offering to "", which is falsy everywhere else in CLUE. Reporting
    // it as found would write an empty string back and leave the document exactly as misclassified.
    const db = makeRtdb({ [kPath]: { offeringId: "" } });
    expect(await getOfferingIdFromFirebaseMetadata(db, kBasePath, "class-1", "user-1", "doc-1"))
      .toEqual({ status: "nodeWithoutOfferingId" });
  });

  it("propagates a read failure instead of reporting it as not-found", async () => {
    const db = makeRtdb({}, [kPath]);
    await expect(getOfferingIdFromFirebaseMetadata(db, kBasePath, "class-1", "user-1", "doc-1"))
      .rejects.toThrow("rtdb unavailable");
  });

  it("treats a non-string offeringId as absent", async () => {
    const db = makeRtdb({ [kPath]: { offeringId: 2001 } });
    expect(await getOfferingIdFromFirebaseMetadata(db, kBasePath, "class-1", "user-1", "doc-1"))
      .toEqual({ status: "nodeWithoutOfferingId" });
  });
});
