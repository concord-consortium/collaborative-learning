import { PrimarySortType } from "../models/stores/ui-types";
import { getDefaultValue, translate } from "./translation/translate";
import { getSortTypeTranslationKey } from "./translation/translation-types";

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

  // Default case: use the translation system with module-level overrides.
  return translate(getSortTypeTranslationKey(type));
}
