import {
  kClassWideProfile, kGroupProfile, kPersonalLikeProfile
} from "./document-axis-profiles";
import {
  AxesDocument, GroupDocument, LearningLogDocument, PersonalDocument, ProblemDocument
} from "./document-types";
import {
  getDocumentAxisProfileName, getDocumentKindInfo, getDocumentKindLabel, getDocumentKindMetadataFields,
  getDocumentOwner, registerClassWideDocumentKind,
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
    expect(getDocumentKindInfo(GroupDocument)?.profile.concurrent).toBe(true);
  });

  it("returns undefined for unregistered or missing kinds", () => {
    expect(getDocumentKindInfo("unregisteredKind")).toBeUndefined();
    expect(getDocumentKindInfo(undefined)).toBeUndefined();
    expect(getDocumentKindInfo(null)).toBeUndefined();
  });

  it("registerDocumentKind adds new kinds", () => {
    registerDocumentKind("testAddedKind",
      { profile: kGroupProfile });
    expect(getDocumentKindInfo("testAddedKind")?.profile.concurrent).toBe(true);
  });

  it("registerDocumentKind throws when a kind is registered more than once", () => {
    registerDocumentKind("testDuplicateKind",
      { profile: kPersonalLikeProfile });
    expect(() => registerDocumentKind("testDuplicateKind",
      { profile: kPersonalLikeProfile })).toThrow(/already registered/);
    // built-in kinds are registered at module load, so re-registering one throws too
    expect(() => registerDocumentKind(GroupDocument,
      { profile: kGroupProfile })).toThrow();
  });

  it("registerDocumentKind throws for a kind that is not a valid camelCase identifier", () => {
    expect(() => registerDocumentKind("not-camel-case",
      { profile: kPersonalLikeProfile })).toThrow(/not a valid identifier/);
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

  describe("getDocumentAxisProfileName", () => {
    it("names the profile each built-in kind is created at", () => {
      expect(getDocumentAxisProfileName(GroupDocument)).toBe("group");
      expect(getDocumentAxisProfileName(PersonalDocument)).toBe("personalLike");
      expect(getDocumentAxisProfileName(ProblemDocument)).toBe("problemLike");
    });

    it("gives kinds that share a profile the same name", () => {
      // What separates a personal document from a learning log is presentation, not any axis, so both
      // belong to one migration cohort.
      expect(getDocumentAxisProfileName(LearningLogDocument))
        .toBe(getDocumentAxisProfileName(PersonalDocument));
    });

    it("names the class-wide profile for a kind a unit declares", () => {
      // The config supplies no axis values, so every declared kind lands on this one profile.
      registerClassWideDocumentKind("testProfileDqb", "DQB", "sas");
      expect(getDocumentAxisProfileName("testProfileDqb")).toBe("classWide");
    });

    it("returns undefined for an unregistered kind", () => {
      expect(getDocumentAxisProfileName("unregisteredKind")).toBeUndefined();
      expect(getDocumentAxisProfileName(undefined)).toBeUndefined();
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
        { profile: kClassWideProfile });
      expect(getDocumentOwnerType("testDqb")).toBe("class");
      expect(getDocumentOwner("testDqb", ctx)).toBe("class_c1");
    });

    it("throws rather than falling back to the user when the synthetic owner is unavailable", () => {
      // A student who is not in a group has no group owner id. Handing them the document instead would
      // make it theirs rather than the group's, and file its canonical slot under them.
      expect(() => getDocumentOwner(GroupDocument, { userId: "u-1" }))
        .toThrow(/Cannot create a group-owned document/);
      registerDocumentKind("testClassKindNoOwner",
        { profile: kClassWideProfile });
      expect(() => getDocumentOwner("testClassKindNoOwner", { userId: "u-1" }))
        .toThrow(/Cannot create a class-owned document/);
    });
  });

  describe("owner fields", () => {
    it("stamps a groupId for a group-owned kind", () => {
      expect(getDocumentOwnerFields(GroupDocument, "3")).toEqual({ groupId: "3" });
    });

    it("stamps nothing for a kind owned by a user or a class", () => {
      expect(getDocumentOwnerFields(ProblemDocument, "3")).toEqual({});
      expect(getDocumentOwnerFields(PersonalDocument, "3")).toEqual({});
      expect(getDocumentOwnerFields(undefined, "3")).toEqual({});
    });

    it("stamps nothing when the group-owned kind has no group to record", () => {
      expect(getDocumentOwnerFields(GroupDocument, undefined)).toEqual({});
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
        { profile: kClassWideProfile });
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
      expect(getKindDefinitionFor({ kind: GroupDocument, unit: "sas" })?.profile.ownerType).toBe("group");
      expect(getKindDefinitionFor({ kind: GroupDocument })?.profile.ownerType).toBe("group");
    });

    it("returns undefined when the kind is unregistered or absent", () => {
      expect(getKindDefinitionFor({ kind: "unregisteredKind", unit: "sas" })).toBeUndefined();
      expect(getKindDefinitionFor({ unit: "sas" })).toBeUndefined();
    });

    describe("a kind declared by a unit config", () => {
      beforeEach(() => {
        resetDocumentKindRegistryForTests();
        registerDocumentKind("testScopedKind", {
          profile: kClassWideProfile,
          title: "Driving Question Board", unit: "sas"
        });
      });

      it("resolves for a document from the unit that declared it", () => {
        expect(getKindDefinitionFor({ kind: "testScopedKind", unit: "sas" })?.title)
          .toBe("Driving Question Board");
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
    it("returns a class-wide kind's registered static title", () => {
      registerDocumentKind("testDqbTitle", {
        profile: kClassWideProfile,
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

    it("titles an axes-typed group document from its groupId", () => {
      expect(getDocumentTitle({ type: AxesDocument, groupId: "4" })).toBe("Group 4 Document");
    });

    it("does not title an axes-typed class-wide document as a group document", () => {
      // No groupId: a class-wide document must fall through to undefined, not "Group undefined Document".
      expect(getDocumentTitle({ type: AxesDocument, kind: "unregisteredClassWideKind" })).toBeUndefined();
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

    describe("a title declared by a unit config", () => {
      beforeEach(() => {
        resetDocumentKindRegistryForTests();
        registerDocumentKind("testUnitDeclaredKind", {
          profile: kClassWideProfile,
          title: "Driving Question Board", unit: "sas"
        });
      });

      it("names a document from the unit that declared it", () => {
        expect(getDocumentTitle({ kind: "testUnitDeclaredKind", type: GroupDocument, unit: "sas" }))
          .toBe("Driving Question Board");
      });

      it("does not name a document from another unit that declares the same kind", () => {
        // Only the current unit's config is loaded, and another unit may word the same kind
        // differently, so its document falls through to the caller's fallback rather than borrowing
        // this title.
        expect(getDocumentTitle({ kind: "testUnitDeclaredKind", type: GroupDocument, unit: "msa" }))
          .toBeUndefined();
      });
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
      registerDocumentKind("testClassWideKind", { profile: kClassWideProfile });
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
