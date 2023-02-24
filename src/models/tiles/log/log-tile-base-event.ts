import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { getTileTitleForLogging } from "../../../lib/logger-utils";
import { DocumentModelType } from "../../document/document";
import { isDocumentLogEvent, logDocumentEvent } from "../../document/log-document-event";

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
  return { document, tileId, sectionId, tileTitle, ...others };
}

export function logTileBaseEvent(event: LogEventName, _params: ITileBaseLogEvent) {
  const params = processTileBaseEventParams(_params);
  if (isDocumentLogEvent(params)) {
    logDocumentEvent(event, params);
  }
  else {
    Logger.log(event, params);
  }
}
