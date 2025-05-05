import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { getTileContainerForLogging, getTileTitleForLogging } from "../../../lib/logger-utils";
import { DocumentModelType } from "../../document/document";
import { isDocumentLogEvent, logDocumentEvent } from "../../document/log-document-event";
import { isQuestionModel } from "../question/question-content";
import { getQuestionAnswersAsJSON } from "../question/question-utils";
import { ITileModel } from "../tile-model";

interface ITileBaseLogEvent extends Record<string, any> {
  document: DocumentModelType;
  tileId: string;
}

export function isTileBaseEvent(params: Record<string, any>): params is ITileBaseLogEvent {
  return !!params.document; // document is sufficient for logging purposes
}

function processTileBaseEventParams(params: ITileBaseLogEvent) {
  const { document, tileId, ...others } = params;
  const sectionId = document?.content?.getSectionIdForTile(tileId);
  const tileTitle = getTileTitleForLogging(tileId, document);
  const parameters: ITileBaseLogEvent = { document, tileId, sectionId, tileTitle, ...others };
  const containerId = getTileContainerForLogging(tileId, document);
  if (containerId) {
    parameters.containerId = containerId;
  }
  return parameters;
}

export function logTileBaseEvent(event: LogEventName, _params: ITileBaseLogEvent) {
  const params = processTileBaseEventParams(_params);
  if (isDocumentLogEvent(params)) {
    logDocumentEvent(event, params);

    if (params.containerId) {
      const containerTile = params.document.content?.getTile(params.containerId);
      if (containerTile && isQuestionModel(containerTile.content)) {
        logAnswerChange(containerTile, params.document);
      }
    }
  }
  else {
    Logger.log(event, params);
  }
}

function logAnswerChange(questionTile: ITileModel, document: DocumentModelType) {
  if (isQuestionModel(questionTile.content) && document.content) {
    const questionId = questionTile.content.questionId;
    const answers = getQuestionAnswersAsJSON(document.content, questionId);
    const params: ITileBaseLogEvent = {
      document,
      questionId,
      tileId: questionTile.id,
      answers,
    };
    logDocumentEvent(LogEventName.QUESTION_ANSWERS_CHANGE, params);
  } else {
    console.warn("logAnswerChange: questionTile is not a question model", questionTile);
  }
}
