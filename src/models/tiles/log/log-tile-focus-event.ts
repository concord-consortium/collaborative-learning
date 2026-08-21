import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import {
  getTileTitleForLogging, ICurriculumLookupContext, resolveTileLogContext
} from "../../../lib/logger-utils";
import { getSectionPath } from "../../curriculum/unit";
import { logDocumentOrCurriculumEvent } from "../../document/log-document-event";

/**
 * Resolve a tile that lives in curriculum content rather than in one of the user's documents
 * (the Problems and Teacher Guide resource panels). Returns the section path such a tile should
 * be logged against, plus its title and type, or undefined if the tile isn't curriculum content.
 */
function resolveCurriculumTileLogContext(tileId: string, context?: ICurriculumLookupContext) {
  if (!context) return undefined;
  for (const problem of [context.problem, context.teacherGuide]) {
    const section = problem?.sections.find(s => s.content?.tileMap.has(tileId));
    if (!section) continue;
    // getSectionPath derives the unit code and facet from the section's own ancestry, so the path
    // matches the one comment, history, and document events report for the same section.
    const curriculum = getSectionPath(section);
    if (!curriculum) return undefined;
    return {
      curriculum,
      tileTitle: getTileTitleForLogging(tileId, section),
      tileType: section.content?.getTileType(tileId)
    };
  }
  return undefined;
}

/**
 * Logs that a tile was selected (SELECT_TILE).
 *
 * Note that focus alone does not select an editable tile: keyboard traversal of the student's own
 * workspace emits nothing until they press Enter. Read-only tiles are selected on focus, so those
 * do emit as the user tabs or arrows through them.
 *
 * `readOnly` distinguishes viewing a tile (resources panel, class work, linked read-only tiles)
 * from selecting one in the student's own editable workspace, so analysis can filter view from edit.
 */
export function logTileFocusEvent(tileId: string, readOnly: boolean) {
  const { document, sectionId, tileTitle, tileType } = resolveTileLogContext({ tileId }, Logger.stores);
  if (document) {
    logDocumentOrCurriculumEvent(LogEventName.SELECT_TILE,
      { document, tileId, tileType, tileTitle, sectionId, readOnly });
    return;
  }
  // Resource-panel tiles live in curriculum sections rather than in the user's documents.
  const curriculumContext = resolveCurriculumTileLogContext(tileId, Logger.stores);
  if (curriculumContext) {
    const { curriculum, tileTitle: curriculumTileTitle, tileType: curriculumTileType } = curriculumContext;
    logDocumentOrCurriculumEvent(LogEventName.SELECT_TILE,
      { curriculum, tileId, tileType: curriculumTileType, tileTitle: curriculumTileTitle, readOnly });
    return;
  }
  Logger.log(LogEventName.SELECT_TILE, { tileId, tileType, tileTitle, readOnly });
}
