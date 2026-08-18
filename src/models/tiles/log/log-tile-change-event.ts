import { Logger } from "../../../lib/logger";
import { getTileTitleForLogging } from "../../../lib/logger-utils";
import { LogEventMethod, LogEventName } from "../../../lib/logger-types";
import { DocumentsModelType } from "../../stores/documents";
import { isTileBaseEvent, logTileBaseEvent } from "./log-tile-base-event";

export interface ITileChangeLogEvent extends Record<string, any> {
  tileId: string;
  operation: string;
  change: Record<string, any>;
  method?: LogEventMethod;
}

interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

function processTileChangeEvent(params: ITileChangeLogEvent, context: IContext) {
  const { tileId, operation, change, ...others } = params;
  const document = context.documents.findDocumentOfTile(tileId) ||
                    context.networkDocuments.findDocumentOfTile(tileId);
  const legacyChangeProps = { toolId: tileId, operation, ...change };
  const tileTitle = getTileTitleForLogging(tileId, document);
  return { document, tileId, ...legacyChangeProps, tileTitle, ...others };
}

export function logTileChangeEvent(event: LogEventName, _params: ITileChangeLogEvent) {
  const params = processTileChangeEvent(_params, Logger.stores);
  if (isTileBaseEvent(params)) {
    logTileBaseEvent(event, params);
  }
  else {
    Logger.log(event, params);
  }
}
