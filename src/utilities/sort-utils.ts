import { DEFAULT_SORT_LABELS, PrimarySortType } from "../models/stores/ui-types";

interface GetSortTypeLabelOptions {
  baseLabels?: Record<PrimarySortType, string>;
  customLabels?: Record<string, string>;
  tagPrompt?: string;
}

/**
 * Get the display label for a sort type.
 *
 * Resolution order:
 * 1. customLabels[type] if provided and present
 * 2. tagPrompt for Strategy type (if tagPrompt is truthy)
 * 3. baseLabels[type] (defaults to DEFAULT_SORT_LABELS)
 * 4. The type itself as fallback
 */
export function getSortTypeLabel(
  type: PrimarySortType,
  options: GetSortTypeLabelOptions = {}
): string {
  const { customLabels, tagPrompt, baseLabels = DEFAULT_SORT_LABELS } = options;

  if (customLabels?.[type]) {
    return customLabels[type];
  }

  if (type === "Strategy" && tagPrompt) {
    return tagPrompt;
  }

  return baseLabels[type] || type;
}
