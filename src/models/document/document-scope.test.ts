import { getCurriculumScopeLabel, hasGroupOwnerScope, hasUnitCurriculumScope } from "./document-scope";

describe("document scope guards", () => {
  // One case per document shape CLUE stores, so the guards are pinned against every shape they
  // must distinguish rather than only the two this feature introduces.
  const personal = { unit: null, investigation: null, groupId: null };
  const problem = { unit: "sas", investigation: "1", problem: "2", offeringId: "off-1", groupId: null };
  const group = { unit: "sas", investigation: "1", problem: "2", offeringId: "off-1", groupId: "3" };
  const exemplar = { unit: "qa", investigation: "1", problem: "1" }; // curriculum-authored: no offering
  const classWide = { unit: "sas", investigation: null, groupId: null };
  const legacyClassWide = { unit: "sas" }; // created before investigation/problem were stamped

  describe("hasGroupOwnerScope", () => {
    it("is true only when the document carries a group id", () => {
      expect(hasGroupOwnerScope(group)).toBe(true);
      expect(hasGroupOwnerScope(personal)).toBe(false);
      expect(hasGroupOwnerScope(problem)).toBe(false);
      expect(hasGroupOwnerScope(exemplar)).toBe(false);
      expect(hasGroupOwnerScope(classWide)).toBe(false);
    });

    it("reads only the owner dimension, whatever the curriculum scope holds", () => {
      // The two dimensions are independent: a group id decides this guard on its own.
      expect(hasGroupOwnerScope({ groupId: "3" })).toBe(true);
      expect(hasGroupOwnerScope({ unit: "sas", groupId: "3" })).toBe(true);
    });
  });

  describe("hasUnitCurriculumScope", () => {
    it("is true for a document scoped to a unit and nothing narrower", () => {
      expect(hasUnitCurriculumScope(classWide)).toBe(true);
      expect(hasUnitCurriculumScope(legacyClassWide)).toBe(true);
    });

    it("is false for every other curriculum position", () => {
      expect(hasUnitCurriculumScope(personal)).toBe(false);      // no unit
      expect(hasUnitCurriculumScope(problem)).toBe(false);       // narrowed to an investigation
      expect(hasUnitCurriculumScope(group)).toBe(false);         // narrowed to an investigation
      expect(hasUnitCurriculumScope(exemplar)).toBe(false);      // narrowed to an investigation
    });

    it("is false for a document in an offering, which assigns one problem", () => {
      // An offering narrows the curriculum dimension on its own, whatever the other fields hold.
      expect(hasUnitCurriculumScope({ unit: "sas", offeringId: "off-1" })).toBe(false);
    });

    it("reads only the curriculum dimension, whatever the owner scope holds", () => {
      // A group id does not narrow curriculum scope, so it cannot decide this guard. No kind creates
      // this shape today; the guard answers about its own dimension regardless.
      expect(hasUnitCurriculumScope({ unit: "sas", groupId: "3" })).toBe(true);
    });

    it("treats an empty-string unit as no unit", () => {
      expect(hasUnitCurriculumScope({ unit: "", investigation: null, groupId: null })).toBe(false);
    });
  });

  describe("getCurriculumScopeLabel", () => {
    it("names the problem a document belongs to", () => {
      expect(getCurriculumScopeLabel(problem)).toBe("sas-1.2");
      expect(getCurriculumScopeLabel(group)).toBe("sas-1.2");
      expect(getCurriculumScopeLabel(exemplar)).toBe("qa-1.1");
    });

    it("names the unit alone when the document is scoped no narrower", () => {
      expect(getCurriculumScopeLabel(classWide)).toBe("sas");
      expect(getCurriculumScopeLabel(legacyClassWide)).toBe("sas");
    });

    it("returns undefined when the document has no unit", () => {
      expect(getCurriculumScopeLabel(personal)).toBeUndefined();
      expect(getCurriculumScopeLabel({ unit: "" })).toBeUndefined();
    });

    it("keeps the investigation when a document has one but no problem", () => {
      // No registered scope type produces this shape; the label degrades rather than dropping it.
      expect(getCurriculumScopeLabel({ unit: "sas", investigation: "1" })).toBe("sas-1.x");
    });
  });
});
