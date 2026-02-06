import { getSortTypeLabel } from "./sort-utils";
import { clearTermOverrides, setTermOverrides } from "./translation/translate";

describe("sort-utils", () => {
  describe("getSortTypeLabel", () => {
    beforeEach(() => {
      clearTermOverrides();
    });

    afterEach(() => {
      clearTermOverrides();
    });

    describe("without options", () => {
      it("should return default translated label for sort types", () => {
        expect(getSortTypeLabel("Group")).toBe("Group");
        expect(getSortTypeLabel("Name")).toBe("Student");
        expect(getSortTypeLabel("Date")).toBe("Date");
        // Strategy has empty default - it's meant to use tagPrompt
        expect(getSortTypeLabel("Strategy")).toBe("");
        expect(getSortTypeLabel("Bookmarked")).toBe("Bookmarked");
        expect(getSortTypeLabel("Tools")).toBe("Tools");
        expect(getSortTypeLabel("Problem")).toBe("Problem");
      });

      it("should use module-level term overrides when set", () => {
        setTermOverrides({ studentGroup: "Team", "sortLabel.sortByOwner": "Participant" });

        expect(getSortTypeLabel("Group")).toBe("Team");
        expect(getSortTypeLabel("Name")).toBe("Participant");
        // Non-overridden types should still use defaults
        expect(getSortTypeLabel("Date")).toBe("Date");
      });
    });

    describe("with tagPrompt option (no termOverrides)", () => {
      it("should return tagPrompt for Strategy type", () => {
        expect(getSortTypeLabel("Strategy", { tagPrompt: "Design Approach" })).toBe("Design Approach");
      });

      it("should not affect non-Strategy types", () => {
        expect(getSortTypeLabel("Group", { tagPrompt: "Design Approach" })).toBe("Group");
        expect(getSortTypeLabel("Name", { tagPrompt: "Design Approach" })).toBe("Student");
      });

      it("should return empty string when tagPrompt is not provided for Strategy", () => {
        // Strategy has empty default in en-us.json - it's meant to use tagPrompt
        expect(getSortTypeLabel("Strategy")).toBe("");
        expect(getSortTypeLabel("Strategy", {})).toBe("");
      });
    });

    describe("with termOverrides option", () => {
      it("should use termOverrides values when provided", () => {
        const termOverrides = {
          studentGroup: "Team",
          "sortLabel.sortByOwner": "Participant",
          Bookmarked: "Faved"
        };

        expect(getSortTypeLabel("Group", { termOverrides })).toBe("Team");
        expect(getSortTypeLabel("Name", { termOverrides })).toBe("Participant");
        expect(getSortTypeLabel("Bookmarked", { termOverrides })).toBe("Faved");
      });

      it("should fall back to default value when termOverrides doesn't include the key", () => {
        const termOverrides = { studentGroup: "Team" };

        expect(getSortTypeLabel("Group", { termOverrides })).toBe("Team");
        expect(getSortTypeLabel("Name", { termOverrides })).toBe("Student");
      });

      it("should use tagPrompt for Strategy when no Strategy override exists", () => {
        const termOverrides = { studentGroup: "Team" };

        expect(getSortTypeLabel("Strategy", { termOverrides, tagPrompt: "Design Approach" }))
          .toBe("Design Approach");
      });

      it("should prefer explicit Strategy override over tagPrompt", () => {
        const termOverrides = { Strategy: "Custom Strategy Label" };

        expect(getSortTypeLabel("Strategy", { termOverrides, tagPrompt: "Design Approach" }))
          .toBe("Custom Strategy Label");
      });

      it("should fall back to type name if default value is empty", () => {
        // Strategy has an empty default in en-us.json, so without tagPrompt or an explicit override,
        // the code should fall back to the type name "Strategy"
        const termOverrides = {};
        expect(getSortTypeLabel("Strategy", { termOverrides })).toBe("Strategy");
      });
    });

    describe("interaction between module-level and option-level overrides", () => {
      it("should ignore module-level overrides when termOverrides option is provided", () => {
        // Set module-level override
        setTermOverrides({ studentGroup: "Module Team" });

        // Provide different termOverrides in options
        const termOverrides = { studentGroup: "Option Team" };

        // Option-level should take precedence (termOverrides branch is used)
        expect(getSortTypeLabel("Group", { termOverrides })).toBe("Option Team");
      });

      it("should use module-level overrides when no termOverrides option is provided", () => {
        setTermOverrides({ studentGroup: "Module Team" });

        expect(getSortTypeLabel("Group")).toBe("Module Team");
        expect(getSortTypeLabel("Group", {})).toBe("Module Team");
        expect(getSortTypeLabel("Group", { tagPrompt: "irrelevant" })).toBe("Module Team");
      });
    });
  });
});
