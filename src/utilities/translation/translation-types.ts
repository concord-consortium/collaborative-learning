export const TranslationKey = {
  Group: "Group",
  Name: "Name",
  Strategy: "Strategy",
  Bookmarked: "Bookmarked",
  Tools: "Tools",
  Date: "Date",
  Problem: "Problem"
} as const;

export type TranslationKeyType = typeof TranslationKey[keyof typeof TranslationKey];

export interface TermMetadata {
  key: TranslationKeyType;
  description: string;
  defaultValue: string;
}

export const TERM_METADATA: TermMetadata[] = [
  { key: "Group", description: "A group of students", defaultValue: "Group" },
  { key: "Name", description: "A single student/participant", defaultValue: "Student" },
  { key: "Strategy", description: "The comment tag/strategy for sorting", defaultValue: "" },
  { key: "Bookmarked", description: "Term for bookmarked documents", defaultValue: "Bookmarked" },
  { key: "Tools", description: "Term for CLUE tiles", defaultValue: "Tools" },
  { key: "Date", description: "Term for sorting by date", defaultValue: "Date" },
  { key: "Problem", description: "Term for the problems/tasks in the unit.", defaultValue: "Problem" }
];
