import { PrimarySortType } from "../models/stores/ui-types";
import { translate, TranslationKeyType } from "./translation";

interface GetSortTypeLabelOptions {
  baseLabels?: Record<PrimarySortType, string>;
  termOverrides?: Record<string, string>;
  tagPrompt?: string;
}

/**
 * Get the display label for a sort type.
 *
 * Resolution order:
 * 1. termOverrides[type] if provided and present
 * 2. tagPrompt for Strategy type (if tagPrompt is truthy)
 * 3. baseLabels[type] if provided, otherwise uses translate() defaults
 * 4. The type itself as fallback
 *
 * Note: When baseLabels is provided (e.g., in authoring context), it bypasses
 * the translate() system to allow showing raw type names instead of user-facing labels.
 */
export function getSortTypeLabel(
  type: PrimarySortType,
  options: GetSortTypeLabelOptions = {}
): string {
  const { termOverrides, tagPrompt, baseLabels } = options;

  // When baseLabels is explicitly provided, use the legacy resolution logic.
  // This supports the authoring tool which needs to show raw type names.
  if (baseLabels) {
    if (termOverrides?.[type]) {
      return termOverrides[type];
    }
    if (type === "Strategy" && tagPrompt) {
      return tagPrompt;
    }
    return baseLabels[type] || type;
  }

  // Default case: use the translation system.
  // If termOverrides or tagPrompt are explicitly provided, pass them.
  // Otherwise, translate() will use module-level overrides.
  const hasExplicitOptions = termOverrides !== undefined || tagPrompt !== undefined;
  return translate(
    type as TranslationKeyType,
    hasExplicitOptions ? { overrides: termOverrides, tagPrompt } : undefined
  );
}
