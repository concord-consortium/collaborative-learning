import { GroupDocument, PersonalDocument, ProblemDocument } from "./document-types";
import {
  getDocumentKindInfo, getDocumentKindLabel, getDocumentKindMetadataFields, getDocumentOwner,
  getDocumentOwnerFields, getDocumentOwnerType, getDocumentLocationFields, getDocumentTitle, getKindDefinitionFor,
  isValidDocumentKind, registerDocumentKind, resetDocumentKindRegistryForTests
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
    expect(getDocumentKindInfo("unregisteredKind")).toBeUndefined();
    expect(getDocumentKindInfo(undefined)).toBeUndefined();
    expect(getDocumentKindInfo(null)).toBeUndefined();
  });

  it("registerDocumentKind adds new kinds", () => {
    registerDocumentKind("testAddedKind",
      { metadataFields: { concurrent: true }, ownerType: "user", containerType: "class" });
    expect(getDocumentKindInfo("testAddedKind")?.metadataFields.concurrent).toBe(true);
  });

  it("registerDocumentKind throws when a kind is registered more than once", () => {
    registerDocumentKind("testDuplicateKind",
      { metadataFields: {}, ownerType: "user", containerType: "class" });
    expect(() => registerDocumentKind("testDuplicateKind",
      { metadataFields: {}, ownerType: "user", containerType: "class" })).toThrow(/already registered/);
    // built-in kinds are registered at module load, so re-registering one throws too
    expect(() => registerDocumentKind(GroupDocument,
      { metadataFields: { concurrent: true }, ownerType: "group", containerType: "offering" })).toThrow();
  });

  it("registerDocumentKind throws for a kind that is not a valid camelCase identifier", () => {
    expect(() => registerDocumentKind("not-camel-case",
      { metadataFields: {}, ownerType: "user", containerType: "class" })).toThrow(/not a valid identifier/);
  });

  describe("getDocumentKindMetadataFields", () => {
    it("returns the kind's stamped axis fields, adding the kind key automatically", () => {
      expect(getDocumentKindMetadataFields(GroupDocument)).toEqual({ kind: GroupDocument, concurrent: true });
      // A registered kind with no extra axis fields still stamps its own kind key.
      expect(getDocumentKindMetadataFields(PersonalDocument)).toEqual({ kind: PersonalDocument });
    });

    it("returns an empty object for unregistered or missing kinds", () => {
      expect(getDocumentKindMetadataFields("unregisteredKind")).toEqual({});
      expect(getDocumentKindMetadataFields(undefined)).toEqual({});
      expect(getDocumentKindMetadataFields(null)).toEqual({});
    });
  });

  describe("owner", () => {
    const ctx = { userId: "u-1", groupOwnerId: "group_off_3", classOwnerId: "class_c1" };

    it("resolves a user-owned kind to the user as owner", () => {
      expect(getDocumentOwnerType(PersonalDocument)).toBe("user");   // registered user-owned kind
      expect(getDocumentOwnerType(undefined)).toBe("user");          // the type query defaults to user
      expect(getDocumentOwner(PersonalDocument, ctx)).toBe("u-1");
    });

    it("throws rather than defaulting the owner of an unregistered kind", () => {
      // Unlike getDocumentOwnerType, this must not fall back to the creating user: that would hand a
      // group's or a class's document to whoever created it, and file it in that user's canonical slot.
      // A unit-declared kind is registered only while its unit is loaded, so this is also what confines
      // document creation to the kinds the current unit defines.
      expect(() => getDocumentOwner("noSuchKind", ctx)).toThrow(/unregistered document kind/);
      expect(() => getDocumentOwner(undefined, ctx)).toThrow(/unregistered document kind/);
    });

    it("resolves the built-in group kind to the group owner", () => {
      expect(getDocumentOwnerType(GroupDocument)).toBe("group");
      expect(getDocumentOwner(GroupDocument, ctx)).toBe("group_off_3");
    });

    it("resolves a class kind to the class owner", () => {
      registerDocumentKind("testDqb",
        { metadataFields: { concurrent: true }, ownerType: "class", containerType: "classUnit" });
      expect(getDocumentOwnerType("testDqb")).toBe("class");
      expect(getDocumentOwner("testDqb", ctx)).toBe("class_c1");
    });

    it("throws rather than falling back to the user when the synthetic owner is unavailable", () => {
      // A student who is not in a group has no group owner id. Handing them the document instead would
      // make it theirs rather than the group's, and file its canonical slot under them.
      expect(() => getDocumentOwner(GroupDocument, { userId: "u-1" }))
        .toThrow(/Cannot create a group-owned document/);
      registerDocumentKind("testClassKindNoOwner",
        { metadataFields: {}, ownerType: "class", containerType: "classUnit" });
      expect(() => getDocumentOwner("testClassKindNoOwner", { userId: "u-1" }))
        .toThrow(/Cannot create a class-owned document/);
    });
  });

  describe("owner fields", () => {
    it("stamps a groupId for a group-owned kind", () => {
      expect(getDocumentOwnerFields(GroupDocument, { groupId: "3" })).toEqual({ groupId: "3" });
    });

    it("stamps nothing for a kind owned by a user or a class", () => {
      expect(getDocumentOwnerFields(ProblemDocument, { groupId: "3" })).toEqual({});
      expect(getDocumentOwnerFields(PersonalDocument, { groupId: "3" })).toEqual({});
      expect(getDocumentOwnerFields(undefined, { groupId: "3" })).toEqual({});
    });

    it("stamps nothing when the group-owned kind has no group to record", () => {
      expect(getDocumentOwnerFields(GroupDocument, {})).toEqual({});
    });
  });

  describe("location fields", () => {
    const ctx = {
      offeringId: "off-1", unit: "msu", investigation: "1", problem: "2", context_id: "class-h"
    };

    it("returns the offering and its problem for the group kind, with no owner fields among them", () => {
      // A group document is kept in the offering like the problem documents beside it; its group is an
      // owner field (getDocumentOwnerFields), not part of where it is kept.
      expect(getDocumentLocationFields(GroupDocument, ctx)).toEqual({
        offeringId: "off-1", unit: "msu", investigation: "1", problem: "2", context_id: "class-h"
      });
    });

    it("returns the unit and context_id for a class-unit kind, stating the absent curriculum explicitly", () => {
      registerDocumentKind("testWordWall",
        { metadataFields: { concurrent: true }, ownerType: "class", containerType: "classUnit" });
      expect(getDocumentLocationFields("testWordWall", ctx)).toEqual({
        unit: "msu", context_id: "class-h", investigation: null, problem: null
      });
    });

    it("returns the offering and its problem for an offering kind", () => {
      expect(getDocumentLocationFields(ProblemDocument, ctx)).toEqual({
        offeringId: "off-1", unit: "msu", investigation: "1", problem: "2", context_id: "class-h"
      });
    });

    it("returns only a null unit and context_id for a class kind and unregistered kinds", () => {
      expect(getDocumentLocationFields(PersonalDocument, ctx)).toEqual({ unit: null, context_id: "class-h" });
      expect(getDocumentLocationFields(undefined, ctx)).toEqual({ unit: null, context_id: "class-h" });
    });
  });

  describe("getKindDefinitionFor", () => {
    it("resolves a built-in kind for a document from any unit, since no unit declared it", () => {
      expect(getKindDefinitionFor({ kind: GroupDocument, unit: "sas" })?.ownerType).toBe("group");
      expect(getKindDefinitionFor({ kind: GroupDocument })?.ownerType).toBe("group");
    });

    it("returns undefined when the kind is unregistered or absent", () => {
      expect(getKindDefinitionFor({ kind: "unregisteredKind", unit: "sas" })).toBeUndefined();
      expect(getKindDefinitionFor({ unit: "sas" })).toBeUndefined();
    });

    describe("a kind declared by a unit config", () => {
      beforeEach(() => {
        resetDocumentKindRegistryForTests();
        registerDocumentKind("testScopedKind", {
          metadataFields: { concurrent: true }, ownerType: "class", containerType: "classUnit",
          unit: "sas"
        });
      });

      it("resolves for a document from the unit that declared it", () => {
        expect(getKindDefinitionFor({ kind: "testScopedKind", unit: "sas" })?.ownerType).toBe("class");
      });

      it("returns undefined for a document from another unit declaring the same kind", () => {
        // The loaded definition is not the one this document was made from, and the other unit may mean
        // something different by the name, so nothing here governs it.
        expect(getKindDefinitionFor({ kind: "testScopedKind", unit: "msa" })).toBeUndefined();
      });

      it("returns undefined for a document with no unit at all", () => {
        expect(getKindDefinitionFor({ kind: "testScopedKind" })).toBeUndefined();
      });
    });
  });

  describe("title", () => {
    it("returns the group-document label for a type:group doc", () => {
      // Regular group docs (kind "group") and legacy group docs (no kind). The label names the group, not
      // the document, so it comes from the kind rather than from anything stored per document.
      expect(getDocumentTitle({ kind: GroupDocument, type: GroupDocument, groupId: "3" }))
        .toBe("Group 3 Document");
      expect(getDocumentTitle({ type: GroupDocument, groupId: "4" })).toBe("Group 4 Document");
    });

    it("returns undefined for kinds resolved elsewhere (problem/personal/unregistered)", () => {
      expect(getDocumentTitle({ kind: ProblemDocument, type: ProblemDocument })).toBeUndefined();
      expect(getDocumentTitle({ kind: PersonalDocument, type: PersonalDocument })).toBeUndefined();
      expect(getDocumentTitle({ type: "unregistered" })).toBeUndefined();
    });

    it("supplies no title for a class-wide document, which stores its own", () => {
      // A class-wide document also stores type:"group" but carries no groupId, so it must not fall through
      // to the group-document label (which would read "Group undefined Document"). Returning undefined is
      // what sends the caller to the document's stored title.
      registerDocumentKind("testClassWideKind", {
        metadataFields: { concurrent: true }, ownerType: "class", containerType: "classUnit", unit: "sas"
      });
      expect(getDocumentTitle({ kind: "testClassWideKind", type: GroupDocument })).toBeUndefined();
      expect(getDocumentTitle({ kind: "unregisteredClassWideKind", type: GroupDocument })).toBeUndefined();
    });
  });

  describe("getDocumentKindLabel", () => {
    it("reads a camelCase kind as words", () => {
      expect(getDocumentKindLabel("drivingQuestionBoard")).toBe("Driving Question Board");
      expect(getDocumentKindLabel("group")).toBe("Group");
    });

    it("returns undefined when there is no kind", () => {
      expect(getDocumentKindLabel(undefined)).toBeUndefined();
      expect(getDocumentKindLabel(null)).toBeUndefined();
      expect(getDocumentKindLabel("")).toBeUndefined();
    });
  });

  describe("getDocumentLocationFields for a classUnit kind", () => {
    const ctx = {
      unit: "sas", investigation: "1", problem: "2",
      context_id: "class-hash", offeringId: "off-1"
    };

    beforeEach(() => {
      resetDocumentKindRegistryForTests();
      registerDocumentKind("testClassWideKind", {
        metadataFields: { concurrent: true }, ownerType: "class", containerType: "classUnit"
      });
    });

    it("stamps the unit and class, and states the absent curriculum explicitly", () => {
      // `investigation`/`problem` are written as null rather than omitted: a null field means "not about
      // an investigation or problem" (firestore.rules hasPresentField), which is what makes a class+unit
      // document queryable — `where("investigation", "==", null)` cannot match a missing field.
      expect(getDocumentLocationFields("testClassWideKind", ctx)).toEqual({
        unit: "sas",
        context_id: "class-hash",
        investigation: null,
        problem: null
      });
    });

    it("does not stamp an offering", () => {
      expect(getDocumentLocationFields("testClassWideKind", ctx).offeringId).toBeUndefined();
    });

    it("leaves the group kind's location unchanged", () => {
      expect(getDocumentLocationFields(GroupDocument, ctx)).toEqual({
        unit: "sas", investigation: "1", problem: "2",
        context_id: "class-hash", offeringId: "off-1"
      });
    });
  });
});
