import { PrimarySortType, SortTypeId, SortTypeIds } from "../models/stores/ui-types";
import { getDefaultValue, translate, TranslationKeyType } from "./translation/translate";

/**
 * Maps sort type IDs (used in PrimarySortType) to translation keys.
 * Most sort types use their ID as the key, but some have namespaced keys
 * to avoid collisions with other uses of the same term.
 */
export const SORT_TYPE_TO_TRANSLATION_KEY: Record<SortTypeId, TranslationKeyType> = {
  Group: "studentGroup",
  Name: "sortLabel.sortByOwner",
  Date: "sortLabel.sortByDate",
  Strategy: "Strategy",
  Bookmarked: "Bookmarked",
  Tools: "Tools",
  Problem: "Problem"
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

interface GetSortTypeLabelOptions {
  termOverrides?: Record<string, string>;
  tagPrompt?: string;
}

/**
 * Get the display label for a sort type.
 *
 * When termOverrides is provided (authoring context):
 * - Uses termOverrides[translationKey] if present
 * - Uses tagPrompt for Strategy type if no override
 * - Falls back to default from en-us.json (or type name if empty)
 *
 * When termOverrides is NOT provided:
 * - Uses translate() which reads from module-level overrides
 */
export function getSortTypeLabel(
  type: PrimarySortType,
  options: GetSortTypeLabelOptions = {}
): string {
  const { termOverrides, tagPrompt } = options;

  // When termOverrides is provided, use authoring-specific resolution.
  // This supports the authoring tool which needs to preview custom
  // overrides before they're saved to the module-level state.
  if (termOverrides) {
    const translationKey = getSortTypeTranslationKey(type);
    if (termOverrides[translationKey]) {
      return termOverrides[translationKey];
    }
    if (type === "Strategy" && tagPrompt) {
      return tagPrompt;
    }
    // Fall back to en-us.json default, or type name if empty
    return getDefaultValue(translationKey) || type;
  }

  // Strategy type uses tagPrompt if available
  if (type === "Strategy" && tagPrompt) {
    return tagPrompt;
  }

  // Default case: use the translation system with module-level overrides.
  return translate(getSortTypeTranslationKey(type));
}
