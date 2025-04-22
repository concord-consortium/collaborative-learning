import { kQuestionTileType } from "./question-content";

/**
 * Updates question tile content when it's being copied.
 * The question should be locked when copied to a new document,
 * while a copy within the same document should not be locked.
 * Returns the updated content.
 */
export function updateQuestionContentForCopy(content: any, acrossDocuments: boolean) {
  if (content.type === kQuestionTileType) {
    return { ...content, locked: acrossDocuments };
  }
  return content;
}
