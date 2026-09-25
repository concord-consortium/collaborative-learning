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
  it("accepts the axes type", () => {
    expect(isAxesType(AxesDocument)).toBe(true);
  });

  it("rejects the pre-sweep value and every other document type", () => {
    // Firestore stores only "axes"; the realtime database still says "group", but no RTDB type reaches here.
    expect(isAxesType(GroupDocument)).toBe(false);
    expect(isAxesType(PersonalDocument)).toBe(false);
    expect(isAxesType(ProblemDocument)).toBe(false);
    expect(isAxesType("")).toBe(false);
  });
});

describe("isSortableType", () => {
  it("includes the axes type but not the pre-sweep value", () => {
    expect(isSortableType(AxesDocument)).toBe(true);
    expect(isSortableType(GroupDocument)).toBe(false);
  });

  it("still excludes publications", () => {
    expect(isSortableType("publication")).toBe(false);
  });
});

describe("isDocumentType", () => {
  it("rejects the pre-sweep value", () => {
    expect(isDocumentType(GroupDocument)).toBe(false);
  });
});
