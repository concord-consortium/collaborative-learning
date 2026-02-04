import { SortTypeId, SortTypeIds } from "../models/stores/ui-types";
import { TranslationKeyType } from "./translation/translate";

/**
 * Maps sort type IDs (used in PrimarySortType) to translation keys.
 * Most sort types use their ID as the key, but some have namespaced keys
 * to avoid collisions with other uses of the same term.
 */
export const SORT_TYPE_TO_TRANSLATION_KEY: Record<SortTypeId, TranslationKeyType> = {
  Group: "studentGroup",
  Name: "sortLabel.sortByOwner",
  Date: "sortLabel.sortByDate",
  Strategy: "strategy",
  Bookmarked: "bookmarked",
  Tools: "tools",
  Problem: "contentLevel.problem"
};

/**
 * Get the translation key for a sort type ID.
 */
export function getSortTypeTranslationKey(sortType: SortTypeId): TranslationKeyType {
  return SORT_TYPE_TO_TRANSLATION_KEY[sortType] ?? sortType as TranslationKeyType;
}

export function isValidSortTypeId(value: string): value is SortTypeId {
  return SortTypeIds.includes(value as SortTypeId);
}

/**
 * Escape a translation key for use with React Hook Form.
 * RHF interprets dots as nested object paths, so we convert dots to underscores.
 */
export function escapeKeyForForm(key: string): string {
  return key.replace(/\./g, "_");
}
