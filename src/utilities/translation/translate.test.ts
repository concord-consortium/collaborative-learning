import { translate, setTermOverrides, clearTermOverrides, getDefaultValue } from "./translate";

describe("translate", () => {
  beforeEach(() => {
    clearTermOverrides();
  });

  afterEach(() => {
    clearTermOverrides();
  });

  describe("default values", () => {
    it("should return default values from en-us.json when no overrides set", () => {
      expect(translate("studentGroup")).toBe("group");
      expect(translate("sortLabel.sortByOwner")).toBe("student");
      expect(translate("bookmarked")).toBe("bookmarked");
      expect(translate("tools")).toBe("tools");
      expect(translate("sortLabel.sortByDate")).toBe("date");
      expect(translate("contentLevel.problem")).toBe("problem");
    });

    it("should return empty string for Strategy by default", () => {
      expect(translate("strategy")).toBe("");
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
      expect(translate("sortLabel.sortByOwner")).toBe("student");
    });

    it("should not use empty string override (falls back to default)", () => {
      setTermOverrides({ studentGroup: "" });
      // Empty string is falsy, so it falls back to default
      expect(translate("studentGroup")).toBe("group");
    });

    it("should support Strategy override", () => {
      setTermOverrides({ strategy: "Approach" });
      expect(translate("strategy")).toBe("Approach");
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
      expect(translate("studentGroup")).toBe("group");
      expect(translate("sortLabel.sortByOwner")).toBe("student");
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
      expect(getDefaultValue("studentGroup")).toBe("group");
      expect(getDefaultValue("sortLabel.sortByOwner")).toBe("student");
      expect(getDefaultValue("sortLabel.sortByDate")).toBe("date");
    });

    it("should ignore overrides and always return base value", () => {
      setTermOverrides({ studentGroup: "Team", "sortLabel.sortByOwner": "Participant" });

      // translate() returns the override
      expect(translate("studentGroup")).toBe("Team");
      expect(translate("sortLabel.sortByOwner")).toBe("Participant");

      // getDefaultValue() ignores overrides and returns base value
      expect(getDefaultValue("studentGroup")).toBe("group");
      expect(getDefaultValue("sortLabel.sortByOwner")).toBe("student");
    });

    it("should return empty string for Strategy", () => {
      expect(getDefaultValue("strategy")).toBe("");
    });

    it("should return the key itself for unknown keys", () => {
      expect(getDefaultValue("UnknownKey" as any)).toBe("UnknownKey");
    });
  });

});
