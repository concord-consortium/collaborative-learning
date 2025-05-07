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
  // There may be a containerId specified in the parameters,
  // but we need to see if it has changed (ie, tile moved); if so, include both.
  // Since we may have more than one, this method always returns a list-valued containerIds property.
  const newContainerId = getTileContainerForLogging(tileId, document);
  parameters.containerIds = Array.from(new Set([params.containerId, newContainerId].filter(id => id !== undefined)));
  return parameters;
}

/**
 * Log any sort of event that is associated with a tile (and therefore a document).
 * In addition to the main event, if the tile is inside a question tile, an additional
 * "question answers change" event is logged.
 * For "delete" events in particular, this function gets called before the actual deletion,
 * since it needs to access information from the tile about to be deleted. But the "question answers change"
 * event is logged after the deletion, so that the deleted tile is not included in the question answers.
 * So in this case, a callback function is passed in that will be called in between the two logging calls.
 * This callback is what will actually do the deletion.
 * @param event - The event type to log.
 * @param _params - The parameters for the event.
 * @param runBeforeContainerLogging - A function to run before logging the container events.
 */
export function logTileBaseEvent(event: LogEventName, _params: ITileBaseLogEvent,
    runBeforeContainerLogging?: () => void) {
  const params = processTileBaseEventParams(_params);
  if (isDocumentLogEvent(params)) {
    logDocumentEvent(event, params);

    if (runBeforeContainerLogging) {
      runBeforeContainerLogging();
    }
    if (params.containerIds) {
      for (const containerId of params.containerIds) {
        const containerTile = params.document.content?.getTile(containerId);
        if (containerTile && isQuestionModel(containerTile.content)) {
          logAnswerChange(containerTile, params.document);
        }
      }
    }
  }
  else {
    Logger.log(event, params);
    if (runBeforeContainerLogging) {
      runBeforeContainerLogging();
    }
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
