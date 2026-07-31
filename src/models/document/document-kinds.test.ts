import { GroupDocument, PersonalDocument } from "./document-types";
import { getDocumentKindInfo, getDocumentKindMetadataFields, registerDocumentKind } from "./document-kinds";

describe("document kinds registry", () => {
  it("resolves the built-in group kind as concurrent", () => {
    expect(getDocumentKindInfo(GroupDocument)?.metadataFields.concurrent).toBe(true);
  });

  it("returns undefined for unregistered or missing kinds", () => {
    expect(getDocumentKindInfo(PersonalDocument)).toBeUndefined();
    expect(getDocumentKindInfo(undefined)).toBeUndefined();
    expect(getDocumentKindInfo(null)).toBeUndefined();
  });

  it("registerDocumentKind adds new kinds", () => {
    registerDocumentKind({ kind: "test-word-wall", metadataFields: { concurrent: true } });
    expect(getDocumentKindInfo("test-word-wall")?.metadataFields.concurrent).toBe(true);
  });

  describe("getDocumentKindMetadataFields", () => {
    it("returns the kind's stamped axis fields, adding the kind key automatically", () => {
      expect(getDocumentKindMetadataFields(GroupDocument)).toEqual({ kind: GroupDocument, concurrent: true });
    });

    it("returns an empty object for unregistered or missing kinds", () => {
      expect(getDocumentKindMetadataFields(PersonalDocument)).toEqual({});
      expect(getDocumentKindMetadataFields(undefined)).toEqual({});
      expect(getDocumentKindMetadataFields(null)).toEqual({});
    });
  });
});
