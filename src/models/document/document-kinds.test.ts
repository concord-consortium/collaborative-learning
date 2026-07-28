import { GroupDocument, PersonalDocument, ProblemDocument } from "./document-types";
import {
  getDocumentKindInfo, getDocumentKindMetadataFields, getDocumentOwner, getDocumentOwnerType,
  getDocumentScopeFields, getDocumentTitle, isValidDocumentKind, registerDocumentKind,
  resetDocumentKindRegistryForTests
} from "./document-kinds";

describe("isValidDocumentKind", () => {
  it("accepts camelCase identifiers, including the built-in document type strings", () => {
    ["group", "personal", "learningLog", "personalPublication", "drivingQuestionBoard", "wordWall", "slot2"]
      .forEach(kind => expect(isValidDocumentKind(kind)).toBe(true));
  });

  it("rejects separators, special characters, a leading uppercase or digit, and the empty string", () => {
    ["driving-question-board", "word wall", "word_wall", "DQB", "2board", "board!", "a/b", ".", "__proto__", ""]
      .forEach(kind => expect(isValidDocumentKind(kind)).toBe(false));
  });
});

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
    registerDocumentKind("testAddedKind",
      { metadataFields: { concurrent: true }, ownerType: "user", scopeType: "class" });
    expect(getDocumentKindInfo("testAddedKind")?.metadataFields.concurrent).toBe(true);
  });

  it("registerDocumentKind throws when a kind is registered more than once", () => {
    registerDocumentKind("testDuplicateKind",
      { metadataFields: {}, ownerType: "user", scopeType: "class" });
    expect(() => registerDocumentKind("testDuplicateKind",
      { metadataFields: {}, ownerType: "user", scopeType: "class" })).toThrow(/already registered/);
    // built-in kinds are registered at module load, so re-registering one throws too
    expect(() => registerDocumentKind(GroupDocument,
      { metadataFields: { concurrent: true }, ownerType: "group", scopeType: "group" })).toThrow();
  });

  it("registerDocumentKind throws for a kind that is not a valid camelCase identifier", () => {
    expect(() => registerDocumentKind("not-camel-case",
      { metadataFields: {}, ownerType: "user", scopeType: "class" })).toThrow(/not a valid identifier/);
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
      registerDocumentKind("testDqb",
        { metadataFields: { concurrent: true }, ownerType: "class", scopeType: "classUnit" });
      expect(getDocumentOwnerType("testDqb")).toBe("class");
      expect(getDocumentOwner("testDqb", ctx)).toBe("class_c1");
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

    it("returns the unit and context_id for a class-unit kind, with curriculum scope stated as absent", () => {
      registerDocumentKind("testWordWall",
        { metadataFields: { concurrent: true }, ownerType: "class", scopeType: "classUnit" });
      expect(getDocumentScopeFields("testWordWall", ctx)).toEqual({
        unit: "msu", context_id: "class-h", investigation: null, problem: null
      });
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

  describe("title", () => {
    it("returns a class-wide kind's registered static title", () => {
      registerDocumentKind("testDqbTitle", {
        metadataFields: { concurrent: true }, ownerType: "class", scopeType: "classUnit",
        title: "Driving Question Board"
      });
      expect(getDocumentTitle({ kind: "testDqbTitle", type: GroupDocument })).toBe("Driving Question Board");
    });

    it("returns the group-document label for a type:group doc with no registered title", () => {
      // Regular group docs (kind "group", which registers no title) and legacy group docs (no kind).
      expect(getDocumentTitle({ kind: GroupDocument, type: GroupDocument, groupId: "3" }))
        .toBe("Group 3 Document");
      expect(getDocumentTitle({ type: GroupDocument, groupId: "4" })).toBe("Group 4 Document");
    });

    it("returns undefined for kinds resolved elsewhere (problem/personal/unregistered)", () => {
      expect(getDocumentTitle({ kind: ProblemDocument, type: ProblemDocument })).toBeUndefined();
      expect(getDocumentTitle({ kind: PersonalDocument, type: PersonalDocument })).toBeUndefined();
      expect(getDocumentTitle({ type: "unregistered" })).toBeUndefined();
    });

    it("does not mislabel a class-wide document with an unregistered kind as a group document", () => {
      // A class-wide document also stores type:"group" but carries no groupId. If its kind belongs to a
      // unit that has not loaded this session, the registry lookup above misses and this must not fall
      // through to the group-document label (which would read "Group undefined Document").
      expect(getDocumentTitle({ kind: "unregisteredClassWideKind", type: GroupDocument })).toBeUndefined();
    });
  });

  describe("getDocumentScopeFields for a classUnit kind", () => {
    const ctx = {
      unit: "sas", investigation: "1", problem: "2",
      context_id: "class-hash", groupId: "3", offeringId: "off-1"
    };

    beforeEach(() => {
      resetDocumentKindRegistryForTests();
      registerDocumentKind("testClassWideKind", {
        metadataFields: { concurrent: true }, ownerType: "class", scopeType: "classUnit"
      });
    });

    it("stamps the unit and class, and states the absent curriculum scope explicitly", () => {
      // `investigation`/`problem` are written as null rather than omitted: a null scope field means
      // "absent scope" (firestore.rules hasScopeField), which is what makes the class+unit scope
      // queryable — `where("investigation", "==", null)` cannot match a missing field.
      expect(getDocumentScopeFields("testClassWideKind", ctx)).toEqual({
        unit: "sas",
        context_id: "class-hash",
        investigation: null,
        problem: null
      });
    });

    it("does not stamp an offering or a group", () => {
      const fields = getDocumentScopeFields("testClassWideKind", ctx);
      expect(fields.offeringId).toBeUndefined();
      expect(fields.groupId).toBeUndefined();
    });

    it("leaves the group scope unchanged", () => {
      expect(getDocumentScopeFields(GroupDocument, ctx)).toEqual({
        unit: "sas", investigation: "1", problem: "2",
        context_id: "class-hash", offeringId: "off-1", groupId: "3"
      });
    });
  });
});
