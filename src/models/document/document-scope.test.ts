import { hasClassUnitScope, hasGroupScope } from "./document-scope";

describe("document scope guards", () => {
  // One case per document shape CLUE stores, so the guards are pinned against every shape they
  // must distinguish rather than only the two this feature introduces.
  const personal = { unit: null, investigation: null, groupId: null };
  const problem = { unit: "sas", investigation: "1", problem: "2", groupId: null };
  const group = { unit: "sas", investigation: "1", problem: "2", groupId: "3" };
  const exemplar = { unit: "qa", investigation: "1", problem: "1" };
  const classWide = { unit: "sas", investigation: null, groupId: null };
  const legacyClassWide = { unit: "sas" }; // created before investigation/problem were stamped

  describe("hasGroupScope", () => {
    it("is true only when the document carries a group id", () => {
      expect(hasGroupScope(group)).toBe(true);
      expect(hasGroupScope(personal)).toBe(false);
      expect(hasGroupScope(problem)).toBe(false);
      expect(hasGroupScope(exemplar)).toBe(false);
      expect(hasGroupScope(classWide)).toBe(false);
    });
  });

  describe("hasClassUnitScope", () => {
    it("is true only for a document scoped to a unit and nothing narrower", () => {
      expect(hasClassUnitScope(classWide)).toBe(true);
      expect(hasClassUnitScope(legacyClassWide)).toBe(true);
    });

    it("is false for every other document shape", () => {
      expect(hasClassUnitScope(personal)).toBe(false);      // no unit
      expect(hasClassUnitScope(problem)).toBe(false);       // has an investigation
      expect(hasClassUnitScope(group)).toBe(false);         // has an investigation and a group
      expect(hasClassUnitScope(exemplar)).toBe(false);      // has an investigation
    });

    it("treats an empty-string unit as no unit", () => {
      expect(hasClassUnitScope({ unit: "", investigation: null, groupId: null })).toBe(false);
    });
  });
});
