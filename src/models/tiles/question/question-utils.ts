import { kQuestionTileType } from "./question-content";

/**
 * Updates question tile content when it's being copied to a new document.
 * For example, ensures the question is locked when copied.
 * Returns the updated content.
 */
export function updateQuestionContentForNewDocument(content: any) {
  if (content.type === kQuestionTileType) {
    return { ...content, locked: true };
  }
  return content;
}
