import {
  classifyDocument, getSpaceFromFirestorePath, kOfferingContainedTypes
} from "./backfill-document-offering-id";

describe("kOfferingContainedTypes", () => {
  it("lists exactly the offering-contained type values, including both generic axes values", () => {
    // "publication" — not "problemPublication" — is the stored value for a problem publication;
    // ProblemPublication in src/models/document/document-types.ts is the constant's name. A query on
    // the wrong string returns nothing and the census reports a confident, wrong zero.
    //
    // Both "group" and "axes" appear so this script and backfill-group-document-axes.ts can run in
    // either order during the sweep.
    expect(kOfferingContainedTypes).toEqual([
      "problem", "planning", "publication", "supportPublication", "group", "axes"
    ]);
  });
});

describe("getSpaceFromFirestorePath", () => {
  it("derives the RTDB base path for an authed portal", () => {
    // The portal segment is already underscore-escaped in the Firestore path, so it is used as-is.
    expect(getSpaceFromFirestorePath("authed/learn_concord_org/documents/abc")).toEqual({
      label: "authed/learn_concord_org",
      firebaseBasePath: "/authed/portals/learn_concord_org/classes"
    });
  });

  it("derives the RTDB base path for a demo space", () => {
    expect(getSpaceFromFirestorePath("demo/CLUE/documents/abc")).toEqual({
      label: "demo/CLUE",
      firebaseBasePath: "/demo/CLUE/portals/demo/classes"
    });
  });

  it("returns undefined for a path shape it does not recognize", () => {
    // A collection-group query reaches every `documents` collection anywhere in the database. An
    // unrecognized root must be counted and skipped, never guessed at and never fatal.
    expect(getSpaceFromFirestorePath("qa/whatever/documents/abc")).toBeUndefined();
    expect(getSpaceFromFirestorePath("authed//documents/abc")).toBeUndefined();
    expect(getSpaceFromFirestorePath("authed/learn_concord_org/other/abc")).toBeUndefined();
  });
});

describe("classifyDocument", () => {
  const kPath = "authed/learn_concord_org/documents/abc";
  const problem = { type: "problem", context_id: "class-1", uid: "user-1", key: "doc-1" };

  it("sends an offering-contained document with no offeringId to the lookup", () => {
    expect(classifyDocument(problem, kPath)).toEqual({
      kind: "lookup",
      space: { label: "authed/learn_concord_org", firebaseBasePath: "/authed/portals/learn_concord_org/classes" },
      contextId: "class-1",
      uid: "user-1",
      key: "doc-1"
    });
  });

  it("counts a document that already has an offeringId", () => {
    expect(classifyDocument({ ...problem, offeringId: "2001" }, kPath))
      .toEqual({ kind: "counted", bucket: "alreadySet" });
  });

  it("skips a class-wide document under either generic type value", () => {
    // No groupId means class-wide, which is class-unit-contained and correctly has no offering.
    // Writing one would corrupt isInClassUnitContainer, which is the guard this change exists to fix.
    for (const type of ["group", "axes"]) {
      expect(classifyDocument({ type, context_id: "class-1", uid: "class_hash", key: "doc-1" }, kPath))
        .toEqual({ kind: "counted", bucket: "skippedClassWide" });
    }
  });

  it("still reports a class-wide document that wrongly carries an offeringId", () => {
    // Classified before the alreadySet check on purpose: this combination should not exist, and
    // reporting it as alreadySet would hide it behind a bucket that reads like success.
    expect(classifyDocument(
      { type: "axes", context_id: "class-1", uid: "class_hash", key: "doc-1", offeringId: "2001" }, kPath
    )).toEqual({ kind: "counted", bucket: "skippedClassWide" });
  });

  it("sends a group-scoped document to the lookup under either generic type value", () => {
    // Both values, because which one a group document stores depends on whether
    // backfill-group-document-axes.ts has already run. Accepting only one would make the sweep
    // order-dependent, and silently miss every group document if the two ran the other way round.
    for (const type of ["group", "axes"]) {
      expect(classifyDocument({ ...problem, type, groupId: "3" }, kPath))
        .toMatchObject({ kind: "lookup", contextId: "class-1" });
    }
  });

  it("counts a document whose Firestore path is in no known space", () => {
    expect(classifyDocument(problem, "qa/whatever/documents/abc"))
      .toEqual({ kind: "counted", bucket: "unknownSpace" });
  });

  it("counts a document missing any field the lookup needs", () => {
    for (const missing of ["context_id", "uid", "key"]) {
      const data: any = { ...problem };
      delete data[missing];
      expect(classifyDocument(data, kPath)).toEqual({ kind: "counted", bucket: "unusableDocument" });
    }
  });
});
