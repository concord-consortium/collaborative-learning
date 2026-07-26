import { GroupDocument, PersonalDocument, ProblemDocument } from "./document-types";
import {
  getDocumentKindInfo, getDocumentKindMetadataFields, getDocumentOwner, getDocumentOwnerType,
  getDocumentScopeFields, registerDocumentKind
} from "./document-kinds";

describe("document kinds registry", () => {
  it("resolves the built-in group kind as concurrent", () => {
    expect(getDocumentKindInfo(GroupDocument)?.metadataFields.concurrent).toBe(true);
  });

  it("returns undefined for unregistered or missing kinds", () => {
    expect(getDocumentKindInfo("unregistered-kind")).toBeUndefined();
    expect(getDocumentKindInfo(undefined)).toBeUndefined();
    expect(getDocumentKindInfo(null)).toBeUndefined();
  });

  it("registerDocumentKind adds new kinds", () => {
    registerDocumentKind("test-added-kind",
      { metadataFields: { concurrent: true }, ownerType: "user", scopeType: "class" });
    expect(getDocumentKindInfo("test-added-kind")?.metadataFields.concurrent).toBe(true);
  });

  describe("getDocumentKindMetadataFields", () => {
    it("returns the kind's stamped axis fields, adding the kind key automatically", () => {
      expect(getDocumentKindMetadataFields(GroupDocument)).toEqual({ kind: GroupDocument, concurrent: true });
      // A registered kind with no extra axis fields still stamps its own kind key.
      expect(getDocumentKindMetadataFields(PersonalDocument)).toEqual({ kind: PersonalDocument });
    });

    it("returns an empty object for unregistered or missing kinds", () => {
      expect(getDocumentKindMetadataFields("unregistered-kind")).toEqual({});
      expect(getDocumentKindMetadataFields(undefined)).toEqual({});
      expect(getDocumentKindMetadataFields(null)).toEqual({});
    });
  });

  describe("owner scope", () => {
    const ctx = { userId: "u-1", groupOwnerId: "group_off_3", classOwnerId: "class_c1" };

    it("resolves user-scoped and unregistered kinds to the user as owner", () => {
      expect(getDocumentOwnerType(PersonalDocument)).toBe("user");   // registered user-scoped kind
      expect(getDocumentOwnerType(undefined)).toBe("user");          // unregistered defaults to user
      expect(getDocumentOwner(PersonalDocument, ctx)).toBe("u-1");
    });

    it("resolves the built-in group kind to the group owner", () => {
      expect(getDocumentOwnerType(GroupDocument)).toBe("group");
      expect(getDocumentOwner(GroupDocument, ctx)).toBe("group_off_3");
    });

    it("resolves a class kind to the class owner", () => {
      registerDocumentKind("test-dqb",
        { metadataFields: { concurrent: true }, ownerType: "class", scopeType: "classUnit" });
      expect(getDocumentOwnerType("test-dqb")).toBe("class");
      expect(getDocumentOwner("test-dqb", ctx)).toBe("class_c1");
    });

    it("falls back to the user when the scope's synthetic owner was not supplied", () => {
      expect(getDocumentOwner(GroupDocument, { userId: "u-1" })).toBe("u-1");
    });
  });

  describe("scope fields", () => {
    const ctx = {
      groupId: "3", offeringId: "off-1", unit: "msu", investigation: "1", problem: "2", context_id: "class-h"
    };

    it("returns group + offering scope plus the problem context for the group kind", () => {
      expect(getDocumentScopeFields(GroupDocument, ctx)).toEqual({
        groupId: "3", offeringId: "off-1", unit: "msu", investigation: "1", problem: "2", context_id: "class-h"
      });
    });

    it("returns the unit and context_id for a class-unit kind", () => {
      registerDocumentKind("test-word-wall",
        { metadataFields: { concurrent: true }, ownerType: "class", scopeType: "classUnit" });
      expect(getDocumentScopeFields("test-word-wall", ctx)).toEqual({ unit: "msu", context_id: "class-h" });
    });

    it("returns offering scope plus the problem context for an offering kind", () => {
      expect(getDocumentScopeFields(ProblemDocument, ctx)).toEqual({
        offeringId: "off-1", unit: "msu", investigation: "1", problem: "2", context_id: "class-h"
      });
    });

    it("returns only a null unit and context_id for a class kind and unregistered kinds", () => {
      expect(getDocumentScopeFields(PersonalDocument, ctx)).toEqual({ unit: null, context_id: "class-h" });
      expect(getDocumentScopeFields(undefined, ctx)).toEqual({ unit: null, context_id: "class-h" });
    });
  });
});
