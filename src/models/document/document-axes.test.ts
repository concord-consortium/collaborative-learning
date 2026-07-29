import { getCurriculumLabel, hasClassOwner, hasGroupOwner, isInClassUnitContainer } from "./document-axes";

describe("document axis guards", () => {
  // One case per document shape CLUE stores, so the guards are pinned against every shape they
  // must distinguish rather than only the two this feature introduces. Each carries the uid its
  // owner would mint: a real user id, or one of the synthetic ones.
  const personal = { uid: "u-1", unit: null, investigation: null, groupId: null };
  const problem =
    { uid: "u-1", unit: "sas", investigation: "1", problem: "2", offeringId: "off-1", groupId: null };
  const group =
    { uid: "group_off-1_3", unit: "sas", investigation: "1", problem: "2", offeringId: "off-1", groupId: "3" };
  // Curriculum-authored, so it belongs to no offering and is owned by an authoring persona.
  const exemplar = { uid: "ivan_idea_1", unit: "qa", investigation: "1", problem: "1" };
  const classWide = { uid: "class_h1", unit: "sas", investigation: null, groupId: null };
  // Created before investigation/problem were stamped.
  const legacyClassWide = { uid: "class_h1", unit: "sas" };

  describe("hasGroupOwner", () => {
    it("is true only when the document carries a group id", () => {
      expect(hasGroupOwner(group)).toBe(true);
      expect(hasGroupOwner(personal)).toBe(false);
      expect(hasGroupOwner(problem)).toBe(false);
      expect(hasGroupOwner(exemplar)).toBe(false);
      expect(hasGroupOwner(classWide)).toBe(false);
    });

    it("reads only the owner dimension, whatever the curriculum scope holds", () => {
      // The two dimensions are independent: a group id decides this guard on its own.
      expect(hasGroupOwner({ groupId: "3" })).toBe(true);
      expect(hasGroupOwner({ unit: "sas", groupId: "3" })).toBe(true);
    });
  });

  describe("hasClassOwner", () => {
    it("is true only for a document owned by the synthetic class uid", () => {
      expect(hasClassOwner(classWide)).toBe(true);
      expect(hasClassOwner(legacyClassWide)).toBe(true);
    });

    it("is false for every other owner", () => {
      expect(hasClassOwner(personal)).toBe(false);   // a real user
      expect(hasClassOwner(problem)).toBe(false);    // a real user
      expect(hasClassOwner(group)).toBe(false);      // the synthetic group uid
      expect(hasClassOwner(exemplar)).toBe(false);   // a synthetic authoring persona
    });

    it("reads only the owner, whatever the document is about or where it is kept", () => {
      expect(hasClassOwner({ uid: "class_h1" })).toBe(true);
      expect(hasClassOwner({ uid: "class_h1", unit: "sas", investigation: "1", offeringId: "off-1" }))
        .toBe(true);
    });

    it("is false when the document has no uid at all", () => {
      expect(hasClassOwner({ unit: "sas" })).toBe(false);
    });
  });

  describe("isInClassUnitContainer", () => {
    it("is true for a document kept in the class's copy of a unit", () => {
      expect(isInClassUnitContainer(classWide)).toBe(true);
      expect(isInClassUnitContainer(legacyClassWide)).toBe(true);
      // An exemplar is about a problem but belongs to no offering, so it is kept here too.
      expect(isInClassUnitContainer(exemplar)).toBe(true);
    });

    it("is false for a document kept in an offering", () => {
      expect(isInClassUnitContainer(problem)).toBe(false);
      expect(isInClassUnitContainer(group)).toBe(false);
    });

    it("is false for a document kept at the class, with no unit", () => {
      expect(isInClassUnitContainer(personal)).toBe(false);
    });

    it("reads only the container, whatever the owner holds", () => {
      // A group id cannot decide this guard: it says who owns the document, not where it is kept.
      expect(isInClassUnitContainer({ unit: "sas", groupId: "3" })).toBe(true);
    });

    it("treats an empty-string unit as no unit", () => {
      expect(isInClassUnitContainer({ unit: "", offeringId: null })).toBe(false);
    });
  });

  describe("getCurriculumLabel", () => {
    it("names the problem a document belongs to", () => {
      expect(getCurriculumLabel(problem)).toBe("sas-1.2");
      expect(getCurriculumLabel(group)).toBe("sas-1.2");
      expect(getCurriculumLabel(exemplar)).toBe("qa-1.1");
    });

    it("names the unit alone when the document is scoped no narrower", () => {
      expect(getCurriculumLabel(classWide)).toBe("sas");
      expect(getCurriculumLabel(legacyClassWide)).toBe("sas");
    });

    it("returns undefined when the document has no unit", () => {
      expect(getCurriculumLabel(personal)).toBeUndefined();
      expect(getCurriculumLabel({ unit: "" })).toBeUndefined();
    });

    it("keeps the investigation when a document has one but no problem", () => {
      // No registered scope type produces this shape; the label degrades rather than dropping it.
      expect(getCurriculumLabel({ unit: "sas", investigation: "1" })).toBe("sas-1.x");
    });
  });
});
