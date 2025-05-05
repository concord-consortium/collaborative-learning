import { uniqueId } from "../../../utilities/js-utils";
import { DocumentContentModelType } from "../../document/document-content";
import { isQuestionModel } from "./question-content";
import { kQuestionTileType } from "./question-types";
import { kTextTileType, TextContentModelType } from "../text/text-content";

export interface IQuestionAnswerTileInfo {
  tileId: string;
  type: string;
  plainText?: string;
}

export interface IQuestionAnswersForTile {
  tileId: string;
  answerTiles: IQuestionAnswerTileInfo[];
}

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

/**
 * Returns an array of objects for all Question tiles with the given questionId,
 * each containing the Question tile's id and an array of its answer tiles (id and type).
 * For Text tiles, the plain-text content is also included.
 *
 * @param doc - The document model
 * @param questionId - The questionId to search for
 */
export function getQuestionAnswersAsJSON(
  doc: DocumentContentModelType,
  questionId: string
): IQuestionAnswersForTile[] {
  const result: IQuestionAnswersForTile[] = [];
  const questionTiles = doc.getTilesOfType(kQuestionTileType);

  questionTiles.forEach((questionTileId: string) => {
    const questionTileContent = doc.getTile(questionTileId)?.content;
    if (isQuestionModel(questionTileContent) && questionTileContent.questionId === questionId) {
      const answerTileIds = questionTileContent.tileIds;
      const answerTiles = answerTileIds
        .map((id: string) => {
          const tile = doc.getTile(id);
          if (!tile) return null;
          if (tile.isFixedPosition) return null; // Ignore prompt tile
          if (tile.content?.type === kTextTileType) {
            const textContent = tile.content as TextContentModelType;
            return { tileId: tile.id, type: tile.content.type, plainText: textContent.asPlainText() };
          }
          return { tileId: tile.id, type: tile.content?.type };
        })
        .filter(Boolean) as IQuestionAnswerTileInfo[];
      result.push({ tileId: questionTileId, answerTiles });
    }
  });

  return result;
}
