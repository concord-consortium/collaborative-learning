import { isSectionPath, parseSectionPath } from "../../../functions/src/shared";
import { LogEventName, Logger } from "../../lib/logger";
import { ProblemModelType } from "../curriculum/problem";
import { kLogCurriculumEvent } from "../document/log-curriculum-event";
import { kLogDocumentEvent } from "../document/log-document-event";

export const kLogCommentEvent = "LogCommentEvent";

type CommentAction = "add" | "delete" | "expand" | "collapse";  // | "edit"
export interface ILogComment {
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

Logger.registerEventType(kLogCommentEvent, (params, context) => {
  const { focusDocumentId: documentId, focusTileId: tileId, isFirst, action, ...others } = params as ILogComment;
  const { documents, networkDocuments } = context as IContext;

  if (isSectionPath(documentId)) {
    const [_unit, facet, _investigation, _problem, section] = parseSectionPath(documentId) || [];
    const curriculumStore = facet === "guide" ?  context.teacherGuide : context.problem;
    const tileType = curriculumStore?.getSectionById(section)?.content?.getTileType(tileId);
    return { nextEventType: kLogCurriculumEvent, curriculum: documentId, tileId, tileType, ...others };
  }

  const document = documents.getDocument(documentId) || networkDocuments.getDocument(documentId);
  if (document) {
    const tileType = tileId ? document.content?.getTileType(tileId) : undefined;
    return { nextEventType: kLogDocumentEvent, document, tileId, tileType, ...others };
  }

  console.warn("Warning: couldn't transform log comment event params for document:", documentId);
  return params;
});

export function logCommentEvent(commentLogInfo: ILogComment) {
  const { isFirst, focusTileId, action } = commentLogInfo;
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
  Logger.logEvent(kLogCommentEvent, event, commentLogInfo);
}
