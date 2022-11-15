import { Logger } from "../../../lib/logger";
import { LogEventMethod, LogEventName } from "../../../lib/logger-types";
import { DocumentsModelType } from "../../stores/documents";
import { kLogTileBaseEvent } from "./log-tile-base-event";

export const kLogTileChangeEvent = "LogTileChangeEvent";

interface IParams extends Record<string, any> {
  tileId: string;
  operation: string;
  change: Record<string, any>;
  method?: LogEventMethod;
}

interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

Logger.registerEventType(kLogTileChangeEvent, (_params, _context) => {
  const { tileId, operation, change, ...others } = _params as IParams;
  const context = _context as IContext;
  const document = context.documents.findDocumentOfTile(tileId) ||
                    context.networkDocuments.findDocumentOfTile(tileId);
  const legacyChangeProps = { toolId: tileId, operation, ...change };
  console.log("kLogTileChangeEvent", "legacyChangeProps:", JSON.stringify(legacyChangeProps));
  return { nextEventType: kLogTileBaseEvent, document, tileId, ...legacyChangeProps, ...others };
});

export function logTileChangeEvent(event: LogEventName, params: IParams) {
  Logger.logEvent(kLogTileChangeEvent, event, params);
}
