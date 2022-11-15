import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { DocumentsModelType } from "../../stores/documents";
import { ITileModel } from "../tile-model";
import { kLogTileDocumentEvent } from "./log-tile-document-event";

export const kLogTileCopyEvent = "LogTileCopyEvent";

interface IParams extends Record<string, any> {
  tile: ITileModel;
  originalTileId: string;
}

interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

Logger.registerEventType(kLogTileCopyEvent, (_params, _context) => {
  const { originalTileId, ...others } = _params as IParams;
  const context = _context as IContext;
  const srcDocument = context.documents.findDocumentOfTile(originalTileId) ||
                      context.networkDocuments.findDocumentOfTile(originalTileId);
  const srcProps = srcDocument
                    ? {
                      sourceUsername: srcDocument.uid,
                      sourceObjectId: originalTileId,
                      sourceDocumentKey: srcDocument.key,
                      sourceDocumentType: srcDocument.type,
                      sourceDocumentTitle: srcDocument.title || "",
                      sourceDocumentProperties: srcDocument.properties || {},
                      sourceSectionId: srcDocument.content?.getSectionIdForTile(originalTileId)
                    }
                    : undefined;
  return { nextEventType: kLogTileDocumentEvent, ...srcProps, ...others };
});

export function logTileCopyEvent(event: LogEventName, params: IParams) {
  Logger.logEvent(kLogTileCopyEvent, event, params);
}
