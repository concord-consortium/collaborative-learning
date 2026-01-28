import { translate, setTermOverrides, clearTermOverrides, getDefaultValue } from "./translate";
import { escapeKeyForForm } from "./translation-types";

describe("translate", () => {
  beforeEach(() => {
    clearTermOverrides();
  });

  afterEach(() => {
    clearTermOverrides();
  });

  describe("default values", () => {
    it("should return default values from en-us.json when no overrides set", () => {
      expect(translate("studentGroup")).toBe("Group");
      expect(translate("sortLabel.sortByOwner")).toBe("Student");
      expect(translate("Bookmarked")).toBe("Bookmarked");
      expect(translate("Tools")).toBe("Tools");
      expect(translate("sortLabel.sortByDate")).toBe("Date");
      expect(translate("Problem")).toBe("Problem");
    });

    it("should return empty string for Strategy by default", () => {
      expect(translate("Strategy")).toBe("");
    });
  });

  describe("module-level overrides via setTermOverrides", () => {
    it("should use override value when set", () => {
      setTermOverrides({ studentGroup: "Team" });
      expect(translate("studentGroup")).toBe("Team");
    });

    it("should support multiple term overrides", () => {
      setTermOverrides({
        studentGroup: "Team",
        "sortLabel.sortByOwner": "Participant"
      });
      expect(translate("studentGroup")).toBe("Team");
      expect(translate("sortLabel.sortByOwner")).toBe("Participant");
    });

    it("should fall back to default when override not present for key", () => {
      setTermOverrides({ studentGroup: "Team" });
      expect(translate("sortLabel.sortByOwner")).toBe("Student");
    });

    it("should not use empty string override (falls back to default)", () => {
      setTermOverrides({ studentGroup: "" });
      // Empty string is falsy, so it falls back to default
      expect(translate("studentGroup")).toBe("Group");
    });

    it("should support Strategy override", () => {
      setTermOverrides({ Strategy: "Approach" });
      expect(translate("Strategy")).toBe("Approach");
    });

    it("should support Date override with namespaced key", () => {
      setTermOverrides({ "sortLabel.sortByDate": "Timestamp" });
      expect(translate("sortLabel.sortByDate")).toBe("Timestamp");
    });
  });

  describe("clearTermOverrides", () => {
    it("should clear overrides and restore defaults", () => {
      setTermOverrides({
        studentGroup: "Team",
        "sortLabel.sortByOwner": "Participant"
      });
      expect(translate("studentGroup")).toBe("Team");
      expect(translate("sortLabel.sortByOwner")).toBe("Participant");

      clearTermOverrides();
      expect(translate("studentGroup")).toBe("Group");
      expect(translate("sortLabel.sortByOwner")).toBe("Student");
    });
  });

  describe("unknown keys", () => {
    it("should return the key itself for unknown keys", () => {
      // TypeScript would normally prevent this, but testing runtime behavior
      expect(translate("UnknownKey" as any)).toBe("UnknownKey");
    });
  });

  describe("getDefaultValue", () => {
    it("should return default values from en-us.json", () => {
      expect(getDefaultValue("studentGroup")).toBe("Group");
      expect(getDefaultValue("sortLabel.sortByOwner")).toBe("Student");
      expect(getDefaultValue("sortLabel.sortByDate")).toBe("Date");
    });

    it("should ignore overrides and always return base value", () => {
      setTermOverrides({ studentGroup: "Team", "sortLabel.sortByOwner": "Participant" });

      // translate() returns the override
      expect(translate("studentGroup")).toBe("Team");
      expect(translate("sortLabel.sortByOwner")).toBe("Participant");

      // getDefaultValue() ignores overrides and returns base value
      expect(getDefaultValue("studentGroup")).toBe("Group");
      expect(getDefaultValue("sortLabel.sortByOwner")).toBe("Student");
    });

    it("should return empty string for Strategy", () => {
      expect(getDefaultValue("Strategy")).toBe("");
    });

    it("should return the key itself for unknown keys", () => {
      expect(getDefaultValue("UnknownKey" as any)).toBe("UnknownKey");
    });
  });

  describe("escapeKeyForForm", () => {
    it("should convert dots to underscores", () => {
      expect(escapeKeyForForm("sortLabel.sortByOwner")).toBe("sortLabel_sortByOwner");
      expect(escapeKeyForForm("sortLabel.sortByDate")).toBe("sortLabel_sortByDate");
    });

    it("should leave keys without dots unchanged", () => {
      expect(escapeKeyForForm("studentGroup")).toBe("studentGroup");
      expect(escapeKeyForForm("Strategy")).toBe("Strategy");
    });

    it("should handle multiple dots", () => {
      expect(escapeKeyForForm("a.b.c")).toBe("a_b_c");
    });
  });

});
