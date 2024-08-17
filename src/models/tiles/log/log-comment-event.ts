import { isSectionPath, parseSectionPath } from "../../../../shared/shared";
import { ProblemModelType } from "../../curriculum/problem";
import { Logger } from "../../../lib/logger";
import { getTileTitleForLogging } from "../../../lib/logger-utils";
import { LogEventName } from "../../../lib/logger-types";
import { isDocumentLogEvent, logDocumentEvent } from "../../document/log-document-event";
import { isCurriculumLogEvent, logCurriculumEvent } from "../../curriculum/log-curriculum-event";

type CommentAction = "add" | "delete" | "expand" | "collapse";  // | "edit"
export interface ILogComment extends Record<string, any> {
  focusDocumentId: string;
  focusTileId?: string;
  isFirst?: boolean; // only used with "add"
  commentText: string;
  action: CommentAction;
}

interface IContext extends Record<string, any> {
  problem: ProblemModelType;
  teacherGuide?: ProblemModelType;
}

function processCommentEventParams(params: ILogComment, context: IContext) {
  const { focusDocumentId: documentId, focusTileId: tileId, isFirst, action, ...others } = params;
  const { documents, networkDocuments } = context;

  if (isSectionPath(documentId)) {
    const [_unit, facet, _investigation, _problem, section] = parseSectionPath(documentId) || [];
    const curriculumStore = facet === "guide" ?  context.teacherGuide : context.problem;
    const tileType = tileId && curriculumStore?.getSectionById(section)?.content?.getTileType(tileId);
    const tileTitle = tileId && getTileTitleForLogging(tileId, curriculumStore?.getSectionById(section));
    return { curriculum: documentId, tileId, tileTitle, tileType, ...others };
  }

  const document = documents.getDocument(documentId) || networkDocuments.getDocument(documentId);
  if (document) {
    const tileType = tileId ? document.content?.getTileType(tileId) : undefined;
    const tileTitle = tileId && getTileTitleForLogging(tileId, document);
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
              : LogEventName.COLLAPSE_COMMENT_THREAD_FOR_DOCUMENT
  };
  const event = eventMap[action];
  const params = processCommentEventParams(_params, Logger.stores);
  if (isCurriculumLogEvent(params)) {
    logCurriculumEvent(event, params);
  }
  else if (isDocumentLogEvent(params)) {
    logDocumentEvent(event, params);
  }
  else {
    Logger.log(event, params);
  }
}
