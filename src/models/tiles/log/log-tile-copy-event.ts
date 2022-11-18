import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { DocumentsModelType } from "../../stores/documents";
import { ITileModel } from "../tile-model";
import { logTileDocumentEvent } from "./log-tile-document-event";

interface ITileCopyLogEvent extends Record<string, any> {
  tile: ITileModel;
  originalTileId: string;
}

interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

function processTileCopyEventParams(params: ITileCopyLogEvent, context: IContext) {
  const { originalTileId, ...others } = params;
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
  return { ...srcProps, ...others };
}

export function logTileCopyEvent(event: LogEventName, _params: ITileCopyLogEvent) {
  const params = processTileCopyEventParams(_params, Logger.stores);
  logTileDocumentEvent(event, params);
}
