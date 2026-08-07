import {
  AxesDocument, GroupDocument, PersonalDocument, ProblemDocument,
  isAxesType, isDocumentType, isSortableType
} from "./document-types";

describe("AxesDocument", () => {
  it("is the stored value 'axes'", () => {
    expect(AxesDocument).toBe("axes");
  });

  it("is accepted by the MST document type enum", () => {
    expect(isDocumentType(AxesDocument)).toBe(true);
  });
});

describe("isAxesType", () => {
  it("accepts the new value", () => {
    expect(isAxesType(AxesDocument)).toBe(true);
  });

  // TRANSITIONAL: documents written before CLUE-604's sweep still store "group". Dropping this
  // case is part of the post-sweep cleanup, not of this change.
  it("accepts the pre-sweep value", () => {
    expect(isAxesType(GroupDocument)).toBe(true);
  });

  it("rejects every other document type", () => {
    expect(isAxesType(PersonalDocument)).toBe(false);
    expect(isAxesType(ProblemDocument)).toBe(false);
    expect(isAxesType("")).toBe(false);
  });
});

describe("isSortableType", () => {
  it("includes both the new and the pre-sweep axes values", () => {
    expect(isSortableType(AxesDocument)).toBe(true);
    expect(isSortableType(GroupDocument)).toBe(true);
  });

  it("still excludes publications", () => {
    expect(isSortableType("publication")).toBe(false);
  });
});
