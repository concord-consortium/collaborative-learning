import { uniqueId } from "../../../utilities/js-utils";
import { kQuestionTileType } from "./question-types";

/**
 * Generates a new question ID.
 * @returns A new 6-character ID.
 */
export function generateQuestionId() {
  return uniqueId(6);
}

/**
 * Updates question tile content when it's being copied.
 * The question should be locked when copied to a new document,
 * while a copy within the same document should not be locked.
 * A new ID is generated for the question if it gets unlocked.
 * Returns the updated content.
 */
export function updateQuestionContentForCopy(content: any, acrossDocuments: boolean) {
  if (content.type === kQuestionTileType) {
    const maybeNewId = acrossDocuments ? content.questionId : generateQuestionId();
    return { ...content, locked: acrossDocuments, questionId: maybeNewId };
  }
  return content;
}
