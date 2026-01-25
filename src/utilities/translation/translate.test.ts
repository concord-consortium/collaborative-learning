import { translate, clearTermOverrides } from "./translate";
import { TranslationKey } from "./translation-types";

describe("translate", () => {
  beforeEach(() => {
    clearTermOverrides();
  });

  describe("default values", () => {
    it("should return default values when no overrides provided", () => {
      expect(translate(TranslationKey.Group)).toBe("Group");
      expect(translate(TranslationKey.Name)).toBe("Student");
      expect(translate(TranslationKey.Bookmarked)).toBe("Bookmarked");
      expect(translate(TranslationKey.Tools)).toBe("Tools");
      expect(translate(TranslationKey.Date)).toBe("Date");
      expect(translate(TranslationKey.Problem)).toBe("Problem");
    });

    it("should return empty string for Strategy when no tagPrompt", () => {
      expect(translate(TranslationKey.Strategy)).toBe("");
    });
  });

  describe("overrides", () => {
    it("should use override value when provided", () => {
      const overrides = { Group: "Team" };
      expect(translate(TranslationKey.Group, { overrides })).toBe("Team");
    });

    it("should use override for multiple terms", () => {
      const overrides = {
        Group: "Team",
        Name: "Participant"
      };
      expect(translate(TranslationKey.Group, { overrides })).toBe("Team");
      expect(translate(TranslationKey.Name, { overrides })).toBe("Participant");
    });

    it("should fall back to default when override not present for key", () => {
      const overrides = { Group: "Team" };
      expect(translate(TranslationKey.Name, { overrides })).toBe("Student");
    });

    it("should not use empty string override (falls back to default)", () => {
      const overrides = { Group: "" };
      // Empty string is falsy, so it falls back to default
      expect(translate(TranslationKey.Group, { overrides })).toBe("Group");
    });
  });

  describe("Strategy special case", () => {
    it("should use tagPrompt for Strategy when provided", () => {
      expect(translate(TranslationKey.Strategy, { tagPrompt: "Identify Approach" })).toBe("Identify Approach");
    });

    it("should prefer override over tagPrompt for Strategy", () => {
      expect(translate(TranslationKey.Strategy, {
        overrides: { Strategy: "Custom Strategy" },
        tagPrompt: "Identify Approach"
      })).toBe("Custom Strategy");
    });

    it("should return empty string for Strategy when no override or tagPrompt", () => {
      expect(translate(TranslationKey.Strategy)).toBe("");
      expect(translate(TranslationKey.Strategy, {})).toBe("");
      expect(translate(TranslationKey.Strategy, { overrides: {} })).toBe("");
    });
  });

  describe("variable substitution", () => {
    it("should substitute variables in translated string", () => {
      const overrides = { Group: "Team %{number}" };
      expect(translate(TranslationKey.Group, {
        overrides,
        vars: { number: 5 }
      })).toBe("Team 5");
    });

    it("should handle multiple variables", () => {
      const overrides = { Group: "%{prefix} Team %{number}" };
      expect(translate(TranslationKey.Group, {
        overrides,
        vars: { prefix: "My", number: 3 }
      })).toBe("My Team 3");
    });

    it("should replace missing variables with empty string", () => {
      const overrides = { Group: "Team %{number}" };
      expect(translate(TranslationKey.Group, {
        overrides,
        vars: {}
      })).toBe("Team ");
    });

    it("should handle variables with whitespace in braces", () => {
      const overrides = { Group: "Team %{ number }" };
      expect(translate(TranslationKey.Group, {
        overrides,
        vars: { number: 7 }
      })).toBe("Team 7");
    });

    it("should not substitute when no vars provided", () => {
      const overrides = { Group: "Team %{number}" };
      expect(translate(TranslationKey.Group, { overrides })).toBe("Team %{number}");
    });
  });

  describe("unknown keys", () => {
    it("should return the key itself for unknown keys", () => {
      // TypeScript would normally prevent this, but testing runtime behavior
      expect(translate("UnknownKey" as any)).toBe("UnknownKey");
    });
  });
});
