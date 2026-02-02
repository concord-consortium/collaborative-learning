import {
  getSortTypeTranslationKey,
  isValidSortTypeId,
  SORT_TYPE_TO_TRANSLATION_KEY,
  escapeKeyForForm
} from "./translation-types";
import { SortTypeIds } from "../../authoring/types";

describe("translation-types", () => {
  describe("SORT_TYPE_TO_TRANSLATION_KEY", () => {
    it("should have entries for all SortTypeIds", () => {
      SortTypeIds.forEach(sortTypeId => {
        expect(SORT_TYPE_TO_TRANSLATION_KEY[sortTypeId]).toBeDefined();
      });
    });

    it("should map sort types to their correct translation keys", () => {
      expect(SORT_TYPE_TO_TRANSLATION_KEY.Group).toBe("studentGroup");
      expect(SORT_TYPE_TO_TRANSLATION_KEY.Name).toBe("sortLabel.sortByOwner");
      expect(SORT_TYPE_TO_TRANSLATION_KEY.Date).toBe("sortLabel.sortByDate");
      expect(SORT_TYPE_TO_TRANSLATION_KEY.Strategy).toBe("Strategy");
      expect(SORT_TYPE_TO_TRANSLATION_KEY.Bookmarked).toBe("Bookmarked");
      expect(SORT_TYPE_TO_TRANSLATION_KEY.Tools).toBe("Tools");
      expect(SORT_TYPE_TO_TRANSLATION_KEY.Problem).toBe("Problem");
    });
  });

  describe("getSortTypeTranslationKey", () => {
    it("should return the correct translation key for each sort type", () => {
      expect(getSortTypeTranslationKey("Group")).toBe("studentGroup");
      expect(getSortTypeTranslationKey("Name")).toBe("sortLabel.sortByOwner");
      expect(getSortTypeTranslationKey("Date")).toBe("sortLabel.sortByDate");
      expect(getSortTypeTranslationKey("Strategy")).toBe("Strategy");
      expect(getSortTypeTranslationKey("Bookmarked")).toBe("Bookmarked");
      expect(getSortTypeTranslationKey("Tools")).toBe("Tools");
      expect(getSortTypeTranslationKey("Problem")).toBe("Problem");
    });
  });

  describe("isValidSortTypeId", () => {
    it("should return true for valid SortTypeIds", () => {
      expect(isValidSortTypeId("Group")).toBe(true);
      expect(isValidSortTypeId("Name")).toBe(true);
      expect(isValidSortTypeId("Date")).toBe(true);
      expect(isValidSortTypeId("Strategy")).toBe(true);
      expect(isValidSortTypeId("Bookmarked")).toBe(true);
      expect(isValidSortTypeId("Tools")).toBe(true);
      expect(isValidSortTypeId("Problem")).toBe(true);
    });

    it("should return false for invalid strings", () => {
      expect(isValidSortTypeId("Invalid")).toBe(false);
      expect(isValidSortTypeId("")).toBe(false);
      expect(isValidSortTypeId("group")).toBe(false);
      expect(isValidSortTypeId("GROUP")).toBe(false);
      expect(isValidSortTypeId("Date ")).toBe(false);
      expect(isValidSortTypeId(" Date")).toBe(false);
    });

    it("should work as a type guard", () => {
      const value: string = "Group";
      if (isValidSortTypeId(value)) {
        const sortTypeId: typeof SortTypeIds[number] = value;
        expect(sortTypeId).toBe("Group");
      } else {
        fail("Expected isValidSortTypeId to return true for 'Group'");
      }
    });
  });

  describe("escapeKeyForForm", () => {
    it("should replace dots with underscores", () => {
      expect(escapeKeyForForm("sortLabel.sortByOwner")).toBe("sortLabel_sortByOwner");
      expect(escapeKeyForForm("sortLabel.sortByDate")).toBe("sortLabel_sortByDate");
    });

    it("should handle multiple dots", () => {
      expect(escapeKeyForForm("a.b.c")).toBe("a_b_c");
    });

    it("should return unchanged string if no dots", () => {
      expect(escapeKeyForForm("Strategy")).toBe("Strategy");
      expect(escapeKeyForForm("studentGroup")).toBe("studentGroup");
    });

    it("should handle empty string", () => {
      expect(escapeKeyForForm("")).toBe("");
    });
  });
});
