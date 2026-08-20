import { isSectionPath, parseSectionPath } from "../../../../shared/shared";
import { Logger } from "../../../lib/logger";
import { getTileTitleForLogging, IDocumentContext, processDocumentEventParams } from "../../../lib/logger-utils";
import { LogEventName } from "../../../lib/logger-types";
import { logDocumentOrCurriculumEvent } from "../../document/log-document-event";

type CommentAction = "add" | "delete" | "expand" | "collapse" | "rate";
export interface ILogComment extends Record<string, any> {
  focusDocumentId: string;
  focusTileId?: string;
  isFirst?: boolean; // only used with "add"
  commentText: string;
  action: CommentAction;
}

function processCommentEventParams(params: ILogComment, context: IDocumentContext) {
  const { focusDocumentId: documentId, focusTileId: tileId, isFirst, action, ...others } = params;

  if (isSectionPath(documentId)) {
    const [_unit, facet, _investigation, _problem, section] = parseSectionPath(documentId) || [];
    const curriculumStore = facet === "guide" ?  context.teacherGuide : context.problem;
    const sectionTileType = tileId && curriculumStore?.getSectionById(section)?.content?.getTileType(tileId);
    const sectionTileTitle = tileId && getTileTitleForLogging(tileId, curriculumStore?.getSectionById(section));
    return { curriculum: documentId, tileId, tileTitle: sectionTileTitle, tileType: sectionTileType, ...others };
  }

  const { document, tileTitle, tileType } = processDocumentEventParams({ documentId, tileId }, context);
  if (document) {
    return { document, tileId, tileTitle, tileType, ...others };
  }

  console.warn("Warning: couldn't transform log comment event params for document:", documentId);
  return { tileId, ...others };
}

export function logCommentEvent(_params: ILogComment) {
  const { isFirst, focusTileId, action } = _params;
  const eventMap: Record<CommentAction, LogEventName> = {
    add: focusTileId
          ? isFirst
              ? LogEventName.ADD_INITIAL_COMMENT_FOR_TILE
              : LogEventName.ADD_RESPONSE_COMMENT_FOR_TILE
          : isFirst
              ? LogEventName.ADD_INITIAL_COMMENT_FOR_DOCUMENT
              : LogEventName.ADD_RESPONSE_COMMENT_FOR_DOCUMENT,
    delete: focusTileId
              ? LogEventName.DELETE_COMMENT_FOR_TILE
              : LogEventName.DELETE_COMMENT_FOR_DOCUMENT,
    expand: focusTileId
              ? LogEventName.EXPAND_COMMENT_THREAD_FOR_TILE
              : LogEventName.EXPAND_COMMENT_THREAD_FOR_DOCUMENT,
    collapse: focusTileId
              ? LogEventName.COLLAPSE_COMMENT_THREAD_FOR_TILE
              : LogEventName.COLLAPSE_COMMENT_THREAD_FOR_DOCUMENT,
    rate: focusTileId
            ? LogEventName.RATE_COMMENT_FOR_TILE
            : LogEventName.RATE_COMMENT_FOR_DOCUMENT
  };
  const event = eventMap[action];
  const params = processCommentEventParams(_params, Logger.stores);
  logDocumentOrCurriculumEvent(event, params);
}
