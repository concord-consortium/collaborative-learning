import enUS from "./lang/en-us.json";

export type TranslationKeyType = keyof typeof enUS;

export interface TermMetadata {
  key: TranslationKeyType;
  label: string;  // User-friendly display name for authoring UI
  description: string;
}

export const TERM_METADATA: TermMetadata[] = [
  { key: "studentGroup", label: "Group", description: "A group of students" },
  { key: "sortLabel.sortByOwner", label: "Name", description: "Sort label for document owner/student" },
  { key: "Strategy", label: "Strategy", description: "The comment tag/strategy for sorting" },
  { key: "Bookmarked", label: "Bookmarked", description: "Term for bookmarked documents" },
  { key: "Tools", label: "Tools", description: "Term for CLUE tiles" },
  { key: "sortLabel.sortByDate", label: "Date", description: "Sort label for date" },
  { key: "Problem", label: "Problem", description: "Term for the problems/tasks in the unit." }
];

/**
 * Maps sort type IDs (used in PrimarySortType) to translation keys.
 * Most sort types use their ID as the key, but some have namespaced keys
 * to avoid collisions with other uses of the same term.
 */
export const SORT_TYPE_TO_TRANSLATION_KEY: Record<string, TranslationKeyType> = {
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
export function getSortTypeTranslationKey(sortType: string): TranslationKeyType {
  return SORT_TYPE_TO_TRANSLATION_KEY[sortType] ?? sortType as TranslationKeyType;
}

/**
 * Escape a translation key for use with React Hook Form.
 * RHF interprets dots as nested object paths, so we convert dots to underscores.
 */
export function escapeKeyForForm(key: string): string {
  return key.replace(/\./g, "_");
}
